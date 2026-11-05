import { RoleResponseDto } from '../common/response.dto';
import { ApiErrors } from '../common/api-errors';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  ParseUUIDPipe,
  Req,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';
@ApiTags('roles')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 404, 409, 429, 500)
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class RolesController {
  constructor(private readonly s: RolesService) {}
  @ApiCreatedResponse({ type: RoleResponseDto }) @Post() create(
    @Body() d: CreateRoleDto,
    @Req() req: any,
  ) {
    return this.s.create(d, {
      actorId: req.user.sub,
      requestId: req.requestId,
    });
  }
  @ApiOkResponse({ type: RoleResponseDto, isArray: true }) @Get() all() {
    return this.s.findAll();
  }
  @ApiOkResponse({ type: RoleResponseDto }) @Patch(':id') update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: UpdateRoleDto,
    @Req() req: any,
  ) {
    return this.s.update(id, d, {
      actorId: req.user.sub,
      requestId: req.requestId,
    });
  }
}
