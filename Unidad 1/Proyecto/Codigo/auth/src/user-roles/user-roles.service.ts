import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../common/audit.service';
import { AuditContext } from '../common/audit-context';
import { rethrowDatabaseError } from '../common/database-error';
import { CreateUserRoleDto } from './dto/create-user-role.dto';
import { UserRole } from './entities/user-role.entity';
@Injectable()
export class UserRolesService {
  constructor(
    @InjectRepository(UserRole) private readonly repo: Repository<UserRole>,
    private readonly audit: AuditService,
  ) {}
  async create(dto: CreateUserRoleDto, context: AuditContext = {}) {
    try {
      const assignment = await this.repo.save(this.repo.create(dto));
      this.audit.event('role_assigned', {
        ...context,
        assignmentId: assignment.id,
        targetUserId: dto.userId,
        targetRoleId: dto.roleId,
      });
      return assignment;
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
  findAll() {
    return this.repo.find({ relations: { user: true, role: true } });
  }
  async remove(id: string, context: AuditContext = {}) {
    const assignment = await this.repo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Asignacion no encontrada');
    await this.repo.remove(assignment);
    this.audit.event('role_revoked', {
      ...context,
      assignmentId: id,
      targetUserId: assignment.userId,
      targetRoleId: assignment.roleId,
    });
    return { deleted: true };
  }
  async activeRoles(userId: string) {
    const rows = await this.repo
      .createQueryBuilder('ur')
      .innerJoinAndSelect(
        'ur.role',
        'role',
        'role.estado = true AND role.fechaEliminacion IS NULL',
      )
      .where('ur.userId = :userId', { userId })
      .getMany();
    return rows.map((row) => row.role.rol);
  }
}
