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
} from '@nestjs/common';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dtos/create-link.dto';
import { UpdateLinkDto } from './dtos/update-link.dto';
import { ListLinksDto } from './dtos/list-links.dto';
import { AuthUser } from '../../common/decorators';

@Controller('fundraisers/:fundraiserId/links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  /**
   * Get all links for a fundraiser
   * GET /fundraisers/:fundraiserId/links
   */
  @Get()
  async getLinks(
    @Param('fundraiserId') fundraiserId: string,
    @AuthUser('id') userId: string,
    @Query() query: ListLinksDto,
  ) {
    return this.linksService.getLinks(fundraiserId, userId, query);
  }

  /**
   * Get a specific link by ID
   * GET /fundraisers/:fundraiserId/links/:linkId
   */
  @Get(':linkId')
  async getLinkById(
    @Param('fundraiserId') fundraiserId: string,
    @Param('linkId') linkId: string,
    @AuthUser('id') userId: string,
  ) {
    return this.linksService.getLinkById(fundraiserId, linkId, userId);
  }

  /**
   * Create a new link
   * POST /fundraisers/:fundraiserId/links
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createLink(
    @Param('fundraiserId') fundraiserId: string,
    @AuthUser('id') userId: string,
    @Body() createLinkDto: CreateLinkDto,
  ) {
    return this.linksService.createLink(fundraiserId, userId, createLinkDto);
  }

  /**
   * Update an existing link
   * PATCH /fundraisers/:fundraiserId/links/:linkId
   */
  @Patch(':linkId')
  async updateLink(
    @Param('fundraiserId') fundraiserId: string,
    @Param('linkId') linkId: string,
    @AuthUser('id') userId: string,
    @Body() updateLinkDto: UpdateLinkDto,
  ) {
    return this.linksService.updateLink(
      fundraiserId,
      linkId,
      userId,
      updateLinkDto,
    );
  }

  /**
   * Delete a link
   * DELETE /fundraisers/:fundraiserId/links/:linkId
   */
  @Delete(':linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLink(
    @Param('fundraiserId') fundraiserId: string,
    @Param('linkId') linkId: string,
    @AuthUser('id') userId: string,
  ) {
    return this.linksService.deleteLink(fundraiserId, linkId, userId);
  }
}
