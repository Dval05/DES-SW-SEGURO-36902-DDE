import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Exercise the compiled application, including TypeScript decorator metadata.
describe('STEGO real HTTP app, JWT guards, file pipeline and SQLite', () => {
  let app: INestApplication;
  let dir: string;
  let privateKey: string;
  let buffer: Buffer;
  const subject = '11111111-1111-4111-8111-111111111111';
  const jwt = new JwtService();
  let token: string;
  let allowed = true;
  let available = true;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'stego-e2e-'));
    const keys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    privateKey = keys.privateKey;
    writeFileSync(join(dir, 'public.pem'), keys.publicKey);
    Object.assign(process.env, {
      JWT_PUBLIC_KEY_PATH: join(dir, 'public.pem'),
      JWT_ISSUER: 'test-auth',
      JWT_AUDIENCE: 'test-api',
      AUTH_INTERNAL_URL: 'https://auth.test',
      STEGO_SERVICE_TOKEN: 'test-service-token-01234567890123456789',
      STEGO_DB_PATH: join(dir, 'analyses.db'),
      MAX_FILE_BYTES: '1024',
    });
    // AUTH is the external boundary; real-service communication is covered by test-all.ps1.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        if (!available) throw new Error('AUTH down');
        expect(options.headers['x-service-token']).toBe(
          process.env.STEGO_SERVICE_TOKEN,
        );
        const payload = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            subject_id: subject,
            action: payload.action,
            resource_id: payload.resource_id,
            allowed,
            roles: allowed ? ['ANALYST'] : ['USER'],
            reason: allowed
              ? 'active_role_grants_permission'
              : 'no_active_role_grants_permission',
          }),
          { status: 201 },
        );
      }),
    );
    const { AppModule } = await import('../dist/app.module.js');
    const { configureStegoApp } = await import('../dist/configure-app.js');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    configureStegoApp(app);
    await app.init();
    token = await jwt.signAsync(
      { sub: subject, typ: 'access', tokenVersion: 0 },
      {
        privateKey,
        algorithm: 'RS256',
        issuer: 'test-auth',
        audience: 'test-api',
        expiresIn: 900,
      },
    );
    buffer = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 2, g: 4, b: 6 },
      },
    })
      .png()
      .toBuffer();
  });
  afterAll(async () => {
    if (app) await app.close();
    vi.unstubAllGlobals();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });
  it('denies missing, manipulated and nonexpiring tokens', async () => {
    await request(app.getHttpServer())
      .post('/api/steganography/analyze')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/steganography/analyze')
      .auth(token + 'x', { type: 'bearer' })
      .expect(401);
    const missingExp = await jwt.signAsync(
      { sub: subject, typ: 'access', tokenVersion: 0 },
      {
        privateKey,
        algorithm: 'RS256',
        issuer: 'test-auth',
        audience: 'test-api',
      },
    );
    await request(app.getHttpServer())
      .post('/api/steganography/analyze')
      .auth(missingExp, { type: 'bearer' })
      .expect(401);
  });
  it('checks current permissions before multipart size limits', async () => {
    allowed = false;
    try {
      await request(app.getHttpServer())
        .post('/api/steganography/analyze')
        .auth(token, { type: 'bearer' })
        .attach('file', Buffer.alloc(2048), {
          filename: 'huge.png',
          contentType: 'image/png',
        })
        .expect(403);
    } finally {
      allowed = true;
    }
  });
  it('fails closed when AUTH is unavailable', async () => {
    available = false;
    try {
      await request(app.getHttpServer())
        .post('/api/steganography/analyze')
        .auth(token, { type: 'bearer' })
        .attach('file', buffer, {
          filename: 'image.png',
          contentType: 'image/png',
        })
        .expect(503);
    } finally {
      available = true;
    }
  });
  it('analyzes, persists and reads an owned result through real routes', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/steganography/analyze')
      .auth(token, { type: 'bearer' })
      .attach('file', buffer, {
        filename: 'image.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(response.body.status).toBe('sin_indicios');
    expect(response.body.sha256).toMatch(/^[a-f0-9]{64}$/);
    await request(app.getHttpServer())
      .get(`/api/steganography/results/${response.body.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
  });
  it('validates size, UUIDs and 16-bit compatibility with proper codes', async () => {
    await request(app.getHttpServer())
      .post('/api/steganography/analyze')
      .auth(token, { type: 'bearer' })
      .attach('file', Buffer.alloc(2048), {
        filename: 'huge.png',
        contentType: 'image/png',
      })
      .expect(413);
    const sixteen = await sharp({
      create: { width: 8, height: 8, channels: 3, background: 'red' },
    })
      .toColourspace('rgb16')
      .png()
      .toBuffer();
    await request(app.getHttpServer())
      .post('/api/steganography/analyze')
      .auth(token, { type: 'bearer' })
      .attach('file', sixteen, {
        filename: '16bit.png',
        contentType: 'image/png',
      })
      .expect(415);
    await request(app.getHttpServer())
      .get('/api/steganography/results/bad-id')
      .auth(token, { type: 'bearer' })
      .expect(400);
  });
  it('publishes structured indicator and error schemas', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const schema = response.body;
    expect(
      schema.paths['/api/steganography/analyze'].post.responses['201'].content[
        'application/json'
      ].schema.$ref,
    ).toContain('AnalysisResponseDto');
    expect(
      schema.components.schemas.AnalysisResponseDto.properties.indicators
        .$ref ??
        schema.components.schemas.AnalysisResponseDto.properties.indicators
          .allOf?.[0].$ref,
    ).toContain('AnalysisIndicatorsDto');
  });
});
