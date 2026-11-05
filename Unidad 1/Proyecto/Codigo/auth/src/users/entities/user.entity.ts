import { Exclude } from 'class-transformer';

import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

import { UserRole } from '../../user-roles/entities/user-role.entity.js';

@Entity({
  name: 'users',
})
@Check('CHK_users_cedula', `"cedula" ~ '^[0-9]{10}$'`)
@Index('UQ_users_cedula', ['cedula'], {
  unique: true,
})
@Index('UQ_users_username', ['username'], {
  unique: true,
})
@Index('UQ_users_email', ['email'], {
  unique: true,
})
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 10,
  })
  cedula!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  nombres!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  apellidos!: string;

  @Column({
    name: 'fecha_nacimiento',
    type: 'date',
  })
  fechaNacimiento!: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  username!: string;

  @Column({
    type: 'varchar',
    length: 150,
  })
  email!: string;

  @Exclude()
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash!: string;

  @Exclude()
  @Column({ name: 'token_version', type: 'integer', default: 0 })
  tokenVersion!: number;

  @Column({
    name: 'status',
    type: 'boolean',
    default: true,
  })
  estado!: boolean;

  @VersionColumn({
    name: 'version',
  })
  version!: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
  })
  fechaCreacion!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
  })
  fechaActualizacion!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    nullable: true,
  })
  fechaEliminacion!: Date | null;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles!: UserRole[];
}
