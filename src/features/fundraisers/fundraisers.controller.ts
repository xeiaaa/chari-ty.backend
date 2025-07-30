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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FundraisersService } from './fundraisers.service';
import { CreateFundraiserDto } from './dtos/create-fundraiser.dto';
import { ListFundraisersDto } from './dtos/list-fundraisers.dto';
import { UpdateFundraiserDto } from './dtos/update-fundraiser.dto';
import { PublishFundraiserDto } from './dtos/publish-fundraiser.dto';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../../common/decorators';
import { User as UserEntity } from '../../../generated/prisma';
import { MilestonesService } from '../milestones/milestones.service';
import { CreateMilestoneDto } from '../milestones/dtos/create-milestone.dto';
import { UpdateMilestoneDto } from '../milestones/dtos/update-milestone.dto';
import { CompleteMilestoneDto } from '../milestones/dtos/complete-milestone.dto';
import { DonationsService } from '../donations/donations.service';
import { ListDonationsDto } from '../donations/dtos/list-donations.dto';
import { AddGalleryItemsDto } from './dtos/add-gallery-items.dto';
import { UpdateGalleryItemDto } from './dtos/update-gallery-item.dto';
import { ReorderGalleryItemsDto } from './dtos/reorder-gallery-items.dto';

@ApiTags('fundraisers')
@ApiBearerAuth()
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
  @Post()
  @ApiOperation({ summary: 'Create a new fundraiser' })
  @ApiBody({ type: CreateFundraiserDto })
  @ApiResponse({
    status: 201,
    description: 'Fundraiser created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string' },
        goal: { type: 'number' },
        status: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'List fundraisers with filters and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Fundraisers retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              slug: { type: 'string' },
              description: { type: 'string' },
              goal: { type: 'number' },
              status: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async list(@Query() query: ListFundraisersDto, @AuthUser() user: UserEntity) {
    return this.fundraisersService.list(user, query);
  }

  /**
   * Get a single fundraiser by ID
   * GET /api/v1/fundraisers/:fundraiserId
   */
  @Get(':fundraiserId')
  @ApiOperation({ summary: 'Get a single fundraiser by ID' })
  @ApiParam({ name: 'fundraiserId', description: 'Fundraiser ID' })
  @ApiResponse({
    status: 200,
    description: 'Fundraiser retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string' },
        goal: { type: 'number' },
        status: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Fundraiser not found' })
  async findOne(
    @Param('fundraiserId') fundraiserId: string,
    @AuthUser() user: UserEntity,
  ) {
    return this.fundraisersService.findOne(user, fundraiserId);
  }

  /**
   * Get a single fundraiser by slug
   * GET /api/v1/fundraisers/slug/:slug
   */
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a single fundraiser by slug' })
  @ApiParam({ name: 'slug', description: 'Fundraiser slug' })
  @ApiResponse({
    status: 200,
    description: 'Fundraiser retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string' },
        goal: { type: 'number' },
        status: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Fundraiser not found' })
  async findBySlug(@Param('slug') slug: string, @AuthUser() user: UserEntity) {
    return await this.fundraisersService.findBySlug(user, slug);
  }

  /**
   * Update a fundraiser
   * PATCH /api/v1/fundraisers/:fundraiserId
   */
  @Patch(':fundraiserId')
  @ApiOperation({ summary: 'Update a fundraiser' })
  @ApiParam({ name: 'fundraiserId', description: 'Fundraiser ID' })
  @ApiBody({ type: UpdateFundraiserDto })
  @ApiResponse({
    status: 200,
    description: 'Fundraiser updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string' },
        goal: { type: 'number' },
        status: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Fundraiser not found' })
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
  @Delete(':fundraiserId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a fundraiser' })
  @ApiParam({ name: 'fundraiserId', description: 'Fundraiser ID' })
  @ApiResponse({ status: 204, description: 'Fundraiser deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Fundraiser not found' })
  async delete(
    @Param('fundraiserId') fundraiserId: string,
    @AuthUser() user: UserEntity,
  ) {
    await this.fundraisersService.delete(user, fundraiserId);
  }

  /**
   * Publish or unpublish a fundraiser
   * PATCH /api/v1/fundraisers/:fundraiserId/publish
   */
  @Patch(':fundraiserId/publish')
  async publish(
    @Param('fundraiserId') fundraiserId: string,
    @Body() data: PublishFundraiserDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.fundraisersService.publish(user, fundraiserId, data.published);
  }

  /**
   * Create a milestone for a fundraiser
   * POST /api/v1/fundraisers/:fundraiserId/milestones
   */
  @Post(':fundraiserId/milestones')
  async createMilestone(
    @Param('fundraiserId') fundraiserId: string,
    @Body() data: CreateMilestoneDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.milestonesService.create(user, fundraiserId, data);
  }

  /**
   * List milestones for a fundraiser
   * GET /api/v1/fundraisers/:fundraiserId/milestones
   */
  @Get(':fundraiserId/milestones')
  async listMilestones(
    @Param('fundraiserId') fundraiserId: string,
    @AuthUser() user: UserEntity,
  ) {
    return this.milestonesService.list(user, fundraiserId);
  }

  /**
   * Update a milestone
   * PATCH /api/v1/fundraisers/:fundraiserId/milestones/:milestoneId
   */
  @Patch(':fundraiserId/milestones/:milestoneId')
  async updateMilestone(
    @Param('fundraiserId') fundraiserId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() data: UpdateMilestoneDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.milestonesService.update(user, fundraiserId, milestoneId, data);
  }

  /**
   * Delete a milestone
   * DELETE /api/v1/fundraisers/:fundraiserId/milestones/:milestoneId
   */
  @Delete(':fundraiserId/milestones/:milestoneId')
  @HttpCode(204)
  async deleteMilestone(
    @Param('fundraiserId') fundraiserId: string,
    @Param('milestoneId') milestoneId: string,
    @AuthUser() user: UserEntity,
  ) {
    await this.milestonesService.delete(user, fundraiserId, milestoneId);
  }

  /**
   * Complete a milestone with details and proof
   * PATCH /api/v1/fundraisers/:fundraiserId/milestones/:milestoneId/complete
   */
  @Patch(':fundraiserId/milestones/:milestoneId/complete')
  async completeMilestone(
    @Param('fundraiserId') fundraiserId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() data: CompleteMilestoneDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.milestonesService.complete(
      user,
      fundraiserId,
      milestoneId,
      data,
    );
  }

  /**
   * List donations for a fundraiser
   * GET /api/v1/fundraisers/:fundraiserId/donations
   */
  @Get(':fundraiserId/donations')
  async listDonations(
    @Param('fundraiserId') fundraiserId: string,
    @Query() query: ListDonationsDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.donationsService.listByFundraiser(
      user,
      fundraiserId,
      query.status,
    );
  }

  /**
   * Add gallery items to a fundraiser
   * POST /api/v1/fundraisers/:fundraiserId/gallery
   */
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
  @Patch(':fundraiserId/gallery/reorder')
  async reorderGalleryItems(
    @Param('fundraiserId') fundraiserId: string,
    @Body() data: ReorderGalleryItemsDto,
    @AuthUser() user: UserEntity,
  ) {
    console.log('reorderGalleryItems', data);
    return this.fundraisersService.reorderGalleryItems(
      user,
      fundraiserId,
      data,
    );
  }

  /**
   * Update a gallery item caption
   * PATCH /api/v1/fundraisers/:fundraiserId/gallery/:galleryItemId
   */
  @Patch(':fundraiserId/gallery/:galleryItemId')
  async updateGalleryItem(
    @Param('fundraiserId') fundraiserId: string,
    @Param('galleryItemId') galleryItemId: string,
    @Body() data: UpdateGalleryItemDto,
    @AuthUser() user: UserEntity,
  ) {
    return this.fundraisersService.updateGalleryItem(
      user,
      fundraiserId,
      galleryItemId,
      data,
    );
  }

  /**
   * Delete a gallery item
   * DELETE /api/v1/fundraisers/:fundraiserId/gallery/:galleryItemId
   */
  @Delete(':fundraiserId/gallery/:galleryItemId')
  @HttpCode(204)
  async deleteGalleryItem(
    @Param('fundraiserId') fundraiserId: string,
    @Param('galleryItemId') galleryItemId: string,
    @AuthUser() user: UserEntity,
  ) {
    await this.fundraisersService.deleteGalleryItem(
      user,
      fundraiserId,
      galleryItemId,
    );
  }
}
