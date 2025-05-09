// src/users/entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import bcrypt from 'bcrypt';
import { UserOAuth } from './user-oauth.entity';
import { Session } from './session.entity';
import { Token } from './token.entity';
import { OrganizationMembership } from 'src/organizations/entities/organization-membership.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  // @Column({ select: false, insert: false, update: false })
  skipPasswordHashing?: boolean;

  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ type: 'simple-array', default: 'user' })
  roles: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  lockedUntil: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserOAuth, (oauth) => oauth.user)
  oauthConnections: UserOAuth[];

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  @OneToMany(() => Token, (token) => token.user)
  tokens: Token[];

  // Add this to the User entity
  @OneToMany(() => OrganizationMembership, (membership) => membership.user)
  organizationMemberships: OrganizationMembership[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    // Thêm log để debug
    console.log('hashPassword hook triggered');
    console.log('skipPasswordHashing flag:', this.skipPasswordHashing);
    console.log(
      'Current password (partial):',
      this.password ? this.password.substring(0, 10) + '...' : 'null',
    );

    // Kiểm tra kỹ điều kiện
    if (this.password && !this.skipPasswordHashing) {
      const originalPassword = this.password;
      this.password = await bcrypt.hash(this.password, 10);
      console.log(
        'Password hashed from:',
        originalPassword.length,
        'chars to:',
        this.password.length,
        'chars',
      );
    } else {
      console.log(
        'Skipping password hashing, reason:',
        !this.password ? 'no password' : 'skipPasswordHashing flag',
      );
    }
  }
  // Trong User entity - phương thức comparePassword
  async comparePassword(attempt: string): Promise<boolean> {
    try {
      // Thêm kiểm tra đầu vào
      if (!this.password) {
        console.log('ERROR: User has no stored password');
        return false;
      }

      if (!attempt) {
        console.log('ERROR: Empty password attempt');
        return false;
      }

      // So sánh
      const isMatch = await bcrypt.compare(attempt, this.password);
      console.log('Bcrypt compare result:', isMatch);

      return isMatch;
    } catch (error) {
      console.error('Error in comparePassword:', error);
      // Ghi log lỗi nhưng không throw để tránh crash
      return false;
    }
  }
}
