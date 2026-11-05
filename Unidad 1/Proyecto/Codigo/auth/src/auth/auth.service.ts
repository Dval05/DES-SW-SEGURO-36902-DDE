import { AccessClaims, assertAccessClaims } from '../common/access-claims';
import * as argon2 from 'argon2';
import { readFileSync } from 'node:fs';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../common/audit.service';
import { UserRolesService } from '../user-roles/user-roles.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly privateKey: Buffer;
  private readonly publicKey: Buffer;
  constructor(
    private readonly users: UsersService,
    private readonly ur: UserRolesService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.privateKey = readFileSync(config.getOrThrow('JWT_PRIVATE_KEY_PATH'));
    this.publicKey = readFileSync(config.getOrThrow('JWT_PUBLIC_KEY_PATH'));
  }
  async login(identity: string, password: string, requestId?: string) {
    const user = await this.users.findForLogin(identity);
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      this.audit.event('authentication_failed', {
        identity_hint: createHint(identity),
        requestId,
      });
      throw new UnauthorizedException('Credenciales invalidas');
    }
    this.audit.event('authentication_succeeded', {
      userId: user.id,
      requestId,
    });
    const access_token = await this.jwt.signAsync(
      {
        sub: user.id,
        username: user.username,
        typ: 'access',
        tokenVersion: user.tokenVersion,
      },
      {
        privateKey: this.privateKey,
        algorithm: 'RS256',
        issuer: this.config.getOrThrow('JWT_ISSUER'),
        audience: this.config.getOrThrow('JWT_AUDIENCE'),
        expiresIn: this.config.getOrThrow('JWT_EXPIRES_IN') as any,
      },
    );
    return {
      access_token,
      token_type: 'Bearer',
      expires_in: (() => {
        const claims = this.jwt.decode(access_token);
        return claims.exp - claims.iat;
      })(),
    };
  }
  async verifySubject(token: string) {
    let payload: AccessClaims;
    try {
      payload = await this.jwt.verifyAsync<AccessClaims>(token, {
        publicKey: this.publicKey,
        algorithms: ['RS256'],
        issuer: this.config.getOrThrow('JWT_ISSUER'),
        audience: this.config.getOrThrow('JWT_AUDIENCE'),
      });
    } catch {
      throw new UnauthorizedException('Token invalido');
    }
    assertAccessClaims(payload);
    const user = await this.users.findForToken(payload.sub);
    if (!user || user.tokenVersion !== payload.tokenVersion)
      throw new UnauthorizedException('Sesion revocada');
    return payload;
  }
  async profile(id: string) {
    const user = await this.users.findOne(id);
    const {
      passwordHash: _passwordHash,
      tokenVersion: _tokenVersion,
      ...profile
    } = user;
    return profile;
  }
  async logout(id: string, requestId?: string) {
    await this.users.incrementTokenVersion(id);
    this.audit.event('logout', { userId: id, requestId });
    return { logged_out: true };
  }
  async authorize(
    token: string,
    action: string,
    requestId?: string,
    resource?: { resource_id?: string | null; resource_owner_id?: string | null },
  ) {
    const payload = await this.verifySubject(token);
    const roles = await this.ur.activeRoles(payload.sub);
    const hasRole =
      ['steganography.analyze', 'steganography.result.read'].includes(action) &&
      roles.some((role) => role === 'ADMIN' || role === 'ANALYST');
    const resourceId = resource?.resource_id ?? null;
    const ownerId = resource?.resource_owner_id ?? null;
    let reason = hasRole
      ? 'active_role_grants_permission'
      : 'no_active_role_grants_permission';
    if (hasRole && action === 'steganography.result.read') {
      if (!resourceId || !ownerId) reason = 'resource_not_found';
      else if (ownerId !== payload.sub && !roles.includes('ADMIN')) reason = 'resource_not_owned';
    }
    const allowed = reason === 'active_role_grants_permission';
    this.audit.event('authorization_decision', {
      userId: payload.sub,
      action,
      allowed,
      reason,
      requestId,
    });
    return { subject_id: payload.sub, action, resource_id: resourceId, allowed, reason, roles };
  }
}
function createHint(identity: string) {
  return identity.includes('@')
    ? identity.replace(/(^.).*(@.*$)/, '$1***$2')
    : `${identity.slice(0, 2)}***`;
}
