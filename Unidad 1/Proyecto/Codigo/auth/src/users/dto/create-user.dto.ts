import { IsBoolean, IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
export class CreateUserDto {
  @IsString() @Matches(/^\d{10}$/) cedula!: string; @IsString() @Length(2,100) nombres!: string; @IsString() @Length(2,100) apellidos!: string;
  @IsString() fechaNacimiento!: string; @IsString() @Length(3,50) username!: string; @IsEmail() email!: string; @IsString() @MinLength(12) password!: string;
  @IsOptional() @IsBoolean() estado?: boolean;
}
