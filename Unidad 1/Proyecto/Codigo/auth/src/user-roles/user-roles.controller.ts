import {
  AssignmentResponseDto,
  DeleteAssignmentResponseDto,
} from '../common/response.dto';
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
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateUserRoleDto } from './dto/create-user-role.dto';
import { UserRolesService } from './user-roles.service';
@ApiTags('user-roles')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 404, 409, 429, 500)
@Controller('user-roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UserRolesController {
  constructor(private readonly s: UserRolesService) {}
  @ApiCreatedResponse({ type: AssignmentResponseDto }) @Post() create(
    @Body() d: CreateUserRoleDto,
    @Req() req: any,
  ) {
    return this.s.create(d, {
      actorId: req.user.sub,
      requestId: req.requestId,
    });
  }
  @ApiOkResponse({ type: AssignmentResponseDto, isArray: true }) @Get() all() {
    return this.s.findAll();
  }
  @ApiOkResponse({ type: DeleteAssignmentResponseDto }) @Delete(':id') remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    return this.s.remove(id, {
      actorId: req.user.sub,
      requestId: req.requestId,
    });
  }
}
