// src/webhook/entities/webhook-subscription.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import * as crypto from 'crypto';

@Entity('webhook_subscriptions')
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column()
  event: string;

  @Column()
  endpoint: string;

  @Column()
  secret: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  failedAttempts: number;

  @Column({ nullable: true })
  lastFailure: Date;

  @Column({ nullable: true })
  lastSuccess: Date;

  @Column({ type: 'json', default: {} })
  headers: Record<string, string>;

  @Column({ nullable: true })
  lastErrorMessage: string;

  @Column({ default: 0 })
  successCount: number;

  @Column({ default: 5 })
  maxRetries: number;

  @Column({ default: 30 })
  timeout: number;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  @Index()
  userId: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ default: 'POST' })
  method: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateSecretIfNotProvided() {
    if (!this.secret) {
      this.secret = crypto.randomBytes(32).toString('hex');
    }
  }
}
