// src/email/entities/oauth-credential.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('oauth_credentials')
export class OAuthCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  provider: string;

  @Column()
  accessToken: string;

  @Column({ nullable: true })
  refreshToken: string;

  @Column()
  @Index()
  expiresAt: Date;

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
