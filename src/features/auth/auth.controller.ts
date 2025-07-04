import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators';

/**
 * AuthController handles authentication-related HTTP requests
 */
@Controller('auth')
export class AuthController {
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
