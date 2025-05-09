// two-factor.controller.ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Post('enable')
  @UseGuards(JwtAuthGuard)
  async enableTwoFactor(@GetUser() user: User) {
    return this.twoFactorService.generateSecret(user.id);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verifyAndEnableTwoFactor(
    @Body() verifyDto: VerifyTwoFactorDto,
    @GetUser() user: User,
  ) {
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
    await this.twoFactorService.disable(user.id, disableDto.password);
    return {
      success: true,
      message: 'Two-factor authentication disabled successfully',
    };
  }

  @Get('backup-codes')
  @UseGuards(JwtAuthGuard)
  async getBackupCodes(@GetUser() user: User) {
    const backupCodes = await this.twoFactorService.getBackupCodes(user.id);
    return { backupCodes };
  }

  @Post('regenerate-backup-codes')
  @UseGuards(JwtAuthGuard)
  async regenerateBackupCodes(@GetUser() user: User) {
    const backupCodes = await this.twoFactorService.regenerateBackupCodes(
      user.id,
    );
    return { backupCodes };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getTwoFactorStatus(@GetUser() user: User) {
    const isEnabled = await this.twoFactorService.isTwoFactorEnabled(user.id);
    return { enabled: isEnabled };
  }
}
