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
} from '@nestjs/common';
import { User as UserEntity } from '../../../generated/prisma';
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
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../../common/decorators';

/**
 * GroupsController handles HTTP requests for group management
 */
@Controller('groups')
@UseGuards(AuthGuard)
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly donationsService: DonationsService,
  ) {}

  /**
   * Create a new group
   * POST /api/v1/groups
   */
  @Post()
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

  /**
   * Invite a user to a group
   * POST /api/v1/groups/:groupId/invites
   */
  @Post(':groupId/invites')
  async inviteUser(
    @Param('groupId') groupId: string,
    @Body() createInviteDto: CreateInviteDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.groupsService.inviteUser(user, groupId, createInviteDto);
  }

  /**
   * Update a group member's role
   * PATCH /api/v1/groups/:groupId/members/:memberId
   */
  @Patch(':groupId/members/:memberId')
  async updateMemberRole(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Body() updateMemberRoleDto: UpdateMemberRoleDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.groupsService.updateMemberRole(
      user,
      groupId,
      memberId,
      updateMemberRoleDto.role,
    );
  }

  /**
   * Remove a member from a group
   * DELETE /api/v1/groups/:groupId/members/:memberId
   */
  @Delete(':groupId/members/:memberId')
  async removeMember(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @AuthUser() user: UserEntity,
  ) {
    return this.groupsService.removeMember(user, groupId, memberId);
  }

  /**
   * Get dashboard data for a group
   * GET /api/v1/groups/slug/:slug/dashboard
   */
  @Get('slug/:slug/dashboard')
  async getDashboard(
    @Param('slug') slug: string,
    @AuthUser() user: UserEntity,
  ): Promise<DashboardDto> {
    return this.groupsService.getDashboard(user, slug);
  }

  /**
   * Get donations for a group with pagination, sorting, and filtering
   * GET /api/v1/groups/slug/:slug/donations
   */
  @Get('slug/:slug/donations')
  async getGroupDonations(
    @Param('slug') slug: string,
    @Query() query: ListGroupDonationsDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.donationsService.listByGroup(user, slug, query);
  }

  /**
   * Add uploads to a group
   * POST /api/v1/groups/:groupId/uploads
   */
  @Post(':groupId/uploads')
  async addGroupUploads(
    @Param('groupId') groupId: string,
    @Body() data: AddGroupUploadsDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.groupsService.addGroupUploads(user, groupId, data);
  }

  /**
   * Reorder group uploads
   * PATCH /api/v1/groups/:groupId/uploads/reorder
   */
  @Patch(':groupId/uploads/reorder')
  async reorderGroupUploads(
    @Param('groupId') groupId: string,
    @Body() data: ReorderGroupUploadsDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.groupsService.reorderGroupUploads(user, groupId, data);
  }

  /**
   * Update a group upload caption
   * PATCH /api/v1/groups/:groupId/uploads/:uploadItemId
   */
  @Patch(':groupId/uploads/:uploadItemId')
  async updateGroupUpload(
    @Param('groupId') groupId: string,
    @Param('uploadItemId') uploadItemId: string,
    @Body() data: UpdateGroupUploadDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.groupsService.updateGroupUpload(
      user,
      groupId,
      uploadItemId,
      data,
    );
  }

  /**
   * Delete a group upload
   * DELETE /api/v1/groups/:groupId/uploads/:uploadItemId
   */
  @Delete(':groupId/uploads/:uploadItemId')
  @HttpCode(204)
  async deleteGroupUpload(
    @Param('groupId') groupId: string,
    @Param('uploadItemId') uploadItemId: string,
    @AuthUser() user: UserEntity,
  ) {
    await this.groupsService.deleteGroupUpload(user, groupId, uploadItemId);
  }
}
