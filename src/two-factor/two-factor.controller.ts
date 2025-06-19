// src/two-factor/two-factor.controller.ts
// Kiểm tra và sửa lỗi liên quan đến userId

import { Body, Controller, Get, Post, UseGuards, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from 'src/users/entities/user.entity';
import { TwoFactorService } from './two-factor.service';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { DisableTwoFactorDto } from './dto/disable-two-factor.dto';

@ApiTags('two-factor')
@Controller('two-factor')
export class TwoFactorController {
  private readonly logger = new Logger(TwoFactorController.name);

  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Post('enable')
  @UseGuards(JwtAuthGuard)
  async enableTwoFactor(@GetUser() user: User) {
    // Thêm logging để debug
    this.logger.debug(
      `EnableTwoFactor called for user: ${JSON.stringify(user)}`,
    );

    if (!user || !user.id) {
      this.logger.error('User or user.id is missing in request');
      throw new Error('User information is required for 2FA setup');
    }

    return this.twoFactorService.generateSecret(user.id);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verifyAndEnableTwoFactor(
    @Body() verifyDto: VerifyTwoFactorDto,
    @GetUser() user: User,
  ) {
    this.logger.debug(`VerifyAndEnableTwoFactor called for user: ${user.id}`);

    if (!user || !user.id) {
      this.logger.error('User or user.id is missing in request');
      throw new Error('User information is required for 2FA verification');
    }

    await this.twoFactorService.verifyAndEnable(user.id, verifyDto.token);
    return {
      success: true,
      message: 'Two-factor authentication enabled successfully',
    };
  }

  @Post('disable')
  @UseGuards(JwtAuthGuard)
  async disableTwoFactor(
    @Body() disableDto: DisableTwoFactorDto,
    @GetUser() user: User,
  ) {
    this.logger.debug(`DisableTwoFactor called for user: ${user.id}`);

    if (!user || !user.id) {
      this.logger.error('User or user.id is missing in request');
      throw new Error('User information is required to disable 2FA');
    }

    await this.twoFactorService.disable(user.id, disableDto.password);
    return {
      success: true,
      message: 'Two-factor authentication disabled successfully',
    };
  }

  @Get('backup-codes')
  @UseGuards(JwtAuthGuard)
  async getBackupCodes(@GetUser() user: User) {
    this.logger.debug(`GetBackupCodes called for user: ${user.id}`);

    if (!user || !user.id) {
      this.logger.error('User or user.id is missing in request');
      throw new Error('User information is required to retrieve backup codes');
    }

    const backupCodes = await this.twoFactorService.getBackupCodes(user.id);
    return { backupCodes };
  }

  @Post('regenerate-backup-codes')
  @UseGuards(JwtAuthGuard)
  async regenerateBackupCodes(@GetUser() user: User) {
    this.logger.debug(`RegenerateBackupCodes called for user: ${user.id}`);

    if (!user || !user.id) {
      this.logger.error('User or user.id is missing in request');
      throw new Error(
        'User information is required to regenerate backup codes',
      );
    }

    const backupCodes = await this.twoFactorService.regenerateBackupCodes(
      user.id,
    );
    return { backupCodes };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getTwoFactorStatus(@GetUser() user: User) {
    this.logger.debug(`GetTwoFactorStatus called for user: ${user.id}`);

    if (!user || !user.id) {
      this.logger.error('User or user.id is missing in request');
      throw new Error('User information is required to check 2FA status');
    }

    const isEnabled = await this.twoFactorService.isTwoFactorEnabled(user.id);
    return { enabled: isEnabled };
  }
}
