import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dtos/create-link.dto';
import { UpdateLinkDto } from './dtos/update-link.dto';
import { ListLinksDto } from './dtos/list-links.dto';
import { FundraiserAccessGuard } from '../fundraisers/guards/fundraiser-access.guard';
import { FundraiserRoles } from '../fundraisers/decorators/fundraiser-roles.decorator';
import { LinkOwnerGuard } from './guards/link-owner.guard';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../../common/decorators';
import { User } from '../../../generated/prisma';

@Controller('fundraisers/:fundraiserId/links')
@UseGuards(AuthGuard)
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  /**
   * Get all links for a fundraiser
   * GET /fundraisers/:fundraiserId/links
   */
  @UseGuards(FundraiserAccessGuard)
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute per user
  async getLinks(
    @Param('fundraiserId') fundraiserId: string,
    @Query() query: ListLinksDto,
  ) {
    return this.linksService.getLinks(fundraiserId, query);
  }

  /**
   * Get a specific link by ID
   * GET /fundraisers/:fundraiserId/links/:linkId
   */
  @UseGuards(FundraiserAccessGuard)
  @Get(':linkId')
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute per user
  async getLinkById(
    @Param('fundraiserId') fundraiserId: string,
    @Param('linkId') linkId: string,
  ) {
    return this.linksService.getLinkById(fundraiserId, linkId);
  }

  /**
   * Create a new link
   * POST /fundraisers/:fundraiserId/links
   */
  @UseGuards(FundraiserAccessGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute per user
  async createLink(
    @Param('fundraiserId') fundraiserId: string,
    @Body() createLinkDto: CreateLinkDto,
    @AuthUser() user: User,
  ) {
    return this.linksService.createLink(fundraiserId, createLinkDto, user);
  }

  /**
   * Update an existing link
   * PATCH /fundraisers/:fundraiserId/links/:linkId
   */
  @UseGuards(FundraiserAccessGuard, LinkOwnerGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Patch(':linkId')
  async updateLink(
    @Param('fundraiserId') fundraiserId: string,
    @Param('linkId') linkId: string,
    @Body() updateLinkDto: UpdateLinkDto,
  ) {
    return this.linksService.updateLink(fundraiserId, linkId, updateLinkDto);
  }

  /**
   * Delete a link
   * DELETE /fundraisers/:fundraiserId/links/:linkId
   */
  @UseGuards(FundraiserAccessGuard, LinkOwnerGuard)
  @FundraiserRoles(['admin', 'owner', 'editor'])
  @Delete(':linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLink(
    @Param('fundraiserId') fundraiserId: string,
    @Param('linkId') linkId: string,
  ) {
    return this.linksService.deleteLink(fundraiserId, linkId);
  }
}
