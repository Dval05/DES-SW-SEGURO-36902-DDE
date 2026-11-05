import { readFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureAuthApp } from './configure-app';
async function bootstrap() {
  const httpsOptions =
    process.env.TLS_KEY_PATH && process.env.TLS_CERT_PATH
      ? {
          key: readFileSync(process.env.TLS_KEY_PATH),
          cert: readFileSync(process.env.TLS_CERT_PATH),
        }
      : undefined;
  const app = await NestFactory.create(AppModule, { httpsOptions });
  configureAuthApp(app);
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
void bootstrap();
