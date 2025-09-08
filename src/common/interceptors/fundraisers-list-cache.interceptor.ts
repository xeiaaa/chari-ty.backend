import { Injectable, ExecutionContext } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { Request } from 'express';

/**
 * Cache interceptor that generates keys like:
 * - fundraisers-list
 * - fundraisers-list-limit-6
 * - fundraisers-list-limit-6-page-2-sort-createdAt
 * Query parameters are serialized in a stable, sorted order.
 */
@Injectable()
export class FundraisersListCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const request: Request | undefined = context
      .switchToHttp()
      .getRequest<Request>();
    if (!request || request.method !== 'GET') {
      return undefined;
    }
    const baseKey: string = 'fundraisers-list';
    const query: Record<string, unknown> = (request.query ?? {}) as Record<
      string,
      unknown
    >;
    const entries: Array<[string, unknown]> = Object.entries(query)
      .filter(
        ([, value]) => value !== undefined && value !== null && value !== '',
      )
      .sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) {
      return baseKey;
    }
    const suffixParts: string[] = entries.map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}-${value.join(',')}`;
      }
      return `${key}-${String(value)}`;
    });
    return `${baseKey}-${suffixParts.join('-')}`;
  }
}
