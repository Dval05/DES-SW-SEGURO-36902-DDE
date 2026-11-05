import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignIdentitySchema1793851200000 implements MigrationInterface {
  name = 'AlignIdentitySchema1793851200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users RENAME COLUMN password TO password_hash;
      ALTER TABLE users RENAME COLUMN estado TO status;
      ALTER TABLE users RENAME COLUMN fecha_creacion TO created_at;
      ALTER TABLE users RENAME COLUMN fecha_actualizacion TO updated_at;
      ALTER TABLE users RENAME COLUMN fecha_eliminacion TO deleted_at;
      ALTER TABLE roles RENAME COLUMN rol TO name;
      ALTER TABLE roles RENAME COLUMN estado TO status;
      ALTER TABLE roles RENAME COLUMN fecha_creacion TO created_at;
      ALTER TABLE roles RENAME COLUMN fecha_actualizacion TO updated_at;
      ALTER TABLE roles RENAME COLUMN fecha_eliminacion TO deleted_at;
      ALTER TABLE user_roles RENAME COLUMN fecha_asignacion TO assigned_at;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_roles RENAME COLUMN assigned_at TO fecha_asignacion;
      ALTER TABLE roles RENAME COLUMN deleted_at TO fecha_eliminacion;
      ALTER TABLE roles RENAME COLUMN updated_at TO fecha_actualizacion;
      ALTER TABLE roles RENAME COLUMN created_at TO fecha_creacion;
      ALTER TABLE roles RENAME COLUMN status TO estado;
      ALTER TABLE roles RENAME COLUMN name TO rol;
      ALTER TABLE users RENAME COLUMN deleted_at TO fecha_eliminacion;
      ALTER TABLE users RENAME COLUMN updated_at TO fecha_actualizacion;
      ALTER TABLE users RENAME COLUMN created_at TO fecha_creacion;
      ALTER TABLE users RENAME COLUMN status TO estado;
      ALTER TABLE users RENAME COLUMN password_hash TO password;
    `);
  }
}
