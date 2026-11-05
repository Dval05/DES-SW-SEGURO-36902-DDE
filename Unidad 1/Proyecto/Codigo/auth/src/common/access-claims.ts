import { UnauthorizedException } from '@nestjs/common';
export type AccessClaims = {
  sub: string;
  username?: string;
  typ: 'access';
  tokenVersion: number;
  iat: number;
  exp: number;
};
export function assertAccessClaims(
  value: unknown,
): asserts value is AccessClaims {
  const claims = value as Partial<AccessClaims> | null;
  const now = Math.floor(Date.now() / 1000);
  if (
    !claims ||
    typeof claims.sub !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      claims.sub,
    ) ||
    claims.typ !== 'access' ||
    !Number.isSafeInteger(claims.tokenVersion) ||
    claims.tokenVersion! < 0 ||
    !Number.isSafeInteger(claims.iat) ||
    !Number.isSafeInteger(claims.exp) ||
    claims.iat! > now + 5 ||
    claims.exp! <= now ||
    claims.exp! <= claims.iat! ||
    claims.exp! - claims.iat! > 3600
  ) {
    throw new UnauthorizedException('Claims de acceso invalidos');
  }
}
