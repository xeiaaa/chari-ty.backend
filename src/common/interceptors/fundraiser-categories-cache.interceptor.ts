import { Injectable, ExecutionContext } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { Request } from 'express';

/**
 * Cache interceptor for fundraiser categories
 * Key: cache:public:fundraisers:categories
 * TTL: 1d (86400s)
 */
@Injectable()
export class FundraiserCategoriesCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const request: Request | undefined = context
      .switchToHttp()
      .getRequest<Request>();
    if (!request || request.method !== 'GET') {
      return undefined;
    }
    return 'cache:public:fundraisers:categories';
  }
}
