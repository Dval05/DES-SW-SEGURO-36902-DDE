import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  ValidateIf,
  IsString,
  Length,
  Matches,
} from 'class-validator';
export class CreateRoleDto {
  @ApiProperty({
    minLength: 3,
    maxLength: 50,
    pattern: '^[A-Z][A-Z0-9_]*$',
    description:
      'Nombre unico. Los roles adicionales no conceden permisos integrados.',
    example: 'AUDITOR',
  })
  @IsString()
  @Length(3, 50)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  rol!: string;
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @IsString()
  @Length(1, 255)
  description!: string;
  @ApiPropertyOptional({ default: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  estado?: boolean;
}
