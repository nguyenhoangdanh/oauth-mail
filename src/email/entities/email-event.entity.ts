// src/email/entities/email-event.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

// Define event enum to match database enum type - make sure to use string values
export enum EmailEventType {
  SENT = 'sent',
  DELIVERED = 'delivered',
  OPENED = 'opened',
  CLICKED = 'clicked',
  BOUNCED = 'bounced',
  COMPLAINED = 'complained',
  FAILED = 'failed',
}

@Entity('email_events')
export class EmailEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  emailId: string;

  @Column({
    type: 'enum',
    enum: EmailEventType,
  })
  @Index()
  event: EmailEventType;

  @Column()
  recipient: string;

  @Column()
  timestamp: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
