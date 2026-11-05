import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsUUID,
} from 'class-validator';
export class LoginDto {
  @ApiProperty({ minLength: 1, maxLength: 150 })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  identity!: string;
  @ApiProperty({
    format: 'password',
    writeOnly: true,
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
export class AuthorizationCheckDto {
  @ApiProperty({ writeOnly: true, maxLength: 8192 })
  @IsString()
  @MaxLength(8192)
  subject_token!: string;
  @ApiProperty({ enum: ['steganography.analyze', 'steganography.result.read'] })
  @IsIn(['steganography.analyze', 'steganography.result.read'])
  action!: 'steganography.analyze' | 'steganography.result.read';
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  resource_id?: string | null;
}
