import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class AnalysisIndicatorsDto {
  @ApiPropertyOptional() width?: number;
  @ApiPropertyOptional() height?: number;
  @ApiPropertyOptional() channels?: number;
  @ApiPropertyOptional() sample_bits?: number;
  @ApiPropertyOptional() lsb_one_ratio?: number;
  @ApiPropertyOptional() transition_rate?: number;
  @ApiPropertyOptional() chi_square?: number;
  @ApiPropertyOptional() chi_square_critical?: number;
  @ApiPropertyOptional() minimum_bits?: number;
  @ApiPropertyOptional() reference_bit_score?: number;
  @ApiPropertyOptional({
    description:
      'Heuristica de aleatoriedad, no probabilidad de esteganografia',
  })
  anomaly_score?: number;
  @ApiPropertyOptional() threshold?: number;
  @ApiPropertyOptional() inconclusive_floor?: number;
  @ApiPropertyOptional({
    description: 'Motivo del error cuando no hay indicadores',
  })
  reason?: string;
}
export class AnalysisResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) user_id!: string;
  @ApiProperty() filename!: string;
  @ApiProperty({ pattern: '^[a-f0-9]{64}$' }) sha256!: string;
  @ApiProperty({ enum: ['lsb_statistical_analysis'] }) technique!: string;
  @ApiProperty({
    enum: ['sin_indicios', 'sospechoso', 'no_concluyente', 'error'],
  })
  status!: string;
  @ApiProperty({ type: () => AnalysisIndicatorsDto })
  indicators!: AnalysisIndicatorsDto;
  @ApiProperty({ enum: ['rechazo', 'advertencia'] }) action!: string;
  @ApiProperty() limitations!: string;
  @ApiProperty({ format: 'date-time' }) created_at!: string;
}
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
