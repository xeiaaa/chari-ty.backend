import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  Inject,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  Group,
  GroupMember,
  Upload,
  User as UserEntity,
} from '../../../generated/prisma';
import { GroupsService } from './groups.service';
import { DonationsService } from '../donations/donations.service';
import { UpdateGroupDto } from './dtos/update-group.dto';
import { CreateInviteDto } from './dtos/create-invite.dto';
import { CreateGroupDto } from './dtos/create-group.dto';
import { UpdateMemberRoleDto } from './dtos/update-member-role.dto';
import { DashboardDto } from './dtos/dashboard.dto';
import { ListGroupDonationsDto } from '../donations/dtos/list-group-donations.dto';
import { AddGroupUploadsDto } from './dtos/add-group-uploads.dto';
import { ReorderGroupUploadsDto } from './dtos/reorder-group-uploads.dto';
import { UpdateGroupUploadDto } from './dtos/update-group-upload.dto';
import { CreateVerificationRequestDto } from './dtos/create-verification-request.dto';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../../common/decorators';
import { GroupSlugAccessGuard } from './guards/group-slug-access.guard';
import { GroupRoles } from './decorators/group-roles.decorator';
import { GroupParam } from './decorators/group.decorator';
import { CurrentUserMembershipParam } from './decorators/current-user-membership.decorator';
import { GroupAccessGuard } from './guards/group-access.guard';

/**
 * GroupsController handles HTTP requests for group management
 */
