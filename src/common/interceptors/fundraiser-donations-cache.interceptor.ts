import { Injectable, ExecutionContext } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { Request } from 'express';

/**
 * Cache interceptor for fundraiser donations by slug
 * Key: cache:public:fundraiser:{fundraiserId}:donations:{page}:{queryHash}
 * TTL: 30s
 */
@Injectable()
export class FundraiserDonationsCacheInterceptor extends CacheInterceptor {
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
    const query: Record<string, unknown> = (request.query ?? {}) as Record<
      string,
      unknown
    >;
    const entries: Array<[string, unknown]> = Object.entries(query)
      .filter(
        ([, value]) => value !== undefined && value !== null && value !== '',
      )
      .sort(([a], [b]) => a.localeCompare(b));

    const queryHash: string =
      entries.length > 0
        ? entries.map(([key, value]) => `${key}-${String(value)}`).join('-')
        : 'default';

    return `cache:public:fundraiser:slug:${slug}:donations:${queryHash}`;
  }
}
