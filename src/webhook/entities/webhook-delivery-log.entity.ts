// src/webhook/entities/webhook-delivery-log.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('webhook_delivery_logs')
export class WebhookDeliveryLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  webhookId: string;

  @Column()
  event: string;

  @Column({ type: 'json' })
  payload: Record<string, any>;

  @Column({ default: 1 })
  attempt: number;

  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true })
  statusCode: number;

  @Column({ nullable: true, type: 'text' })
  response: string;

  @Column({ nullable: true, type: 'text' })
  error: string;

  @Column({ nullable: true })
  duration: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ nullable: true })
  @Index()
  emailId: string;
}
