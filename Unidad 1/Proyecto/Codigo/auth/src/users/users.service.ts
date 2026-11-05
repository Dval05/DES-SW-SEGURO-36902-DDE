import * as argon2 from 'argon2';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../common/audit.service';
import { AuditContext } from '../common/audit-context';
import { rethrowDatabaseError } from '../common/database-error';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly audit: AuditService,
  ) {}
  async create(dto: CreateUserDto, context: AuditContext = {}) {
    const { password, ...data } = dto;
    try {
      const user = await this.repo.save(
        this.repo.create({
          ...data,
          passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        }),
      );
      this.audit.event('user_created', {
        ...context,
        actorId: context.actorId ?? 'system',
        targetUserId: user.id,
      });
      return user;
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
  findAll() {
    return this.repo.find({ order: { fechaCreacion: 'DESC' } });
  }
  async findOne(id: string) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }
  findForLogin(identity: string) {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('(u.username = :identity OR u.email = :identity)', { identity })
      .andWhere('u.estado = true')
      .andWhere('u.fechaEliminacion IS NULL')
      .getOne();
  }
  findForToken(id: string) {
    return this.repo.findOne({ where: { id, estado: true } });
  }
  async update(id: string, dto: UpdateUserDto, context: AuditContext = {}) {
    const user = await this.findOne(id);
    const { password, ...data } = dto;
    const revoke =
      password !== undefined ||
      (data.estado !== undefined && data.estado !== user.estado);
    try {
      // Update only submitted columns and increment atomically: simultaneous password changes
      // or logout must never restore an earlier token version.
      const patch: any = { ...data };
      if (password !== undefined)
        patch.passwordHash = await argon2.hash(password, {
          type: argon2.argon2id,
        });
      if (revoke) patch.tokenVersion = () => '"token_version" + 1';
      if (Object.keys(patch).length) await this.repo.update(id, patch);
      const updated = await this.findOne(id);
      this.audit.event('user_updated', {
        ...context,
        targetUserId: id,
        changedFields: Object.keys(data),
        credentialsChanged: password !== undefined,
        sessionsRevoked: revoke,
      });
      return updated;
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
  async incrementTokenVersion(id: string) {
    await this.repo.increment({ id }, 'tokenVersion', 1);
  }
}
