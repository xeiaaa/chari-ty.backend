import {
  Controller,
  Get,
  Post,
  Body,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Public, AuthUser } from '../../common/decorators';
import { UsersService } from '../users/users.service';
import { OnboardingService } from './onboarding.service';
import { User as UserEntity } from '../../../generated/prisma';
import { OnboardingDto } from './dtos/onboarding.dto';

/**
 * AuthController handles authentication-related HTTP requests
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly onboardingService: OnboardingService,
  ) {}

  /**
   * Get current authenticated user's data
   * GET /api/v1/auth/me
   */
  @Get('me')
  getCurrentUser(@AuthUser() user: UserEntity): UserEntity {
    // User is already fetched from database by AuthGuard
    return user;
  }

  /**
   * Complete user onboarding
   * POST /api/v1/auth/onboarding
   */
  @Post('onboarding')
  async completeOnboarding(
    @AuthUser() user: UserEntity,
    @Body() onboardingData: OnboardingDto,
  ): Promise<{
    message: string;
    user: UserEntity;
    group?: any;
    groupMember?: any;
  }> {
    try {
      const result = await this.onboardingService.completeOnboarding(
        user.clerkId,
        onboardingData,
      );

      return {
        message: 'Onboarding completed successfully',
        user: result.user,
        group: result.group,
        groupMember: result.groupMember,
      };
    } catch (error) {
      if (error.message === 'User not found in database') {
        throw new NotFoundException(error.message);
      }
      if (error.message === 'User has already completed onboarding') {
        throw new ConflictException(error.message);
      }
      if (error.message === 'Invalid account type') {
        throw new BadRequestException(error.message);
      }

      // Log unexpected errors and throw generic error
      console.error('Onboarding error:', error);
      throw new BadRequestException('Failed to complete onboarding');
    }
  }

  /**
   * Admin test endpoint for smoke testing
   */
  @Public()
  @Get('admin/test')
  adminTest(): { message: string; timestamp: string } {
    return {
      message: 'Auth module is working correctly',
      timestamp: new Date().toISOString(),
    };
  }
}
