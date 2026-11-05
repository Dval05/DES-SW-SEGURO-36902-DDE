import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../common/audit.service.js';
import { StegoService } from './stego.service.js';
describe('StegoService file validation', () => {
  let dir: string;
  let service: StegoService;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'stego-test-'));
    const config = new ConfigService({
      STEGO_DB_PATH: join(dir, 'test.db'),
      MAX_PIXELS: 100,
      LSB_THRESHOLD: 0.97,
      LSB_INCONCLUSIVE_FLOOR: 0.85,
    });
    service = new StegoService(config, new AuditService());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    service.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const file = (buffer: Buffer, name = 'test.png', mimetype = 'image/png') =>
    ({
      buffer,
      originalname: name,
      mimetype,
      size: buffer.length,
    }) as Express.Multer.File;
  it('rejects an incompatible signature with 415', async () => {
    await expect(
      service.analyze(
        file(Buffer.from('not an image')),
        'user',
        't10-signature',
      ),
    ).rejects.toMatchObject({ status: 415 });
  });
  it('rejects a truncated PNG with 422', async () => {
    const valid = await sharp({
      create: { width: 5, height: 5, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(
      service.analyze(file(valid.subarray(0, 32)), 'user', 't10-corrupt'),
    ).rejects.toMatchObject({ status: 422 });
  });
  it('rejects excessive pixel count before raw decoding', async () => {
    const valid = await sharp({
      create: { width: 20, height: 20, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    await expect(
      service.analyze(file(valid), 'user', 't10-pixels'),
    ).rejects.toMatchObject({ status: 422 });
  });
  it('accepts a bounded PNG and calculates real indicators', async () => {
    const valid = await sharp({
      create: {
        width: 5,
        height: 5,
        channels: 3,
        background: { r: 2, g: 4, b: 6 },
      },
    })
      .png()
      .toBuffer();
    const result = await service.analyze(file(valid), 'user', 'valid');
    expect(result.indicators.sample_bits).toBe(75);
    expect(result.status).toBe('no_concluyente');
  });

  it('enforces ownership while allowing ADMIN access', async () => {
    const result = await service.analyze(
      file(
        await sharp({
          create: { width: 5, height: 5, channels: 3, background: 'red' },
        })
          .png()
          .toBuffer(),
      ),
      'owner',
    );
    expect(() => service.get(result.id, 'other', false)).toThrow(
      'Recurso ajeno',
    );
    expect(service.get(result.id, 'owner', false).id).toBe(result.id);
    expect(service.get(result.id, 'admin', true).id).toBe(result.id);
  });
  it('persists errors and destroys the submitted buffer', async () => {
    const valid = await sharp({
      create: { width: 5, height: 5, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    const submitted = file(valid.subarray(0, 32));
    try {
      await service.analyze(submitted, 'owner');
    } catch (error: any) {
      const record = service.get(
        error.getResponse().analysis_id,
        'owner',
        false,
      );
      expect(record.status).toBe('error');
      expect(record.action).toBe('rechazo');
      expect(record.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(submitted.buffer.every((b) => b === 0)).toBe(true);
      return;
    }
    throw new Error('Expected corrupt PNG rejection');
  });
  it('rejects oversized input even when invoked outside HTTP', async () => {
    const submitted = file(Buffer.from('x'));
    submitted.size = 5242881;
    await expect(service.analyze(submitted, 'owner')).rejects.toMatchObject({
      status: 413,
    });
  });
  it.each([
    [401, {}, 401],
    [500, {}, 503],
    [
      200,
      {
        allowed: false,
        subject_id: 'user',
        action: 'steganography.analyze',
        resource_id: null,
        reason: 'no_active_role_grants_permission',
        roles: ['USER'],
      },
      403,
    ],
    [
      200,
      {
        allowed: true,
        subject_id: 'user',
        action: 'different',
        resource_id: null,
        reason: 'active_role_grants_permission',
        roles: ['ADMIN'],
      },
      503,
    ],
    [
      200,
      { allowed: true, subject_id: 'user', action: 'steganography.analyze', resource_id: null, reason: 'active_role_grants_permission' },
      503,
    ],
    [
      200,
      {
        allowed: true,
        subject_id: 'user',
        action: 'steganography.analyze',
        resource_id: '6490a953-5c15-47f9-9f81-e83338f4e3e1',
        reason: 'active_role_grants_permission',
        roles: ['ANALYST'],
      },
      503,
    ],
  ])(
    'fails closed for AUTH status %s and invalid decisions',
    async (status, decision, expected) => {
      (service as any).config = new ConfigService({
        AUTH_INTERNAL_URL: 'https://auth',
        STEGO_SERVICE_TOKEN: 'service-token',
      });
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify(decision), {
              status: status as number,
            }),
          ),
      );
      await expect(
        service.authorize('token', 'steganography.analyze'),
      ).rejects.toMatchObject({ status: expected });
    },
  );
  it('fails closed when AUTH cannot be reached', async () => {
    (service as any).config = new ConfigService({
      AUTH_INTERNAL_URL: 'https://auth',
      STEGO_SERVICE_TOKEN: 'service-token',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );
    await expect(
      service.authorize('token', 'steganography.analyze'),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('rejects 16-bit PNG instead of silently discarding its LSB', async () => {
    const input = await sharp({
      create: { width: 5, height: 5, channels: 3, background: 'red' },
    })
      .toColourspace('rgb16')
      .png()
      .toBuffer();
    expect(input[24]).toBe(16);
    await expect(service.analyze(file(input), 'owner')).rejects.toMatchObject({
      status: 415,
    });
  });
  it('does not treat small samples as a confident negative', async () => {
    const input = await sharp({
      create: {
        width: 5,
        height: 5,
        channels: 3,
        background: { r: 2, g: 4, b: 6 },
      },
    })
      .png()
      .toBuffer();
    const result = await service.analyze(file(input), 'owner');
    expect(result.status).toBe('no_concluyente');
    expect(result.indicators.minimum_bits).toBe(1024);
  });
});
