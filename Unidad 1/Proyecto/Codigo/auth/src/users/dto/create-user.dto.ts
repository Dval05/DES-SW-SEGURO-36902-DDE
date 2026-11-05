import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
export class CreateUserDto {
  @ApiProperty({ pattern: '^[0-9]{10}$', example: '1234567890' })
  @IsString()
  @Matches(/^\d{10}$/)
  cedula!: string;
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100)
  nombres!: string;
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100)
  apellidos!: string;
  @ApiProperty({ format: 'date', example: '1995-01-01' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaNacimiento!: string;
  @ApiProperty({ minLength: 3, maxLength: 50 })
  @IsString()
  @Length(3, 50)
  username!: string;
  @ApiProperty({ format: 'email', maxLength: 150 })
  @IsEmail()
  @MaxLength(150)
  email!: string;
  @ApiProperty({
    format: 'password',
    writeOnly: true,
    minLength: 12,
    maxLength: 128,
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
  @ApiPropertyOptional({ default: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  estado?: boolean;
}
