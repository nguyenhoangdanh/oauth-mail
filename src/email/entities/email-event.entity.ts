// entities/email-event.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('email_events')
export class EmailEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  emailId: string;

  @Column()
  event: string;

  @Column({ nullable: true })
  recipient: string;

  @Column()
  timestamp: Date;

  @Column({ type: 'json', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
