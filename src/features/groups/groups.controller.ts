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
    return this.groupsService.updateBySlug(user, slug, group, updateGroupDto);
  }

  /**
   * Invite a user to a group
   * POST /api/v1/groups/:groupId/invites
   */
  @UseGuards(GroupAccessGuard)
  @GroupRoles(['owner', 'admin'])
  @Post(':groupId/invites')
  async inviteUser(
    @GroupParam() group: Group,
    @Body() createInviteDto: CreateInviteDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.groupsService.inviteUser(user, group, createInviteDto);
  }

  /**
   * Submit a verification request for a group
   * POST /api/v1/groups/:groupId/verification-request
   */
  @UseGuards(GroupAccessGuard)
  @GroupRoles(['owner', 'admin'])
  @Post(':groupId/verification-request')
  async submitVerificationRequest(
    @Param('groupId') groupId: string,
    @Body() createVerificationRequestDto: CreateVerificationRequestDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.groupsService.submitVerificationRequest(
      user,
      groupId,
      createVerificationRequestDto,
    );
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
    return this.groupsService.updateMemberRole(
      user,
      groupId,
      memberId,
      updateMemberRoleDto.role,
      currentUserMembership,
    );
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
    return this.groupsService.removeMember(
      user,
      groupId,
      memberId,
      currentUserMembership,
    );
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
