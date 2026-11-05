import { assertAccessClaims } from '../common/access-claims.js';
import { readFileSync } from 'node:fs';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../common/audit.service.js';
@Injectable()
export class SubjectGuard implements CanActivate {
  private readonly key: Buffer;
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.key = readFileSync(config.getOrThrow('JWT_PUBLIC_KEY_PATH'));
  }
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = String(req.headers.authorization ?? '');
    if (!header.startsWith('Bearer ')) {
      this.audit.event('authentication_denied', {
        requestId: req.requestId,
        reason: 'missing_token',
      });
      throw new UnauthorizedException('Token requerido');
    }
    try {
      req.user = await this.jwt.verifyAsync(header.slice(7), {
        publicKey: this.key,
        algorithms: ['RS256'],
        issuer: this.config.getOrThrow('JWT_ISSUER'),
        audience: this.config.getOrThrow('JWT_AUDIENCE'),
      });
      req.rawToken = header.slice(7);
      assertAccessClaims(req.user);
      return true;
    } catch {
      this.audit.event('authentication_denied', {
        requestId: req.requestId,
        reason: 'invalid_token',
      });
      throw new UnauthorizedException('Token invalido');
    }
  }
}
