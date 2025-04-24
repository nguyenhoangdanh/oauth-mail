// src/email/entities/email-template.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('email_templates')
export class EmailTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  name: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 'html' })
  format: string;

  @Column({ nullable: true })
  description: string;
  
  @Column({ nullable: true })
  subject: string;
  
  @Column({ nullable: true })
  category: string;
  
  @Column({ type: 'json', default: {} })
  variables: Record<string, any>;
  
  @Column({ nullable: true })
  previewText: string;
  
  @Column({ nullable: true })
  thumbnailUrl: string;
  
  @Column({ default: 0 })
  version: number;
  
  @Column({ nullable: true })
  lastEditor: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}