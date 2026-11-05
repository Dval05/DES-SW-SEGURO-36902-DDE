import { Injectable, Logger } from '@nestjs/common';
const FIELDS = new Set([
  'actorId',
  'requestId',
  'targetUserId',
  'targetRoleId',
  'assignmentId',
  'roleName',
  'changedFields',
  'credentialsChanged',
  'sessionsRevoked',
  'userId',
  'action',
  'allowed',
  'reason',
  'identity_hint',
  'analysisId',
  'filename',
  'size',
  'status',
  'anomalyScore',
  'method',
  'path',
]);
function clean(value: unknown): unknown {
  if (typeof value === 'string')
    return value
      .replace(/Bearer\s+\S+/gi, '[REDACTED]')
      .replace(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g,
        '[REDACTED]',
      )
      .slice(0, 512);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 30).map(clean);
  return undefined;
}
export function serializeAuditEvent(
  event: string,
  data: Record<string, unknown> = {},
) {
  const safe = Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => FIELDS.has(key))
      .map(([key, value]) => [key, clean(value)]),
  );
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...safe,
  });
}
@Injectable()
export class AuditService {
  private readonly logger = new Logger('AUDIT');
  event(event: string, data: Record<string, unknown> = {}) {
    this.logger.log(serializeAuditEvent(event, data));
  }
}
