import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  ForbiddenException,
  PayloadTooLargeException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseSync } from 'node:sqlite';
import { fileTypeFromBuffer } from 'file-type';
import sharp, { type OutputInfo } from 'sharp';
import { v4 as uuid } from 'uuid';
import { AuditService } from '../common/audit.service.js';

type Decision = {
  subject_id: string;
  action: string;
  resource_id: string | null;
  allowed: boolean;
  reason: string;
  roles: string[];
};

@Injectable()
export class StegoService {
  private readonly db: DatabaseSync;
  constructor(
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    const path = config.get('STEGO_DB_PATH', './data/stego.db');
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS analyses(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,filename TEXT NOT NULL,sha256 TEXT NOT NULL,technique TEXT NOT NULL,status TEXT NOT NULL,indicators TEXT NOT NULL,action TEXT NOT NULL,limitations TEXT NOT NULL,created_at TEXT NOT NULL)',
    );
  }

  async authorize(
    token: string,
    action: 'steganography.analyze' | 'steganography.result.read',
    resourceId?: string,
    requestId?: string,
  ) {
    const resource = resourceId
      ? this.db.prepare('SELECT user_id FROM analyses WHERE id = ?').get(resourceId)
      : undefined;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number(this.config.get('AUTH_TIMEOUT_MS', 3000)),
    );
    try {
      const response = await fetch(
        `${this.config.getOrThrow('AUTH_INTERNAL_URL')}/internal/authorization/check`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-service-token': this.config.getOrThrow('STEGO_SERVICE_TOKEN'),
            'x-request-id': requestId ?? '',
          },
          body: JSON.stringify({
            subject_token: token,
            action,
            resource_id: resourceId ?? null,
            resource_owner_id: resource?.user_id ?? null,
          }),
          signal: controller.signal,
        },
      );
      if (response.status === 401)
        throw new UnauthorizedException('Sesion no valida');
      if (!response.ok)
        throw new ServiceUnavailableException('Autoridad no disponible');
      const decision = (await response.json()) as Decision;
      if (
        typeof decision.allowed !== 'boolean' ||
        typeof decision.subject_id !== 'string' ||
        !decision.subject_id ||
        decision.action !== action ||
        decision.resource_id !== (resourceId ?? null) ||
        typeof decision.reason !== 'string' ||
        !Array.isArray(decision.roles) ||
        !decision.roles.every((role) => typeof role === 'string')
      )
        throw new ServiceUnavailableException('Decision invalida');
      if (!decision.allowed && action === 'steganography.result.read' && decision.reason === 'resource_not_found' && !resource)
        throw new NotFoundException('Analisis no encontrado');
      if (!decision.allowed)
        throw new ForbiddenException('Permiso insuficiente');
      this.audit.event('authorization_decision', {
        requestId,
        userId: decision.subject_id,
        action,
        allowed: true,
      });
      return decision;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      this.audit.event('authorization_unavailable', { requestId, action });
      throw new ServiceUnavailableException('Autoridad no disponible');
    } finally {
      clearTimeout(timeout);
    }
  }

  async analyze(file: Express.Multer.File, userId: string, requestId?: string) {
    this.audit.event('analysis_started', {
      requestId,
      userId,
      filename: file.originalname,
      size: file.size,
    });
    if (file.size > Number(this.config.get('MAX_FILE_BYTES', 5242880)))
      throw new PayloadTooLargeException('Archivo demasiado grande');
    const type = await fileTypeFromBuffer(file.buffer);
    if (
      !type ||
      type.mime !== 'image/png' ||
      !file.originalname.toLowerCase().endsWith('.png') ||
      file.mimetype !== 'image/png'
    )
      throw new UnsupportedMediaTypeException('Solo PNG coherente');
    let decoded: Buffer;
    let info: OutputInfo;
    try {
      const metadata = await sharp(file.buffer, {
        limitInputPixels: Number(this.config.get('MAX_PIXELS', 16000000)),
        failOn: 'error',
      }).metadata();
      // Preserve the RGB bits being measured: 16-bit, indexed, grayscale, profiled
      // and animated inputs require a different detector, not silent conversion.
      let animated = false;
      for (let offset = 8; offset + 12 <= file.buffer.length;) {
        const length = file.buffer.readUInt32BE(offset);
        if (file.buffer.toString('ascii', offset + 4, offset + 8) === 'acTL')
          animated = true;
        offset += length + 12;
      }
      if (
        file.buffer[24] !== 8 ||
        ![2, 6].includes(file.buffer[25]) ||
        metadata.hasProfile ||
        animated
      ) {
        throw new UnsupportedMediaTypeException(
          'Solo PNG RGB/RGBA de 8 bits, estatico y sin perfil ICC; se analizan los canales RGB',
        );
      }
      ({ data: decoded, info } = await sharp(file.buffer, {
        limitInputPixels: Number(this.config.get('MAX_PIXELS', 16000000)),
        failOn: 'error',
      })
        .timeout({ seconds: 5 })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }));
    } catch (error) {
      if (error instanceof UnsupportedMediaTypeException) throw error;
      const id = uuid();
      this.db
        .prepare('INSERT INTO analyses VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(
          id,
          userId,
          file.originalname,
          createHash('sha256').update(file.buffer).digest('hex'),
          'lsb_statistical_analysis',
          'error',
          JSON.stringify({ reason: 'decode_failed_or_limit_exceeded' }),
          'rechazo',
          'No se obtuvieron indicadores: imagen corrupta o limite de procesamiento.',
          new Date().toISOString(),
        );
      file.buffer.fill(0);
      this.audit.event('analysis_error', {
        requestId,
        userId,
        analysisId: id,
        reason: 'decode_failed_or_limit_exceeded',
      });
      throw new UnprocessableEntityException({
        message: 'Imagen corrupta o dimensiones invalidas',
        analysis_id: id,
      });
    }
    let ones = 0;
    let transitions = 0;
    let previous = decoded[0] & 1;
    for (let i = 0; i < decoded.length; i++) {
      const bit = decoded[i] & 1;
      ones += bit;
      if (i && bit !== previous) transitions++;
      previous = bit;
    }
    const n = decoded.length;
    const ratio = ones / n;
    const transitionRate = transitions / Math.max(1, n - 1);
    const expected = n / 2;
    const chiSquare =
      ((ones - expected) ** 2 + (n - ones - expected) ** 2) / expected;
    const anomalyScore = Number(
      (
        (Math.max(0, 1 - Math.abs(ratio - 0.5) * 2) +
          Math.max(0, 1 - Math.abs(transitionRate - 0.5) * 2)) /
        2
      ).toFixed(6),
    );
    // Compare bit plane 1 across neighboring pixels of the SAME RGB channel.
    // Interleaving different channels would mistake ordinary color gradients for noise.
    let secondOnes = 0;
    let secondTransitions = 0;
    for (let i = 0; i < n; i++) {
      secondOnes += (decoded[i] >> 1) & 1;
      if (
        i >= info.channels &&
        ((decoded[i] >> 1) & 1) !== ((decoded[i - info.channels] >> 1) & 1)
      )
        secondTransitions++;
    }
    const secondScore =
      (1 -
        Math.abs(secondOnes / n - 0.5) * 2 +
        (1 -
          Math.abs(secondTransitions / Math.max(1, n - info.channels) - 0.5) *
            2)) /
      2;
    const minimumBits = 1024;
    // Chi-square critical value for 1 degree of freedom, alpha=0.01.
    const chiSquareCritical = 6.635;
    const threshold = Number(this.config.get('LSB_THRESHOLD', 0.97));
    const inconclusiveFloor = Number(
      this.config.get('LSB_INCONCLUSIVE_FLOOR', 0.85),
    );
    const status =
      n < minimumBits
        ? 'no_concluyente'
        : anomalyScore >= threshold
          ? secondScore >= threshold || chiSquare > chiSquareCritical
            ? 'no_concluyente'
            : 'sospechoso'
          : anomalyScore >= inconclusiveFloor
            ? 'no_concluyente'
            : 'sin_indicios';
    const row = {
      id: uuid(),
      user_id: userId,
      filename: file.originalname,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
      technique: 'lsb_statistical_analysis',
      status,
      indicators: {
        width: info.width,
        height: info.height,
        channels: info.channels,
        sample_bits: n,
        lsb_one_ratio: Number(ratio.toFixed(6)),
        transition_rate: Number(transitionRate.toFixed(6)),
        chi_square: Number(chiSquare.toFixed(6)),
        chi_square_critical: chiSquareCritical,
        minimum_bits: minimumBits,
        reference_bit_score: Number(secondScore.toFixed(6)),
        anomaly_score: anomalyScore,
        threshold,
        inconclusive_floor: inconclusiveFloor,
      },
      action: status === 'sospechoso' ? 'rechazo' : 'advertencia',
      limitations:
        'Heuristica RGB-LSB de 8 bits, no probabilidad de esteganografia. Muestras pequenas y ruido ambiguo son no concluyentes. Puede omitir cargas dispersas y producir falsos positivos; no analiza alfa.',
      created_at: new Date().toISOString(),
    };
    this.db
      .prepare(
        'INSERT INTO analyses VALUES(@id,@user_id,@filename,@sha256,@technique,@status,@indicators,@action,@limitations,@created_at)',
      )
      .run({ ...row, indicators: JSON.stringify(row.indicators) });
    file.buffer.fill(0);
    decoded.fill(0);
    this.audit.event('analysis_completed', {
      requestId,
      userId,
      analysisId: row.id,
      status,
      action: row.action,
      anomalyScore,
    });
    return row;
  }

  get(id: string, subject: string, isAdmin: boolean) {
    const row = this.db.prepare('SELECT * FROM analyses WHERE id=?').get(id) as
      Record<string, string> | undefined;
    if (!row) throw new NotFoundException('Analisis no encontrado');
    if (row.user_id !== subject && !isAdmin)
      throw new ForbiddenException('Recurso ajeno');
    return { ...row, indicators: JSON.parse(row.indicators) };
  }
  onModuleDestroy() {
    this.close();
  }
  close() {
    this.db.close();
  }
}
