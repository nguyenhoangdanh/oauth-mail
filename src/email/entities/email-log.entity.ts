// src/email/entities/email-log.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  emailId: string;

  @Column()
  to: string;

  @Column({ nullable: true })
  name: string;

  @Column()
  subject: string;

  @Column()
  template: string;

  @Column({ type: 'json', default: {} })
  context: Record<string, any>;

  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true })
  messageId: string;

  @Column({ default: 0 })
  attempts: number;

  @Column({ nullable: true })
  error: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  sentAt: Date;

  @Column({ nullable: true })
  lastStatusAt: Date;

  @Column({ nullable: true })
  openedAt: Date;

  @Column({ nullable: true })
  clickedAt: Date;

  @Column({ nullable: true })
  clickUrl: string;

  @Column({ nullable: true })
  bounceReason: string;

  @Column({ default: 0 })
  openCount: number;

  @Column({ default: 0 })
  clickCount: number;
  
  @Column({ nullable: true })
  @Index()
  campaignId: string;
  
  @Column({ nullable: true })
  @Index()
  batchId: string;
  
  @Column({ nullable: true })
  resendId: string;
  
  @Column({ nullable: true })
  ipAddress: string;
  
  @Column({ nullable: true })
  userAgent: string;
  
  @Column({ nullable: true })
  location: string;
  
  @Column({ nullable: true })
  device: string;
  
  @Column({ type: 'json', nullable: true })
  tags: string[];
  
  @Column({ nullable: true })
  @Index()
  userId: string;
  
  @Column({ nullable: true })
  complaintReason: string;
  
  @Column({ default: false })
  isTest: boolean;
}