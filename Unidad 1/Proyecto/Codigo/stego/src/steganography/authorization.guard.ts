import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ParseUUIDPipe,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StegoService } from './stego.service.js';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly service: StegoService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const action =
      req.method === 'POST'
        ? 'steganography.analyze'
        : 'steganography.result.read';
    if (req.params.id !== undefined)
      await new ParseUUIDPipe().transform(req.params.id, {
        type: 'param',
        metatype: String,
        data: 'id',
      });
    req.decision = await this.service.authorize(
      req.rawToken,
      action,
      req.params.id,
      req.requestId,
    );
    if (req.decision.subject_id !== req.user.sub)
      throw new ServiceUnavailableException(
        'Identidad de decision inconsistente',
      );
    return true;
  }
}
