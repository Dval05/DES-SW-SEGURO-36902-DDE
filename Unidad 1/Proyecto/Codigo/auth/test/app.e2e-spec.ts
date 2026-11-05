import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AuditService } from '../src/common/audit.service';
import { configureAuthApp } from '../src/configure-app';

jest.setTimeout(120000);
describe('AUTH HTTP, PostgreSQL migrations and real guards', () => {
  let app: INestApplication;
  let container = '';
  let dir = '';
  let token: string;
  let user: any;
  let privateKey: string;
  let password = 'Initial-password-2026!';
  const events: any[] = [];
  const context = { Authorization: '' };
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'auth-e2e-'));
    const keys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    privateKey = keys.privateKey;
    writeFileSync(join(dir, 'private.pem'), privateKey);
    writeFileSync(join(dir, 'public.pem'), keys.publicKey);
    const dbPassword = randomUUID();
    container = execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '-d',
        '-e',
        'POSTGRES_USER=auth',
        '-e',
        'POSTGRES_DB=auth',
        '-e',
        `POSTGRES_PASSWORD=${dbPassword}`,
        '-p',
        '127.0.0.1::5432',
        'postgres:17-alpine',
      ],
      { encoding: 'utf8' },
    ).trim();
    const binding = JSON.parse(
      execFileSync('docker', ['inspect', container], { encoding: 'utf8' }),
    )[0].NetworkSettings.Ports['5432/tcp'][0];
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        execFileSync(
          'docker',
          ['exec', container, 'pg_isready', '-U', 'auth'],
          { stdio: 'ignore' },
        );
        break;
      } catch {
        if (attempt === 39)
          throw new Error('PostgreSQL de pruebas no disponible');
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    Object.assign(process.env, {
      DB_HOST: '127.0.0.1',
      DB_PORT: binding.HostPort,
      DB_USERNAME: 'auth',
      DB_PASSWORD: dbPassword,
      DB_DATABASE: 'auth',
      DB_SSL: 'false',
      JWT_PRIVATE_KEY_PATH: join(dir, 'private.pem'),
      JWT_PUBLIC_KEY_PATH: join(dir, 'public.pem'),
      JWT_ISSUER: 'test-auth',
      JWT_AUDIENCE: 'test-api',
      JWT_EXPIRES_IN: '15m',
      STEGO_SERVICE_TOKEN: 'test-service-token-01234567890123456789',
      SEED_ADMIN_PASSWORD: 'Admin-password-2026!',
    });
    const { AppModule } = await import('../src/app.module');
    const audit = new AuditService();
    (audit as any).logger = {
      log: (line: string) => events.push(JSON.parse(line)),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuditService)
      .useValue(audit)
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    configureAuthApp(app);
    await app.init();
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identity: 'admin', password: 'Admin-password-2026!' })
      .expect(201);
    token = login.body.access_token;
    context.Authorization = `Bearer ${token}`;
    const created = await request(app.getHttpServer())
      .post('/api/users')
      .set(context)
      .set('x-request-id', 'e2e-user-create')
      .send({
        cedula: '1234567890',
        nombres: 'Prueba',
        apellidos: 'Integracion',
        fechaNacimiento: '1995-01-01',
        username: 'e2e-user',
        email: 'e2e@example.local',
        password,
      })
      .expect(201);
    user = created.body;
  });
  afterAll(async () => {
    if (app) await app.close();
    if (container)
      execFileSync('docker', ['rm', '-f', container], { stdio: 'ignore' });
    if (dir) rmSync(dir, { recursive: true, force: true });
  });
  it('boots real app and exposes a sanitized profile', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    const response = await request(app.getHttpServer())
      .get('/api/auth/profile')
      .set(context)
      .expect(200);
    expect(response.body.username).toBe('admin');
    expect(response.body.passwordHash).toBeUndefined();
    expect(response.body.tokenVersion).toBeUndefined();
  });
  it('rejects missing authentication and invalid UUIDs with proper HTTP codes', async () => {
    await request(app.getHttpServer()).get('/api/users').expect(401);
    for (const path of [
      '/api/users/bad-id',
      '/api/roles/bad-id',
      '/api/user-roles/bad-id',
    ]) {
      const method = path.includes('user-roles')
        ? 'delete'
        : path.includes('roles')
          ? 'patch'
          : 'get';
      await (request(app.getHttpServer()) as any)
        [method](path)
        .set(context)
        .send({})
        .expect(400);
    }
  });
  it.each([
    { fechaNacimiento: 'not-a-date' },
    { fechaNacimiento: '2026-02-30' },
    { username: null },
    { estado: null },
  ])('validates updates before SQL: %p', async (patch) => {
    await request(app.getHttpServer())
      .patch(`/api/users/${user.id}`)
      .set(context)
      .send(patch)
      .expect(400);
  });
  it('returns 409 for a duplicate value during update', async () => {
    await request(app.getHttpServer())
      .patch(`/api/users/${user.id}`)
      .set(context)
      .send({ username: 'admin' })
      .expect(409);
  });
  it('creates a new role, denies built-in rights and audits assignment/revocation', async () => {
    const role = await request(app.getHttpServer())
      .post('/api/roles')
      .set(context)
      .set('x-request-id', 'e2e-role-create')
      .send({ rol: 'AUDITOR_TEST', description: 'Sin permisos por defecto' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/roles/${role.body.id}`)
      .set(context)
      .set('x-request-id', 'e2e-role-update')
      .send({ description: 'Actualizado' })
      .expect(200);
    const roleList = await request(app.getHttpServer()).get('/api/roles').set(context).expect(200);
    expect(roleList.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: role.body.id, description: 'Actualizado' }),
    ]));
    const assignment = await request(app.getHttpServer())
      .post('/api/user-roles')
      .set(context)
      .set('x-request-id', 'e2e-role-assign')
      .send({ userId: user.id, roleId: role.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/user-roles')
      .set(context)
      .send({ userId: user.id, roleId: role.body.id })
      .expect(409);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identity: user.username, password })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/users')
      .auth(login.body.access_token, { type: 'bearer' })
      .expect(403);
    const decision = await request(app.getHttpServer())
      .post('/internal/authorization/check')
      .set('x-service-token', process.env.STEGO_SERVICE_TOKEN!)
      .send({
        subject_token: login.body.access_token,
        action: 'steganography.analyze',
      })
      .expect(201);
    expect(decision.body.allowed).toBe(false);
    await request(app.getHttpServer())
      .delete(`/api/user-roles/${assignment.body.id}`)
      .set(context)
      .set('x-request-id', 'e2e-role-revoke')
      .expect(200);
    for (const event of [
      'user_created',
      'role_created',
      'role_updated',
      'role_assigned',
      'role_revoked',
    ]) {
      const record = events.find(
        (e) => e.event === event && e.requestId?.startsWith('e2e-'),
      );
      expect(record?.actorId).toMatch(/^[0-9a-f-]{36}$/);
      expect(record?.targetRoleId ?? record?.targetUserId).toMatch(
        /^[0-9a-f-]{36}$/,
      );
    }
    expect(JSON.stringify(events)).not.toContain(password);
    expect(JSON.stringify(events)).not.toContain(token);
  });
  it('changing password invalidates the previously issued token', async () => {
    const old = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identity: user.username, password })
      .expect(201);
    password = 'Changed-password-2026!';
    await request(app.getHttpServer())
      .patch(`/api/users/${user.id}`)
      .set(context)
      .set('x-request-id', 'e2e-password-change')
      .send({ password })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/auth/profile')
      .auth(old.body.access_token, { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identity: user.username, password })
      .expect(201);
  });
  it('rejects a correctly signed token lacking expiry', async () => {
    const claims = new JwtService().decode(token);
    delete claims.exp;
    delete claims.iat;
    const missingExp = await new JwtService().signAsync(claims, {
      privateKey,
      algorithm: 'RS256',
    });
    await request(app.getHttpServer())
      .get('/api/auth/profile')
      .auth(missingExp, { type: 'bearer' })
      .expect(401);
  });
  it('publishes usable update and response schemas', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(
      body.components.schemas.UpdateUserDto.properties.username,
    ).toBeDefined();
    expect(body.components.schemas.UpdateRoleDto.properties.rol).toBeDefined();
    expect(
      body.paths['/api/users/{id}'].patch.responses['200'].content[
        'application/json'
      ].schema.$ref,
    ).toContain('PublicUserDto');
  });
});
