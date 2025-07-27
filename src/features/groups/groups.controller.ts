import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { User as UserEntity } from '../../../generated/prisma';
import { GroupsService } from './groups.service';
import { UpdateGroupDto } from './dtos/update-group.dto';
import { CreateInviteDto } from './dtos/create-invite.dto';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../../common/decorators';

/**
 * GroupsController handles HTTP requests for group management
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
}
