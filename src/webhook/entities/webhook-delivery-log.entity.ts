// src/webhook/entities/webhook-delivery-log.entity.ts
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
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
  
    @Column()
    attempt: number;
  
    @Column({ default: 'pending' })
    status: 'pending' | 'success' | 'failed';
  
    @Column({ nullable: true })
    statusCode: number;
  
    @Column({ type: 'text', nullable: true })
    response: string;
  
    @Column({ type: 'text', nullable: true })
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