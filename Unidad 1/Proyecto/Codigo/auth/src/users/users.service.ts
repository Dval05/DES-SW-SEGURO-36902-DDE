import * as argon2 from 'argon2';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto'; import { UpdateUserDto } from './dto/update-user.dto'; import { User } from './entities/user.entity';
@Injectable() export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}
  async create(dto: CreateUserDto) { const { password, ...data } = dto; try { return await this.repo.save(this.repo.create({ ...data, passwordHash: await argon2.hash(password, { type: argon2.argon2id }) })); } catch (e: any) { if (e?.code === '23505') throw new ConflictException('username, email o cedula ya existe'); throw e; } }
  findAll() { return this.repo.find({ order: { fechaCreacion: 'DESC' } }); }
  async findOne(id: string) { const u = await this.repo.findOne({ where: { id } }); if (!u) throw new NotFoundException('Usuario no encontrado'); return u; }
  findForLogin(identity: string) { return this.repo.createQueryBuilder('u').addSelect('u.passwordHash').where('(u.username = :identity OR u.email = :identity)', { identity }).andWhere('u.estado = true').andWhere('u.fechaEliminacion IS NULL').getOne(); }
  findForToken(id: string) { return this.repo.findOne({ where: { id, estado: true } }); }
  async update(id: string, dto: UpdateUserDto) { const u = await this.findOne(id); const { password, ...data } = dto; Object.assign(u, data); if (password) u.passwordHash = await argon2.hash(password, { type: argon2.argon2id }); return this.repo.save(u); }
  async incrementTokenVersion(id: string) { await this.repo.increment({ id }, 'tokenVersion', 1); }
}
