import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException, UnsupportedMediaTypeException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { fileTypeFromBuffer } from 'file-type';
import sharp, { type OutputInfo } from 'sharp';
import { v4 as uuid } from 'uuid';
import { AuditService } from '../common/audit.service.js';

type Decision = { subject_id: string; action: string; allowed: boolean; reason: string; roles: string[] };

@Injectable()
export class StegoService {
  private readonly db: Database.Database;
  constructor(private readonly config: ConfigService, private readonly audit: AuditService) {
    const path = config.get('STEGO_DB_PATH', './data/stego.db');
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.exec('CREATE TABLE IF NOT EXISTS analyses(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,filename TEXT NOT NULL,sha256 TEXT NOT NULL,technique TEXT NOT NULL,status TEXT NOT NULL,indicators TEXT NOT NULL,action TEXT NOT NULL,limitations TEXT NOT NULL,created_at TEXT NOT NULL)');
  }

  async authorize(token: string, action: 'steganography.analyze' | 'steganography.result.read', resourceId?: string, requestId?: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(this.config.get('AUTH_TIMEOUT_MS', 3000)));
    try {
      const response = await fetch(`${this.config.getOrThrow('AUTH_INTERNAL_URL')}/internal/authorization/check`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-service-token': this.config.getOrThrow('STEGO_SERVICE_TOKEN'), 'x-request-id': requestId ?? '' },
        body: JSON.stringify({ subject_token: token, action, resource_id: resourceId ?? null }), signal: controller.signal,
      });
      if (response.status === 401) throw new UnauthorizedException('Sesion no valida');
      if (!response.ok) throw new ServiceUnavailableException('Autoridad no disponible');
      const decision = await response.json() as Decision;
      if (typeof decision.allowed !== 'boolean' || !decision.subject_id || decision.action !== action) throw new ServiceUnavailableException('Decision invalida');
      if (!decision.allowed) throw new ForbiddenException('Permiso insuficiente');
      this.audit.event('authorization_decision',{requestId,userId:decision.subject_id,action,allowed:true});
      return decision;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException || error instanceof ServiceUnavailableException) throw error;
      this.audit.event('authorization_unavailable',{requestId,action}); throw new ServiceUnavailableException('Autoridad no disponible');
    } finally { clearTimeout(timeout); }
  }

  async analyze(file: Express.Multer.File, userId: string, requestId?: string) {
    this.audit.event('analysis_started',{requestId,userId,filename:file.originalname,size:file.size});
    const type = await fileTypeFromBuffer(file.buffer);
    if (!type || type.mime !== 'image/png' || !file.originalname.toLowerCase().endsWith('.png') || file.mimetype !== 'image/png') throw new UnsupportedMediaTypeException('Solo PNG coherente');
    let decoded: Buffer; let info: OutputInfo;
    try {
      ({ data: decoded, info } = await sharp(file.buffer, { limitInputPixels: Number(this.config.get('MAX_PIXELS', 16000000)), failOn: 'error' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
    } catch { throw new UnprocessableEntityException('Imagen corrupta o dimensiones invalidas'); }
    let ones = 0; let transitions = 0; let previous = decoded[0] & 1;
    for (let i = 0; i < decoded.length; i++) { const bit = decoded[i] & 1; ones += bit; if (i && bit !== previous) transitions++; previous = bit; }
    const n = decoded.length; const ratio = ones / n; const transitionRate = transitions / Math.max(1, n - 1); const expected = n / 2;
    const chiSquare = ((ones - expected) ** 2 + (n - ones - expected) ** 2) / expected;
    const anomalyScore = Number(((Math.max(0, 1 - Math.abs(ratio - .5) * 2) + Math.max(0, 1 - Math.abs(transitionRate - .5) * 2)) / 2).toFixed(6));
    const threshold = Number(this.config.get('LSB_THRESHOLD', .97)); const inconclusiveFloor=Number(this.config.get('LSB_INCONCLUSIVE_FLOOR',.85)); const status = anomalyScore >= threshold ? 'sospechoso' : anomalyScore >= inconclusiveFloor ? 'no_concluyente' : 'sin_indicios';
    const row = { id: uuid(), user_id: userId, filename: file.originalname, sha256: createHash('sha256').update(file.buffer).digest('hex'), technique: 'lsb_statistical_analysis', status,
      indicators: { width: info.width, height: info.height, channels: info.channels, sample_bits: n, lsb_one_ratio: Number(ratio.toFixed(6)), transition_rate: Number(transitionRate.toFixed(6)), chi_square: Number(chiSquare.toFixed(6)), anomaly_score: anomalyScore, threshold },
      action: status === 'sospechoso' ? 'cuarentena' : 'advertencia', limitations: 'Indicio estadistico LSB; no detecta todas las tecnicas y puede producir falsos positivos o negativos.', created_at: new Date().toISOString() };
    this.db.prepare('INSERT INTO analyses VALUES(@id,@user_id,@filename,@sha256,@technique,@status,@indicators,@action,@limitations,@created_at)').run({ ...row, indicators: JSON.stringify(row.indicators) });
    this.audit.event('analysis_completed',{requestId,userId,analysisId:row.id,status,action:row.action,anomalyScore});
    return row;
  }

  get(id: string, subject: string, isAdmin: boolean) {
    const row = this.db.prepare('SELECT * FROM analyses WHERE id=?').get(id) as Record<string, string> | undefined;
    if (!row) throw new NotFoundException('Analisis no encontrado');
    if (row.user_id !== subject && !isAdmin) throw new ForbiddenException('Recurso ajeno');
    return { ...row, indicators: JSON.parse(row.indicators) };
  }
  close(){this.db.close()}
}
