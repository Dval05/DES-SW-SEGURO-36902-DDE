import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuditService } from './audit.service.js';
@Catch()
export class AuditExceptionFilter implements ExceptionFilter {
  constructor(private readonly audit: AuditService) {}
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Error interno';
    this.audit.event('request_denied', {
      requestId: req.requestId,
      userId: req.user?.sub,
      status,
      method: req.method,
      path: req.url.split('?')[0],
    });
    res
      .status(status)
      .json({
        statusCode: status,
        error: detail,
        path: req.url,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
  }
}
