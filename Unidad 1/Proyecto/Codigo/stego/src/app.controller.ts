import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller()
export class AppController {
  @Get()
  @Redirect()
  @ApiExcludeEndpoint()
  openDocs() {
    return { url: '/docs' };
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'stego' };
  }
}
