import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { Public } from '../../common/decorators';
import { ListPublicFundraisersDto } from '../fundraisers/dtos/list-public-fundraisers.dto';
import { GroupSlugCacheInterceptor } from '../../common/interceptors/group-slug-cache.interceptor';
import { GroupFundraisersCacheInterceptor } from '../../common/interceptors/group-fundraisers-cache.interceptor';

/**
 * Public controller for groups
 * These endpoints don't require authentication
 */
@Controller('public/groups')
export class PublicGroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  /**
   * Get a single public group by slug
   * GET /api/v1/public/groups/slug/:slug
   */
  @Public()
  @Get('slug/:slug')
  @UseInterceptors(GroupSlugCacheInterceptor)
  async findPublicBySlug(@Param('slug') slug: string) {
    return await this.groupsService.findPublicBySlug(slug);
  }

  /**
   * Get public fundraisers for a group by slug
   * GET /api/v1/public/groups/slug/:slug/fundraisers
   */
  @Public()
  @Get('slug/:slug/fundraisers')
  @UseInterceptors(GroupFundraisersCacheInterceptor)
  async getGroupFundraisers(
    @Param('slug') slug: string,
    @Query() query: ListPublicFundraisersDto,
  ) {
    return await this.groupsService.getGroupFundraisers(slug, query);
  }
}
