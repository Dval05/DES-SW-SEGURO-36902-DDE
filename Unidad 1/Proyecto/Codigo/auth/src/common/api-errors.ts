import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from './response.dto';
export function ApiErrors(...statuses: number[]) {
  const descriptions: Record<number, string> = {
    400: 'Datos invalidos',
    401: 'Autenticacion invalida',
    403: 'Permiso insuficiente',
    404: 'Recurso inexistente',
    409: 'Conflicto de unicidad',
    429: 'Limite de solicitudes',
    500: 'Error interno',
  };
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        type: ErrorResponseDto,
        description: descriptions[status],
      }),
    ),
  );
}
