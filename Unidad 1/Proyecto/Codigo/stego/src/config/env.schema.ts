import { z } from 'zod';
export const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  JWT_PUBLIC_KEY_PATH: z.string().min(1),
  JWT_ISSUER: z.string().default('secure-auth'), JWT_AUDIENCE: z.string().default('secure-backend'),
  AUTH_INTERNAL_URL: z.url().refine(value => new URL(value).protocol === 'https:', 'AUTH requiere HTTPS'),
  STEGO_SERVICE_TOKEN: z.string().min(32),
  AUTH_TIMEOUT_MS: z.coerce.number().int().min(1).max(30000).default(3000),
  MAX_FILE_BYTES: z.coerce.number().int().min(1).max(52428800).default(5242880),
  MAX_PIXELS: z.coerce.number().int().min(1).max(16000000).default(16000000),
  LSB_THRESHOLD: z.coerce.number().min(0).max(1).default(.97),
  LSB_INCONCLUSIVE_FLOOR: z.coerce.number().min(0).max(1).default(.85),
  STEGO_DB_PATH: z.string().default('./data/stego.db'),
}).refine(value => value.LSB_INCONCLUSIVE_FLOOR < value.LSB_THRESHOLD, 'El piso no concluyente debe ser menor que el umbral');
