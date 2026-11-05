import { AuditService } from '../../audit.service';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly audit: AuditService) {}
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Error interno';
    this.audit.event('request_denied', {
      actorId: request.user?.sub,
      requestId: request.requestId,
      status,
      method: request.method,
      path: request.url.split('?')[0],
    });
    response
      .status(status)
      .json({
        statusCode: status,
        error: detail,
        path: request.url,
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      });
  }
}
