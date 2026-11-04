import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserRolesModule } from '../user-roles/user-roles.module'; import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller'; import { JwtAuthGuard } from './jwt-auth.guard'; import { AuthService } from './auth.service'; import { RolesGuard } from './roles.guard';
@Global() @Module({imports:[JwtModule.register({}),UsersModule,UserRolesModule],controllers:[AuthController],providers:[AuthService,JwtAuthGuard,RolesGuard],exports:[AuthService,JwtAuthGuard,RolesGuard]}) export class AuthModule{}
