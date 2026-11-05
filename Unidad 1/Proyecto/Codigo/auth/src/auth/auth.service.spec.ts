import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

const dir=mkdtempSync(join(tmpdir(),'auth-security-'));
const keys=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
writeFileSync(join(dir,'private.pem'),keys.privateKey);writeFileSync(join(dir,'public.pem'),keys.publicKey);
afterAll(()=>rmSync(dir,{recursive:true,force:true}));
describe('JWT and current authorization',()=>{
  let service:AuthService;let user:any;let roles:string[];let active:boolean;const jwt=new JwtService();
  beforeEach(async()=>{
    active=true;roles=['ANALYST'];user={id:'subject-1',username:'analyst',tokenVersion:0,passwordHash:await argon2.hash('Valid-password-2026!',{type:argon2.argon2id})};
    const users={findForLogin:async()=>active?user:null,findForToken:async()=>active?user:null,incrementTokenVersion:async()=>{user.tokenVersion++},findOne:async()=>user};
    service=new AuthService(users as any,{activeRoles:async()=>roles} as any,jwt,new ConfigService({JWT_PRIVATE_KEY_PATH:join(dir,'private.pem'),JWT_PUBLIC_KEY_PATH:join(dir,'public.pem'),JWT_ISSUER:'test-auth',JWT_AUDIENCE:'test-api',JWT_EXPIRES_IN:'15m'}),{event:()=>{}} as any);
  });
  it('signs RS256 with bounded expiry and no stale role claims',async()=>{const {access_token}=await service.login('analyst','Valid-password-2026!');const claims=await jwt.verifyAsync(access_token,{publicKey:keys.publicKey,algorithms:['RS256'],issuer:'test-auth',audience:'test-api'});expect(claims.sub).toBe(user.id);expect(claims.exp-claims.iat).toBe(900);expect(claims.roles).toBeUndefined()});
  it('rejects wrong passwords and inactive identities',async()=>{await expect(service.login('analyst','wrong')).rejects.toMatchObject({status:401});active=false;await expect(service.login('analyst','Valid-password-2026!')).rejects.toMatchObject({status:401})});
  it('revokes permissions immediately with the same unexpired token',async()=>{const {access_token}=await service.login('analyst','Valid-password-2026!');expect((await service.authorize(access_token,'steganography.analyze')).allowed).toBe(true);roles=['USER'];expect((await service.authorize(access_token,'steganography.analyze')).allowed).toBe(false)});
  it('logout invalidates previously issued tokens',async()=>{const {access_token}=await service.login('analyst','Valid-password-2026!');await service.logout(user.id);await expect(service.verifySubject(access_token)).rejects.toMatchObject({status:401})});
  it('rejects inactive users even while their token has not expired',async()=>{const {access_token}=await service.login('analyst','Valid-password-2026!');active=false;await expect(service.authorize(access_token,'steganography.analyze')).rejects.toMatchObject({status:401})});
  it.each([{issuer:'wrong'},{audience:'wrong'},{expiresIn:-1}])('rejects invalid registered claims %p',async override=>{const token=await jwt.signAsync({sub:user.id,typ:'access',tokenVersion:0},{privateKey:keys.privateKey,algorithm:'RS256',issuer:'test-auth',audience:'test-api',expiresIn:900,...override});await expect(service.verifySubject(token)).rejects.toMatchObject({status:401})});
  it('does not authorize unknown actions even for ADMIN',async()=>{roles=['ADMIN'];const {access_token}=await service.login('analyst','Valid-password-2026!');expect((await service.authorize(access_token,'unknown')).allowed).toBe(false)});
});
