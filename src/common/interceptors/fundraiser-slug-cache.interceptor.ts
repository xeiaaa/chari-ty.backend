import { Injectable, ExecutionContext } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { Request } from 'express';

/**
 * Cache interceptor for fundraiser by slug
 * Key: cache:public:fundraiser:slug:{slug}
 * TTL: 60s
 */
@Injectable()
export class FundraiserSlugCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const request: Request | undefined = context
      .switchToHttp()
      .getRequest<Request>();
    if (!request || request.method !== 'GET') {
      return undefined;
    }
    const slug: string = request.params?.slug;
    if (!slug) {
      return undefined;
    }
    return `cache:public:fundraiser:slug:${slug}`;
  }
}
