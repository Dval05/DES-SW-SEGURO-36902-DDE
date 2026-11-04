import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { envSchema } from './config/env.schema';
import { RequestIdMiddleware } from './common/middleware/request-id/request-id.middleware';
import { RolesModule } from './roles/roles.module';
import { UserRolesModule } from './user-roles/user-roles.module';
import { UsersModule } from './users/users.module';
import { SeedService } from './seed.service';
import { AuditModule } from './common/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: (value) => envSchema.parse(value) }),
    ThrottlerModule.forRootAsync({ inject: [ConfigService], useFactory: (c: ConfigService) => [{ ttl: c.getOrThrow<number>('RATE_LIMIT_TTL_MS'), limit: c.getOrThrow<number>('RATE_LIMIT_MAX') }] }),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: (c: ConfigService) => ({
      type: 'postgres', host: c.getOrThrow('DB_HOST'), port: c.getOrThrow('DB_PORT'), username: c.getOrThrow('DB_USERNAME'),
      password: c.getOrThrow('DB_PASSWORD'), database: c.getOrThrow('DB_DATABASE'), autoLoadEntities: true,
      synchronize: c.get('DB_SYNCHRONIZE') === 'true', ssl: c.get('DB_SSL') === 'true' ? { rejectUnauthorized: true } : false,
    }) }),
    AuditModule, UsersModule, RolesModule, UserRolesModule, AuthModule,
  ], controllers: [AppController], providers: [SeedService],
})
export class AppModule implements NestModule { configure(consumer: MiddlewareConsumer) { consumer.apply(RequestIdMiddleware).forRoutes('*'); } }
