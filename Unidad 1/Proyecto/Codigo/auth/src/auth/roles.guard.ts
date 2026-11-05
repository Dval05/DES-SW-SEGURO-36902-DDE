import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DataSource,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest();
    const roles = await this.db.query<{ name: string }[]>(
      `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id AND r.status = true AND r.deleted_at IS NULL
       WHERE ur.user_id = $1`,
      [request.user.sub],
    );

    if (!requiredRoles.some((name) => roles.some((role) => role.name === name))) {
      throw new ForbiddenException('Permiso insuficiente');
    }
    return true;
  }
}
