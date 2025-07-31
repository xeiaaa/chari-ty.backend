import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../../common/decorators/user.decorator';
import { User as UserEntity } from '../../../generated/prisma';
import { MilestonesService } from './milestones.service';
import { AddMilestoneUploadsDto } from './dtos/add-milestone-uploads.dto';
import { ReorderMilestoneUploadsDto } from './dtos/reorder-milestone-uploads.dto';
import { UpdateMilestoneUploadDto } from './dtos/update-milestone-upload.dto';
import { MilestoneAccessGuard } from './guards/milestone-access.guard';

@Controller('milestones')
@UseGuards(AuthGuard)
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  /**
   * Add uploads to a milestone
   * POST /api/v1/milestones/:milestoneId/uploads
   */
  @UseGuards(MilestoneAccessGuard)
  @Post(':milestoneId/uploads')
  async addMilestoneUploads(
    @Param('milestoneId') milestoneId: string,
    @Body() data: AddMilestoneUploadsDto,
    @AuthUser() user: UserEntity,
  ) {
    return await this.milestonesService.addMilestoneUploads(
      user,
      milestoneId,
      data,
    );
  }

  /**
   * Reorder milestone uploads
   * PATCH /api/v1/milestones/:milestoneId/uploads/reorder
   */
  @UseGuards(MilestoneAccessGuard)
  @Patch(':milestoneId/uploads/reorder')
  async reorderMilestoneUploads(
    @Param('milestoneId') milestoneId: string,
    @Body() data: ReorderMilestoneUploadsDto,
  ) {
    return await this.milestonesService.reorderMilestoneUploads(
      milestoneId,
      data,
    );
  }

  /**
   * Update a milestone upload caption
   * PATCH /api/v1/milestones/:milestoneId/uploads/:uploadItemId
   */
  @UseGuards(MilestoneAccessGuard)
  @Patch(':milestoneId/uploads/:uploadItemId')
  async updateMilestoneUpload(
    @Param('milestoneId') milestoneId: string,
    @Param('uploadItemId') uploadItemId: string,
    @Body() data: UpdateMilestoneUploadDto,
  ) {
    return await this.milestonesService.updateMilestoneUpload(
      milestoneId,
      uploadItemId,
      data,
    );
  }

  /**
   * Delete a milestone upload
   * DELETE /api/v1/milestones/:milestoneId/uploads/:uploadItemId
   */
  @UseGuards(MilestoneAccessGuard)
  @Delete(':milestoneId/uploads/:uploadItemId')
  @HttpCode(204)
  async deleteMilestoneUpload(
    @Param('milestoneId') milestoneId: string,
    @Param('uploadItemId') uploadItemId: string,
  ) {
    await this.milestonesService.deleteMilestoneUpload(
      milestoneId,
      uploadItemId,
    );
  }
}
