import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
export class CreateRoleDto { @IsString() @IsIn(['ADMIN','ANALYST','USER']) rol!: string; @IsString() @Length(1,255) description!: string; @IsOptional() @IsBoolean() estado?: boolean; }
