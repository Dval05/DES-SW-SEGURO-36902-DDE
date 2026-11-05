import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class ErrorResponseDto {
  @ApiProperty() statusCode!: number;
  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }],
  })
  error!: string | object;
  @ApiProperty() path!: string;
  @ApiProperty() requestId!: string;
  @ApiProperty({ format: 'date-time' }) timestamp!: string;
}
export class PublicUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() cedula!: string;
  @ApiProperty() nombres!: string;
  @ApiProperty() apellidos!: string;
  @ApiProperty({ format: 'date' }) fechaNacimiento!: string;
  @ApiProperty() username!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty() estado!: boolean;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) fechaCreacion!: string;
  @ApiProperty({ format: 'date-time' }) fechaActualizacion!: string;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  fechaEliminacion?: string;
}
export class RoleResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() rol!: string;
  @ApiProperty() description!: string;
  @ApiProperty() estado!: boolean;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) fechaCreacion!: string;
  @ApiProperty({ format: 'date-time' }) fechaActualizacion!: string;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  fechaEliminacion?: string;
}
export class AssignmentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ format: 'uuid' }) roleId!: string;
  @ApiProperty({ format: 'date-time' }) fechaAsignacion!: string;
  @ApiPropertyOptional({ type: () => PublicUserDto }) user?: PublicUserDto;
  @ApiPropertyOptional({ type: () => RoleResponseDto }) role?: RoleResponseDto;
}
export class LoginResponseDto {
  @ApiProperty() access_token!: string;
  @ApiProperty({ enum: ['Bearer'] }) token_type!: string;
  @ApiProperty({ description: 'Duracion del acceso en segundos' })
  expires_in!: number;
}
export class LogoutResponseDto {
  @ApiProperty() logged_out!: boolean;
}
export class DeleteAssignmentResponseDto {
  @ApiProperty() deleted!: boolean;
}
export class AuthorizationResponseDto {
  @ApiProperty({ format: 'uuid' }) subject_id!: string;
  @ApiProperty({ enum: ['steganography.analyze', 'steganography.result.read'] })
  action!: string;
  @ApiProperty() allowed!: boolean;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: [String] }) roles!: string[];
}
