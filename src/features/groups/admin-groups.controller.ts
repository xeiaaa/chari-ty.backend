import { Controller, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { User as UserEntity } from '../../../generated/prisma';
import { GroupsService } from './groups.service';
import { UpdateVerificationRequestDto } from './dtos/update-verification-request.dto';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../../common/decorators';
import { AdminAccessGuard } from './guards/admin-access.guard';

/**
 * AdminGroupsController handles admin-only group operations
 */
@Controller('admin/group')
@UseGuards(AuthGuard)
export class AdminGroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  /**
   * Update a verification request (admin only)
   * PATCH /api/v1/admin/group/:groupId/verification-request
   */
  @UseGuards(AdminAccessGuard)
  @Patch(':groupId/verification-request')
  async updateVerificationRequest(
    @Param('groupId') groupId: string,
    @Body() updateVerificationRequestDto: UpdateVerificationRequestDto,
    @AuthUser() adminUser: UserEntity,
  ) {
    return this.groupsService.updateVerificationRequest(
      adminUser,
      groupId,
      updateVerificationRequestDto,
    );
  }
}
