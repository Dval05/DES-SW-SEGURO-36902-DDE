import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { StegoService } from './stego.service.js';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly service: StegoService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const action = req.method === 'POST' ? 'steganography.analyze' : 'steganography.result.read';
    req.decision = await this.service.authorize(req.rawToken, action, req.params.id, req.requestId);
    return true;
  }
}
