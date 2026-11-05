import helmet from 'helmet';
import { readFileSync } from 'node:fs';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions/all-exceptions.filter';
async function bootstrap() {
  const httpsOptions = process.env.TLS_KEY_PATH && process.env.TLS_CERT_PATH ? { key: readFileSync(process.env.TLS_KEY_PATH), cert: readFileSync(process.env.TLS_CERT_PATH) } : undefined;
  const app = await NestFactory.create(AppModule, { httpsOptions }); app.use(helmet());
  app.setGlobalPrefix('api', { exclude: ['internal/{*path}', 'health'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector))); app.useGlobalFilters(new AllExceptionsFilter());
  const config = new DocumentBuilder().setTitle('AUTH API').setVersion('1.0').addBearerAuth().addApiKey({type:'apiKey',in:'header',name:'x-service-token'},'serviceToken').build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
void bootstrap();
