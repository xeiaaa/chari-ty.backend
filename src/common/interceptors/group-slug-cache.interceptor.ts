import { Injectable, ExecutionContext } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { Request } from 'express';

/**
 * Cache interceptor for group by slug
 * Key: cache:public:group:slug:{slug}
 * TTL: 120s
 */
@Injectable()
export class GroupSlugCacheInterceptor extends CacheInterceptor {
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
    return `cache:public:group:slug:${slug}`;
  }
}
