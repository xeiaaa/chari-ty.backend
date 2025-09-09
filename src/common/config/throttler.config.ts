import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

export const getThrottlerConfig = (
  configService: ConfigService,
): ThrottlerModuleOptions => {
  const nodeEnv = configService.get<string>('NODE_ENV');

  // Disable rate limiting in development and test environments
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return {
      throttlers: [],
    };
  }

  return {
    throttlers: [
      // Default throttler for general endpoints
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ],
  };
};
