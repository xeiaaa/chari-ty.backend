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
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../../common/decorators';
import { User as UserEntity } from '../../../generated/prisma';
import { MilestonesService } from '../milestones/milestones.service';
import { CreateMilestoneDto } from '../milestones/dtos/create-milestone.dto';
import { UpdateMilestoneDto } from '../milestones/dtos/update-milestone.dto';

@Controller('fundraisers')
@UseGuards(AuthGuard)
export class FundraisersController {
  constructor(
    private readonly fundraisersService: FundraisersService,
    private readonly milestonesService: MilestonesService,
  ) {}

  /**
   * Create a new fundraiser
   * POST /api/v1/fundraisers
   */
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
  @Get(':fundraiserId')
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
  async findBySlug(@Param('slug') slug: string, @AuthUser() user: UserEntity) {
    return await this.fundraisersService.findBySlug(user, slug);
  }

  /**
   * Update a fundraiser
   * PATCH /api/v1/fundraisers/:fundraiserId
   */
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
  @Delete(':fundraiserId')
  @HttpCode(204)
  async delete(
    @Param('fundraiserId') fundraiserId: string,
    @AuthUser() user: UserEntity,
  ) {
    await this.fundraisersService.delete(user, fundraiserId);
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
}
