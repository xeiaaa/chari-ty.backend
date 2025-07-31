import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Param,
  Patch,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { FundraisersService } from './fundraisers.service';
import { CreateFundraiserDto } from './dtos/create-fundraiser.dto';
import { ListFundraisersDto } from './dtos/list-fundraisers.dto';
import { UpdateFundraiserDto } from './dtos/update-fundraiser.dto';
import { PublishFundraiserDto } from './dtos/publish-fundraiser.dto';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../../common/decorators';
import {
  Fundraiser,
  Milestone,
  User as UserEntity,
} from '../../../generated/prisma';
import { MilestonesService } from '../milestones/milestones.service';
import { CreateMilestoneDto } from '../milestones/dtos/create-milestone.dto';
import { UpdateMilestoneDto } from '../milestones/dtos/update-milestone.dto';
import { CompleteMilestoneDto } from '../milestones/dtos/complete-milestone.dto';
import { DonationsService } from '../donations/donations.service';
import { ListDonationsDto } from '../donations/dtos/list-donations.dto';
import { AddGalleryItemsDto } from './dtos/add-gallery-items.dto';
import { UpdateGalleryItemDto } from './dtos/update-gallery-item.dto';
import { ReorderGalleryItemsDto } from './dtos/reorder-gallery-items.dto';
import { FundraiserAccessGuard } from './guards/fundraiser-access.guard';
import { FundraiserRoles } from './decorators/fundraiser-roles.decorator';
import { GroupAccessGuard } from '../groups/guards/group-access.guard';
import { GroupRoles } from '../groups/decorators/group-roles.decorator';
import { FundraiserSlugAccessGuard } from './guards/fundraiser-slug-access.guard';
import { FundraiserParam } from './decorators/fundraiser.decorator';
import { MilestoneParam } from '../milestones/decorators/milestone.decorator';
import { FundraiserMilestoneAccessGuard } from './guards/fundraiser-milestone-access.guard';

@Controller('fundraisers')
@UseGuards(AuthGuard)
export class FundraisersController {
  constructor(
    private readonly fundraisersService: FundraisersService,
    private readonly milestonesService: MilestonesService,
    private readonly donationsService: DonationsService,
  ) {}

  /**
   * Create a new fundraiser
   * POST /api/v1/fundraisers
   */
  @UseGuards(GroupAccessGuard)
  @GroupRoles(['admin', 'owner', 'editor'])
  @UseGuards(AuthGuard)
  @Post()
  async create(
    @Body() data: CreateFundraiserDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.fundraisersService.create(user, data);
  }

  /**
   * List fundraisers with filters and pagination
   * GET /api/v1/fundraisers
   */
  @Get()
  async list(@Query() query: ListFundraisersDto, @AuthUser() user: UserEntity) {
    return this.fundraisersService.list(user, query);
  }

  /**
   * Get a single fundraiser by ID
   * GET /api/v1/fundraisers/:fundraiserId
   */
  @UseGuards(FundraiserAccessGuard)
  @Get(':fundraiserId')
  async findOne(@Param('fundraiserId') fundraiserId: string) {
    return this.fundraisersService.findOne(fundraiserId);
  }

