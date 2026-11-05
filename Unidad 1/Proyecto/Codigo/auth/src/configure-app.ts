import helmet from 'helmet';
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AuditService } from './common/audit.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions/all-exceptions.filter';

export function configureAuthApp(app: INestApplication) {
  app.use(helmet());
  app.setGlobalPrefix('api', { exclude: ['/', 'internal/{*path}', 'health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(AuditService)));
  const config = new DocumentBuilder()
    .setTitle('AUTH API')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-service-token' },
      'serviceToken',
    )
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