@Controller('groups')
@UseGuards(AuthGuard)
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly donationsService: DonationsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Create a new group
   * POST /api/v1/groups
   */
  @Post()
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour per user
  async createGroup(
    @Body() createGroupDto: CreateGroupDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.groupsService.createGroup(user, createGroupDto);
  }

  /**
   * Get authenticated group by slug
   * GET /api/v1/groups/slug/:slug
   */
  @UseGuards(GroupSlugAccessGuard)
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string, @GroupParam() group: Group) {
    return this.groupsService.findAuthenticatedBySlug(slug, group);
  }

  /**
   * Update group by slug
   * PATCH /api/v1/groups/slug/:slug
   */
  @UseGuards(GroupSlugAccessGuard)
  @GroupRoles(['owner', 'admin'])
  @Patch('slug/:slug')
  async updateBySlug(
    @GroupParam() group: Group & { avatar: Upload },
    @Param('slug') slug: string,
    @Body() updateGroupDto: UpdateGroupDto,
    @AuthUser() user: UserEntity,
  ) {
    const result = await this.groupsService.updateBySlug(
      user,
      slug,
      group,
      updateGroupDto,
    );

    // Invalidate caches for group
    await this.invalidateGroupCaches(group.id);

    return result;
  }

  /**
   * Invite a user to a group
   * POST /api/v1/groups/:groupId/invites
   */
  @UseGuards(GroupAccessGuard)
  @GroupRoles(['owner', 'admin'])
  @Post(':groupId/invites')
  @Throttle({ default: { limit: 20, ttl: 3600000 } }) // 20 requests per hour per user
  async inviteUser(
    @GroupParam() group: Group,
    @Body() createInviteDto: CreateInviteDto,
    @AuthUser() user: UserEntity,
  ) {
    const result = await this.groupsService.inviteUser(
      user,
      group,
      createInviteDto,
    );

    // Invalidate caches for group
    await this.invalidateGroupCaches(group.id);

    return result;
  }

  /**
   * Submit a verification request for a group
   * POST /api/v1/groups/:groupId/verification-request
   */
  @UseGuards(GroupAccessGuard)
  @GroupRoles(['owner', 'admin'])
  @Post(':groupId/verification-request')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour per user
  async submitVerificationRequest(
    @Param('groupId') groupId: string,
    @Body() createVerificationRequestDto: CreateVerificationRequestDto,
    @AuthUser() user: UserEntity,
  ) {
    const result = await this.groupsService.submitVerificationRequest(
      user,
      groupId,
      createVerificationRequestDto,
    );

    // Invalidate caches for group
    await this.invalidateGroupCaches(groupId);

    return result;
  }

  /**
   * Update a group member's role
   * PATCH /api/v1/groups/:groupId/members/:memberId
   */
  @UseGuards(GroupAccessGuard)
  @GroupRoles(['owner', 'admin'])
  @Patch(':groupId/members/:memberId')
  async updateMemberRole(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Body() updateMemberRoleDto: UpdateMemberRoleDto,
    @AuthUser() user: UserEntity,
    @CurrentUserMembershipParam() currentUserMembership: GroupMember,
  ) {
    const result = await this.groupsService.updateMemberRole(
      user,
      groupId,
      memberId,
      updateMemberRoleDto.role,
      currentUserMembership,
    );

    // Invalidate caches for group
    await this.invalidateGroupCaches(groupId);

    return result;
  }

  /**
   * Remove a member from a group
   * DELETE /api/v1/groups/:groupId/members/:memberId
   */
  @UseGuards(GroupAccessGuard)
  @GroupRoles(['owner', 'admin'])
  @Delete(':groupId/members/:memberId')
  async removeMember(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @AuthUser() user: UserEntity,
    @CurrentUserMembershipParam() currentUserMembership: GroupMember,
  ) {
    const result = await this.groupsService.removeMember(
      user,
      groupId,
      memberId,
      currentUserMembership,
    );

    // Invalidate caches for group
    await this.invalidateGroupCaches(groupId);

    return result;
  }

  /**
   * Get dashboard data for a group
   * GET /api/v1/groups/slug/:slug/dashboard
   */
  @UseGuards(GroupSlugAccessGuard)
  @Get('slug/:slug/dashboard')
  async getDashboard(@GroupParam() group: Group): Promise<DashboardDto> {
    return this.groupsService.getDashboard(group);
  }

  /**
   * Get donations for a group with pagination, sorting, and filtering
   * GET /api/v1/groups/slug/:slug/donations
   */
  @UseGuards(GroupSlugAccessGuard)
  @Get('slug/:slug/donations')
  async getGroupDonations(
    @Param('slug') slug: string,
    @Query() query: ListGroupDonationsDto,
    @AuthUser() user: UserEntity,
    @GroupParam() group: Group,
  ) {
    return this.donationsService.listByGroup(group, query);
  }

  /**
   * Add uploads to a group
   * POST /api/v1/groups/:groupId/uploads
   */
  @Post(':groupId/uploads')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute per user
  async addGroupUploads(
    @Param('groupId') groupId: string,
    @Body() data: AddGroupUploadsDto,
    @AuthUser() user: UserEntity,
  ) {
    const result = await this.groupsService.addGroupUploads(
      user,
      groupId,
      data,
    );

    // Invalidate caches for group
    await this.invalidateGroupCaches(groupId);

    return result;
  }

  /**
   * Reorder group uploads
   * PATCH /api/v1/groups/:groupId/uploads/reorder
   */
  @Patch(':groupId/uploads/reorder')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute per user
  async reorderGroupUploads(
    @Param('groupId') groupId: string,
    @Body() data: ReorderGroupUploadsDto,
    @AuthUser() user: UserEntity,
  ) {
    const result = await this.groupsService.reorderGroupUploads(
      user,
      groupId,
      data,
    );

    // Invalidate caches for group
    await this.invalidateGroupCaches(groupId);

    return result;
  }

  /**
   * Update a group upload caption
   * PATCH /api/v1/groups/:groupId/uploads/:uploadItemId
   */
  @Patch(':groupId/uploads/:uploadItemId')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute per user
  async updateGroupUpload(
    @Param('groupId') groupId: string,
    @Param('uploadItemId') uploadItemId: string,
    @Body() data: UpdateGroupUploadDto,
    @AuthUser() user: UserEntity,
  ) {
    const result = await this.groupsService.updateGroupUpload(
      user,
      groupId,
      uploadItemId,
      data,
    );

    // Invalidate caches for group
    await this.invalidateGroupCaches(groupId);

    return result;
  }

  /**
   * Delete a group upload
   * DELETE /api/v1/groups/:groupId/uploads/:uploadItemId
   */
  @Delete(':groupId/uploads/:uploadItemId')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute per user
  async deleteGroupUpload(
    @Param('groupId') groupId: string,
    @Param('uploadItemId') uploadItemId: string,
    @AuthUser() user: UserEntity,
  ) {
    await this.groupsService.deleteGroupUpload(user, groupId, uploadItemId);

    // Invalidate caches for group
    await this.invalidateGroupCaches(groupId);
  }

  /**
   * Invalidate group-specific caches
   */
  private async invalidateGroupCaches(groupId: string): Promise<void> {
    try {
      // Get group to find its slug
      const group = await this.groupsService.findById(groupId);
      if (!group) {
        return;
      }

      // Clear group slug cache
      await this.cacheManager.del(`cache:public:group:slug:${group.slug}`);

      // Clear group fundraisers cache (with all query variations)
      await this.invalidateCacheByPattern(
        `cache:public:group:slug:${group.slug}:fundraisers`,
      );

      // Clear fundraisers list cache (group changes might affect fundraiser display)
      await this.invalidateCacheByPattern('cache:public:fundraisers-list');

      // Clear individual fundraiser caches that might be affected by group changes
      // This is a broader invalidation but necessary when group data changes
      await this.invalidateCacheByPattern('cache:public:fundraiser:slug');
    } catch (error) {
      // Log error but don't fail the request
      console.warn('Failed to invalidate group caches:', error);
    }
  }

  /**
   * Invalidate cache keys by pattern
   */
  private async invalidateCacheByPattern(pattern: string): Promise<void> {
    try {
      // For Redis, we need to use the store directly to get keys by pattern
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const store = (this.cacheManager as any).store;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (store && typeof store.keys === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const keys = await store.keys(`${pattern}*`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (keys && keys.length > 0) {
          await Promise.all(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            keys.map((key: string) => this.cacheManager.del(key)),
          );
        }
      } else {
        // Fallback: clear the base key if pattern matching isn't available
        await this.cacheManager.del(pattern);
      }
    } catch (error) {
      console.warn(`Failed to invalidate cache pattern ${pattern}:`, error);
    }
  }
}