  /**
   * Get a single fundraiser by slug
   * GET /api/v1/fundraisers/slug/:slug
   */
  @UseGuards(FundraiserSlugAccessGuard)
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return await this.fundraisersService.findBySlug(slug);
  }

  /**
   * Update a fundraiser
   * PATCH /api/v1/fundraisers/:fundraiserId
   */
  @UseGuards(FundraiserAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Patch(':fundraiserId')
  async update(
    @Param('fundraiserId') fundraiserId: string,
    @Body() data: UpdateFundraiserDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.fundraisersService.update(user, fundraiserId, data);
  }

  /**
   * Delete a fundraiser
   * DELETE /api/v1/fundraisers/:fundraiserId
   */
  @UseGuards(FundraiserAccessGuard)
  @FundraiserRoles(['admin', 'owner'])
  @Delete(':fundraiserId')
  @HttpCode(204)
  async delete(@Param('fundraiserId') fundraiserId: string) {
    await this.fundraisersService.delete(fundraiserId);
  }

  /**
   * Publish or unpublish a fundraiser
   * PATCH /api/v1/fundraisers/:fundraiserId/publish
   */
  @UseGuards(FundraiserAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Patch(':fundraiserId/publish')
  async publish(
    @Param('fundraiserId') fundraiserId: string,
    @Body() data: PublishFundraiserDto,
  ) {
    return this.fundraisersService.publish(fundraiserId, data.published);
  }

  /**
   * Create a milestone for a fundraiser
   * POST /api/v1/fundraisers/:fundraiserId/milestones
   */
  @UseGuards(FundraiserAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Post(':fundraiserId/milestones')
  async createMilestone(
    @Body() data: CreateMilestoneDto,
    @FundraiserParam() fundraiser: Fundraiser,
  ) {
    return this.milestonesService.create(fundraiser, data);
  }

  /**
   * List milestones for a fundraiser
   * GET /api/v1/fundraisers/:fundraiserId/milestones
   */
  @UseGuards(FundraiserAccessGuard)
  @Get(':fundraiserId/milestones')
  async listMilestones(@Param('fundraiserId') fundraiserId: string) {
    return this.milestonesService.list(fundraiserId);
  }

  /**
   * Update a milestone
   * PATCH /api/v1/fundraisers/:fundraiserId/milestones/:milestoneId
   */
  @UseGuards(FundraiserAccessGuard, FundraiserMilestoneAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Patch(':fundraiserId/milestones/:milestoneId')
  async updateMilestone(
    @Param('fundraiserId') fundraiserId: string,
    @MilestoneParam() milestone: Milestone & { fundraiser: Fundraiser },
    @Body() data: UpdateMilestoneDto,
  ) {
    return this.milestonesService.update(fundraiserId, milestone, data);
  }

  /**
   * Delete a milestone
   * DELETE /api/v1/fundraisers/:fundraiserId/milestones/:milestoneId
   */
  @UseGuards(FundraiserAccessGuard, FundraiserMilestoneAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Delete(':fundraiserId/milestones/:milestoneId')
  @HttpCode(204)
  async deleteMilestone(@MilestoneParam() milestone: Milestone) {
    await this.milestonesService.delete(milestone);
  }

  /**
   * Complete a milestone with details and proof
   * PATCH /api/v1/fundraisers/:fundraiserId/milestones/:milestoneId/complete
   */
  @UseGuards(FundraiserAccessGuard, FundraiserMilestoneAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Patch(':fundraiserId/milestones/:milestoneId/complete')
  async completeMilestone(
    @MilestoneParam() milestone: Milestone,
    @Body() data: CompleteMilestoneDto,
  ) {
    return this.milestonesService.complete(milestone, data);
  }

  /**
   * List donations for a fundraiser
   * GET /api/v1/fundraisers/:fundraiserId/donations
   */
  @UseGuards(FundraiserAccessGuard)
  @Get(':fundraiserId/donations')
  async listDonations(
    @FundraiserParam() fundraiser: Fundraiser,
    @Query() query: ListDonationsDto,
  ) {
    return this.donationsService.listByFundraiser(fundraiser, query.status);
  }

  /**
   * Add gallery items to a fundraiser
   * POST /api/v1/fundraisers/:fundraiserId/gallery
   */
  @UseGuards(FundraiserAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Post(':fundraiserId/gallery')
  async addGalleryItems(
    @Param('fundraiserId') fundraiserId: string,
    @Body() data: AddGalleryItemsDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.fundraisersService.addGalleryItems(user, fundraiserId, data);
  }

  /**
   * Reorder gallery items
   * PATCH /api/v1/fundraisers/:fundraiserId/gallery/reorder
   */
  @UseGuards(FundraiserAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Patch(':fundraiserId/gallery/reorder')
  async reorderGalleryItems(
    @Param('fundraiserId') fundraiserId: string,
    @Body() data: ReorderGalleryItemsDto,
  ) {
    return this.fundraisersService.reorderGalleryItems(fundraiserId, data);
  }

  /**
   * Update a gallery item caption
   * PATCH /api/v1/fundraisers/:fundraiserId/gallery/:galleryItemId
   */
  @UseGuards(FundraiserAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Patch(':fundraiserId/gallery/:galleryItemId')
  async updateGalleryItem(
    @Param('fundraiserId') fundraiserId: string,
    @Param('galleryItemId') galleryItemId: string,
    @Body() data: UpdateGalleryItemDto,
  ) {
    return this.fundraisersService.updateGalleryItem(
      fundraiserId,
      galleryItemId,
      data,
    );
  }

  /**
   * Delete a gallery item
   * DELETE /api/v1/fundraisers/:fundraiserId/gallery/:galleryItemId
   */
  @UseGuards(FundraiserAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Delete(':fundraiserId/gallery/:galleryItemId')
  @HttpCode(204)
  async deleteGalleryItem(
    @Param('fundraiserId') fundraiserId: string,
    @Param('galleryItemId') galleryItemId: string,
  ) {
    await this.fundraisersService.deleteGalleryItem(
      fundraiserId,
      galleryItemId,
    );
  }
}
