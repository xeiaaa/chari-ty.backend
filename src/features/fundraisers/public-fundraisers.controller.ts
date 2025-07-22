import { Controller, Get, Query, Param } from '@nestjs/common';
import { FundraisersService } from './fundraisers.service';
import { ListPublicFundraisersDto } from './dtos/list-public-fundraisers.dto';
import { Public } from '../../common/decorators/public.decorator';
import { DonationsService } from '../donations/donations.service';
import { ListDonationsDto } from '../donations/dtos/list-donations.dto';

/**
 * Public controller for fundraisers
 * These endpoints don't require authentication
 */
@Controller('public/fundraisers')
export class PublicFundraisersController {
  constructor(
    private readonly fundraisersService: FundraisersService,
    private readonly donationsService: DonationsService,
  ) {}

  /**
   * Get all public fundraisers
   * GET /api/v1/public/fundraisers
   */
  @Public()
  @Get()
  async listPublic(@Query() query: ListPublicFundraisersDto) {
    return await this.fundraisersService.listPublic(query);
  }

  /**
   * Get a single public fundraiser by slug
   * GET /api/v1/public/fundraisers/slug/:slug
   */
  @Public()
  @Get('slug/:slug')
  async findPublicBySlug(@Param('slug') slug: string) {
    return await this.fundraisersService.findPublicBySlug(slug);
  }

  /**
   * List donations for a public fundraiser by slug
   * GET /api/v1/public/fundraisers/slug/:slug/donations
   */
  @Public()
  @Get('slug/:slug/donations')
  async listPublicDonations(
    @Param('slug') slug: string,
    @Query() query: ListDonationsDto,
  ) {
    return await this.donationsService.listPublicBySlug(slug, query.status);
  }
}
