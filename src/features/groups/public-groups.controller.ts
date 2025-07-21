import { Controller, Get, Param } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { Public } from '../../common/decorators';

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
  async findPublicBySlug(@Param('slug') slug: string) {
    return await this.groupsService.findPublicBySlug(slug);
  }
}
