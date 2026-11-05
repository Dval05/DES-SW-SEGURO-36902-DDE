import {
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
  name: 'roles',
})
@Index(
  'UQ_roles_rol',
  ['rol'],
  {
    unique: true,
  },
)
export class Role {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'name',
    type: 'varchar',
    length: 50,
  })
  rol!: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  description!: string;

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

  @OneToMany(
    () => UserRole,
    (userRole) => userRole.role,
  )
  userRoles!: UserRole[];
}
