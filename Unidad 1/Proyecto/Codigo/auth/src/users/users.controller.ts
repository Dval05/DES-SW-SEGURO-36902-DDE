import { PublicUserDto } from '../common/response.dto';
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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
@ApiTags('users')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 404, 409, 429, 500)
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @ApiCreatedResponse({ type: PublicUserDto }) @Post() create(
    @Body() d: CreateUserDto,
    @Req() req: any,
  ) {
    return this.service.create(d, {
      actorId: req.user.sub,
      requestId: req.requestId,
    });
  }
  @ApiOkResponse({ type: PublicUserDto, isArray: true }) @Get() all() {
    return this.service.findAll();
  }
  @ApiOkResponse({ type: PublicUserDto }) @Get(':id') one(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findOne(id);
  }
  @ApiOkResponse({ type: PublicUserDto }) @Patch(':id') update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: UpdateUserDto,
    @Req() req: any,
  ) {
    return this.service.update(id, d, {
      actorId: req.user.sub,
      requestId: req.requestId,
    });
  }
}
