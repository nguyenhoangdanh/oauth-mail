// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<User | undefined> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * Find a user by ID
   */
  async findById(id: string): Promise<User | undefined> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create new user
    const user = this.userRepository.create({
      ...createUserDto,
      // Password will be hashed by @BeforeInsert hook in the entity
    });

    return this.userRepository.save(user);
  }

  /**
   * Update a user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If email is being updated, check if new email is already in use
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Update user
    await this.userRepository.update(id, updateUserDto);

    return this.findById(id);
  }

  /**
   * Change user password
   */
  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Update password
    user.password = newPassword; // Will be hashed by @BeforeUpdate hook
    await this.userRepository.save(user);
  }

  /**
   * Delete a user
   */
  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.delete(id);
  }

  /**
   * Search users
   */
  async search(query: string, page = 1, limit = 10): Promise<[User[], number]> {
    const skip = (page - 1) * limit;

    return this.userRepository.findAndCount({
      where: [
        { email: query ? Like(`%${query}%`) : undefined },
        { fullName: query ? Like(`%${query}%`) : undefined },
      ],
      skip,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Set user roles
   */
  async setRoles(id: string, roles: string[]): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.roles = roles;
    return this.userRepository.save(user);
  }
}
