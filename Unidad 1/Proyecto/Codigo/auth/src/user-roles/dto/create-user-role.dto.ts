import { IsUUID } from 'class-validator'; export class CreateUserRoleDto { @IsUUID() userId!: string; @IsUUID() roleId!: string; }
