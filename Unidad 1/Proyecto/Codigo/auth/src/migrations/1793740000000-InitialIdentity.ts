import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialIdentity1793740000000 implements MigrationInterface {
  name = 'InitialIdentity1793740000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        cedula varchar(10) NOT NULL CHECK (cedula ~ '^[0-9]{10}$'),
        nombres varchar(100) NOT NULL, apellidos varchar(100) NOT NULL,
        fecha_nacimiento date NOT NULL,
        username varchar(50) NOT NULL UNIQUE, email varchar(150) NOT NULL UNIQUE,
        password varchar(255) NOT NULL, token_version integer NOT NULL DEFAULT 0,
        estado boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1,
        fecha_creacion timestamp NOT NULL DEFAULT now(),
        fecha_actualizacion timestamp NOT NULL DEFAULT now(), fecha_eliminacion timestamp,
        CONSTRAINT UQ_users_cedula UNIQUE (cedula)
      );
      CREATE TABLE IF NOT EXISTS roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rol varchar(50) NOT NULL UNIQUE,
        description varchar(255) NOT NULL DEFAULT '', estado boolean NOT NULL DEFAULT true,
        version integer NOT NULL DEFAULT 1, fecha_creacion timestamp NOT NULL DEFAULT now(),
        fecha_actualizacion timestamp NOT NULL DEFAULT now(), fecha_eliminacion timestamp
      );
      CREATE TABLE IF NOT EXISTS user_roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        fecha_asignacion timestamp NOT NULL DEFAULT now(),
        CONSTRAINT UQ_user_roles_user_role UNIQUE (user_id, role_id)
      );
      CREATE INDEX IF NOT EXISTS IDX_user_roles_user ON user_roles(user_id);
      CREATE INDEX IF NOT EXISTS IDX_user_roles_role ON user_roles(role_id);
    `);
  }
  async down(): Promise<void> {
    throw new Error('La migracion inicial no elimina identidades automaticamente. Restaure un respaldo para revertir.');
  }
}
