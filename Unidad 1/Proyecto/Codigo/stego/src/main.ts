import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureStegoApp } from './configure-app.js';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureStegoApp(app);
  await app.listen(process.env.PORT ?? 3002, '0.0.0.0');
}
void bootstrap();
