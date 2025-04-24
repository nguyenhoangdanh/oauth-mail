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
  
    @Column({ type: 'text' })
    accessToken: string;
  
    @Column({ type: 'text' })
    refreshToken: string;
  
    @Column()
    expiresAt: Date;
  
    @Column({ default: true })
    isActive: boolean;
  
    @Column({ nullable: true, type: 'json' })
    metadata: Record<string, any>;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }