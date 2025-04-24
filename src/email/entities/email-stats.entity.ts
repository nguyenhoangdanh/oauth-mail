// entities/email-stats.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('email_stats')
export class EmailStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  date: Date;

  @Column({ default: 0 })
  sent: number;

  @Column({ default: 0 })
  delivered: number;

  @Column({ default: 0 })
  opened: number;

  @Column({ default: 0 })
  clicked: number;

  @Column({ default: 0 })
  bounced: number;

  @Column({ default: 0 })
  complained: number;

  @Column({ default: 0 })
  failed: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
