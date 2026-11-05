import { BadRequestException, Controller, Get, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SubjectGuard } from './subject.guard.js';
import { AuthorizationGuard } from './authorization.guard.js';
import { StegoService } from './stego.service.js';

@ApiTags('steganography')
@ApiBearerAuth()
@Controller('steganography')
@UseGuards(SubjectGuard, AuthorizationGuard)
@ApiResponse({ status: 401, description: 'JWT ausente, invalido, vencido o sesion revocada' })
@ApiResponse({ status: 403, description: 'Permiso insuficiente o recurso ajeno' })
@ApiResponse({ status: 503, description: 'AUTH no proporciona una decision valida' })
export class StegoController {
  constructor(private readonly service: StegoService) {}
  @Post('analyze')
  @ApiOperation({ summary: 'Analizar un PNG con autorizacion vigente antes de recibir el archivo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 201, description: 'Registro persistido: id, user_id, sha256, technique, indicators, status, action, created_at y limitations' })
  @ApiResponse({ status: 413, description: 'Archivo demasiado grande' })
  @ApiResponse({ status: 415, description: 'Extension, firma o MIME no admitidos' })
  @ApiResponse({ status: 422, description: 'PNG corrupto o dimensiones fuera de limite' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: Number(process.env.MAX_FILE_BYTES ?? 5242880), files: 1, fields: 0, parts: 1 } }))
  async analyze(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return this.service.analyze(file, req.decision.subject_id, req.requestId);
  }
  @Get('results/:id')
  @ApiOperation({ summary: 'Consultar resultado propio; ADMIN puede consultar cualquier resultado' })
  @ApiResponse({ status: 200, description: 'Registro del analisis con indicadores' })
  @ApiResponse({ status: 404, description: 'Analisis inexistente' })
  async result(@Param('id') id: string, @Req() req: any) {
    return this.service.get(id, req.decision.subject_id, req.decision.roles.includes('ADMIN'));
  }
}
