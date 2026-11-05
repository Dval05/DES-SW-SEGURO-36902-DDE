import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { StegoService } from './stego.service.js';
describe('Reference corpus regression', () => {
  it.each([
    ['original/reference.png', 'sin_indicios'],
    ['original/noisy-unmodified.png', 'no_concluyente'],
    ['stego/lsb-random-payload.png', 'sospechoso'],
    ['stego/lsb-sparse-payload.png', 'sin_indicios'],
    ['stego/lsb-inconclusive-pattern.png', 'no_concluyente'],
  ])('%s produces %s', async (path, status) => {
    const service = new StegoService(
      new ConfigService({ STEGO_DB_PATH: ':memory:' }),
      { event: () => {} } as any,
    );
    try {
      const buffer = readFileSync('../samples/' + path);
      const result = await service.analyze(
        {
          buffer,
          originalname: path.split('/').at(-1),
          mimetype: 'image/png',
          size: buffer.length,
        } as Express.Multer.File,
        'test-user',
      );
      expect(result.status).toBe(status);
      expect(result.limitations).toContain('cargas dispersas');
      expect(result.indicators.chi_square_critical).toBeGreaterThan(0);
    } finally {
      service.close();
    }
  });
});
