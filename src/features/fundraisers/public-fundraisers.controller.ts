import { Controller, Get, Query, Param } from '@nestjs/common';
import { FundraisersService } from './fundraisers.service';
import { ListPublicFundraisersDto } from './dtos/list-public-fundraisers.dto';
import { Public } from '../../common/decorators';

/**
 * Public controller for fundraisers
 * These endpoints don't require authentication
 */
@Controller('public/fundraisers')
export class PublicFundraisersController {
  constructor(private readonly fundraisersService: FundraisersService) {}

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
}
