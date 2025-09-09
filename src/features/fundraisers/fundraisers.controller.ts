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
  Inject,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
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
import { GroupRoles } from '../groups/decorators/group-roles.decorator';
import { FundraiserSlugAccessGuard } from './guards/fundraiser-slug-access.guard';
import { FundraiserParam } from './decorators/fundraiser.decorator';
import { MilestoneParam } from '../milestones/decorators/milestone.decorator';
import { FundraiserMilestoneAccessGuard } from './guards/fundraiser-milestone-access.guard';
import { FundraiserGroupAccessGuard } from './guards/fundraiser-group-access.guard';

@Controller('fundraisers')
@UseGuards(AuthGuard)
export class FundraisersController {
  constructor(
    private readonly fundraisersService: FundraisersService,
    private readonly milestonesService: MilestonesService,
    private readonly donationsService: DonationsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Create a new fundraiser
   * POST /api/v1/fundraisers
   */
  @UseGuards(FundraiserGroupAccessGuard)
  @GroupRoles(['admin', 'owner', 'editor'])
  @UseGuards(AuthGuard)
  @Post()
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 requests per hour per user
  async create(
    @Body() data: CreateFundraiserDto,
    @AuthUser() user: UserEntity,
  ) {
    const result = await this.fundraisersService.create(user, data);

    // Invalidate public fundraisers list cache
    await this.invalidatePublicFundraisersCache();

    return result;
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
    const result = await this.fundraisersService.update(
      user,
      fundraiserId,
      data,
    );

    // Invalidate caches for updated fundraiser
    await this.invalidateFundraiserCaches(fundraiserId);

    return result;
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

    // Invalidate caches for deleted fundraiser
    await this.invalidateFundraiserCaches(fundraiserId);
  }

  /**
   * Publish or unpublish a fundraiser
   * PATCH /api/v1/fundraisers/:fundraiserId/publish
   */
  @UseGuards(FundraiserAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Patch(':fundraiserId/publish')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour per user
  async publish(
    @Param('fundraiserId') fundraiserId: string,
    @Body() data: PublishFundraiserDto,
  ) {
    // Invalidate caches for published / unpublished fundraiser
    await this.invalidateFundraiserCaches(fundraiserId);

    return this.fundraisersService.publish(fundraiserId, data.published);
  }

  /**
   * Create a milestone for a fundraiser
   * POST /api/v1/fundraisers/:fundraiserId/milestones
   */
  @UseGuards(FundraiserAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Post(':fundraiserId/milestones')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute per user
  async createMilestone(
    @Body() data: CreateMilestoneDto,
    @FundraiserParam() fundraiser: Fundraiser,
  ) {
    const result = await this.milestonesService.create(fundraiser, data);

    // Invalidate caches for fundraiser
    await this.invalidateFundraiserCaches(fundraiser.id);

    return result;
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
    const result = await this.milestonesService.update(
      fundraiserId,
      milestone,
      data,
    );

    // Invalidate caches for fundraiser
    await this.invalidateFundraiserCaches(fundraiserId);

    return result;
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

    // Invalidate caches for fundraiser
    await this.invalidateFundraiserCaches(milestone.fundraiserId);
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
    const result = await this.milestonesService.complete(milestone, data);

    // Invalidate caches for fundraiser
    await this.invalidateFundraiserCaches(milestone.fundraiserId);

    return result;
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
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute per user
  async addGalleryItems(
    @Param('fundraiserId') fundraiserId: string,
    @Body() data: AddGalleryItemsDto,
    @AuthUser() user: UserEntity,
  ) {
    const result = await this.fundraisersService.addGalleryItems(
      user,
      fundraiserId,
      data,
    );

    // Invalidate caches for fundraiser
    await this.invalidateFundraiserCaches(fundraiserId);

    return result;
  }

  /**
   * Reorder gallery items
   * PATCH /api/v1/fundraisers/:fundraiserId/gallery/reorder
   */
  @UseGuards(FundraiserAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Patch(':fundraiserId/gallery/reorder')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute per user
  async reorderGalleryItems(
    @Param('fundraiserId') fundraiserId: string,
    @Body() data: ReorderGalleryItemsDto,
  ) {
    const result = await this.fundraisersService.reorderGalleryItems(
      fundraiserId,
      data,
    );

    // Invalidate caches for fundraiser
    await this.invalidateFundraiserCaches(fundraiserId);

    return result;
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
    const result = await this.fundraisersService.updateGalleryItem(
      fundraiserId,
      galleryItemId,
      data,
    );

    // Invalidate caches for fundraiser
    await this.invalidateFundraiserCaches(fundraiserId);

    return result;
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

    // Invalidate caches for fundraiser
    await this.invalidateFundraiserCaches(fundraiserId);
  }

  /**
   * Invalidate public fundraisers cache
   */
  private async invalidatePublicFundraisersCache(): Promise<void> {
    try {
      // Clear all fundraisers-list cache keys
      await this.invalidateCacheByPattern('fundraisers-list');
      await this.cacheManager.del('cache:public:fundraisers:categories');
    } catch (error) {
      // Log error but don't fail the request
      console.warn('Failed to invalidate cache:', error);
    }
  }

  /**
   * Invalidate fundraiser-specific caches
   */
  private async invalidateFundraiserCaches(
    fundraiserId: string,
  ): Promise<void> {
    try {
      // Get fundraiser to find its slug
      const fundraiser = await this.fundraisersService.findOne(fundraiserId);
      if (!fundraiser) {
        return;
      }

      // Clear all fundraisers list cache keys
      await this.invalidateCacheByPattern('fundraisers-list');

      // Clear fundraiser categories cache
      await this.cacheManager.del('cache:public:fundraisers:categories');

      // Clear fundraiser slug cache
      await this.cacheManager.del(
        `cache:public:fundraiser:slug:${fundraiser.slug}`,
      );

      // Clear fundraiser donations cache
      await this.cacheManager.del(
        `cache:public:fundraiser:slug:${fundraiser.slug}:donations:*`,
      );
    } catch (error) {
      // Log error but don't fail the request
      console.warn('Failed to invalidate fundraiser caches:', error);
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
