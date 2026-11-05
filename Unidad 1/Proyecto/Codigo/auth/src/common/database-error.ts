import { BadRequestException, ConflictException } from '@nestjs/common';

export function rethrowDatabaseError(error: unknown): never {
  const code = (error as { code?: string })?.code;
  if (code === '23505') throw new ConflictException('El valor unico ya existe');
  if (
    ['23502', '23503', '23514', '22P02', '22001', '22007', '22008'].includes(
      code ?? '',
    )
  ) {
    throw new BadRequestException('Datos invalidos o referencia inexistente');
  }
  throw error;
}
