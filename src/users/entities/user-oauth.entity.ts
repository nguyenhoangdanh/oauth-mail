// src/auth/entities/user-oauth.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_oauth')
export class UserOAuth {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  provider: string; // 'google', 'facebook', 'github'

  @Column()
  providerId: string;

  @Column({ nullable: true })
  accessToken: string;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ type: 'json', nullable: true })
  profile: any;

  @ManyToOne(() => User, (user) => user.oauthConnections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
