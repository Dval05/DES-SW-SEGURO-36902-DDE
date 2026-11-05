import { z } from 'zod';
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3001),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string().default('auth'),
  DB_PASSWORD: z.string().min(12),
  DB_DATABASE: z.string().default('auth'),
  DB_SSL: z.enum(['true', 'false']).default('false'),
  DB_SYNCHRONIZE: z.enum(['true', 'false']).default('false'),
  JWT_PRIVATE_KEY_PATH: z.string(),
  JWT_PUBLIC_KEY_PATH: z.string(),
  JWT_ISSUER: z.string().default('secure-auth'),
  JWT_AUDIENCE: z.string().default('secure-backend'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^[1-9][0-9]*(s|m|h)$/)
    .refine((value) => {
      const amount = Number(value.slice(0, -1));
      const scale = value.endsWith('h') ? 3600 : value.endsWith('m') ? 60 : 1;
      return amount * scale <= 3600;
    }, 'JWT no puede superar una hora')
    .default('15m'),
  STEGO_SERVICE_TOKEN: z.string().min(32),
  RATE_LIMIT_TTL_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  TLS_KEY_PATH: z.string().optional(),
  TLS_CERT_PATH: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
});
