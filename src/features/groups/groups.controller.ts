import { Controller, Get, Param, UseGuards, Patch, Body } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../../common/decorators';
import { User as UserEntity } from '../../../generated/prisma';
import { UpdateGroupDto } from './dtos/update-group.dto';

/**
 * Groups controller for authenticated endpoints
 */
@Controller('groups')
@UseGuards(AuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  /**
   * Get authenticated group by slug
   * GET /api/v1/groups/slug/:slug
   */
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string, @AuthUser() user: UserEntity) {
    return this.groupsService.findAuthenticatedBySlug(user, slug);
  }

  /**
   * Update group by slug
   * PATCH /api/v1/groups/slug/:slug
   */
  @Patch('slug/:slug')
  async updateBySlug(
    @Param('slug') slug: string,
    @Body() updateGroupDto: UpdateGroupDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.groupsService.updateBySlug(user, slug, updateGroupDto);
  }
}
