import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../common/audit.service';
import { AuditContext } from '../common/audit-context';
import { rethrowDatabaseError } from '../common/database-error';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities/role.entity';
const BUILT_IN = ['ADMIN', 'ANALYST', 'USER'];
@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly repo: Repository<Role>,
    private readonly audit: AuditService,
  ) {}
  async create(dto: CreateRoleDto, context: AuditContext = {}) {
    try {
      const role = await this.repo.save(this.repo.create(dto));
      this.audit.event('role_created', {
        ...context,
        targetRoleId: role.id,
        roleName: role.rol,
      });
      return role;
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
  findAll() {
    return this.repo.find();
  }
  async findOne(id: string) {
    const role = await this.repo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }
  async update(id: string, dto: UpdateRoleDto, context: AuditContext = {}) {
    const role = await this.findOne(id);
    if (
      dto.rol !== undefined &&
      dto.rol !== role.rol &&
      (BUILT_IN.includes(role.rol) || BUILT_IN.includes(dto.rol))
    ) {
      throw new BadRequestException(
        'No se puede renombrar un rol integrado ni convertir otro rol en uno integrado',
      );
    }
    try {
      if (Object.keys(dto).length) await this.repo.update(id, dto);
      const updated = await this.findOne(id);
      this.audit.event('role_updated', {
        ...context,
        targetRoleId: id,
        changedFields: Object.keys(dto),
      });
      return updated;
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
}
