import { Controller, Get, Query, Param, UseInterceptors } from '@nestjs/common';
import { FundraisersListCacheInterceptor } from '../../common/interceptors/fundraisers-list-cache.interceptor';
import { FundraiserSlugCacheInterceptor } from '../../common/interceptors/fundraiser-slug-cache.interceptor';
import { FundraiserDonationsCacheInterceptor } from '../../common/interceptors/fundraiser-donations-cache.interceptor';
import { FundraiserCategoriesCacheInterceptor } from '../../common/interceptors/fundraiser-categories-cache.interceptor';
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
  @UseInterceptors(FundraisersListCacheInterceptor)
  async listPublic(@Query() query: ListPublicFundraisersDto) {
    console.log('listPublic', query);
    return await this.fundraisersService.listPublic(query);
  }

  /**
   * Get a single public fundraiser by slug
   * GET /api/v1/public/fundraisers/slug/:slug
   */
  @Public()
  @Get('slug/:slug')
  @UseInterceptors(FundraiserSlugCacheInterceptor)
  async findPublicBySlug(@Param('slug') slug: string) {
    return await this.fundraisersService.findPublicBySlug(slug);
  }

  /**
   * List donations for a public fundraiser by slug
   * GET /api/v1/public/fundraisers/slug/:slug/donations
   */
  @Public()
  @Get('slug/:slug/donations')
  @UseInterceptors(FundraiserDonationsCacheInterceptor)
  async listPublicDonations(
    @Param('slug') slug: string,
    @Query() query: ListDonationsDto,
  ) {
    return await this.donationsService.listPublicBySlug(slug, query.status);
  }

  /**
   * Get categories with counts of published fundraisers
   * GET /api/v1/public/fundraisers/categories
   */
  @Public()
  @Get('categories')
  @UseInterceptors(FundraiserCategoriesCacheInterceptor)
  async getCategories() {
    return await this.fundraisersService.getCategoriesWithCounts();
  }
}
