import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity.js';
import { Role } from '../../roles/entities/role.entity.js';

@Entity({
  name: 'user_roles',
})
@Index(
  'IDX_user_roles_user',
  ['userId'],
)
@Index(
  'IDX_user_roles_role',
  ['roleId'],
)
@Index('UQ_user_roles_user_role', ['userId', 'roleId'], { unique: true })
export class UserRole {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'user_id',
    type: 'uuid',
  })
  userId!: string;

  @Column({
    name: 'role_id',
    type: 'uuid',
  })
  roleId!: string;

  @ManyToOne(
    () => User,
    (user) => user.userRoles,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'user_id',
  })
  user!: User;

  @ManyToOne(
    () => Role,
    (role) => role.userRoles,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'role_id',
  })
  role!: Role;

  @CreateDateColumn({
    name: 'fecha_asignacion',
    type: 'timestamp',
  })
  fechaAsignacion!: Date;
}
