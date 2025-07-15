import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Param,
  Patch,
} from '@nestjs/common';
import { FundraisersService } from './fundraisers.service';
import { CreateFundraiserDto } from './dtos/create-fundraiser.dto';
import { ListFundraisersDto } from './dtos/list-fundraisers.dto';
import { UpdateFundraiserDto } from './dtos/update-fundraiser.dto';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../../common/decorators';
import { User as UserEntity } from '../../../generated/prisma';

@Controller('fundraisers')
@UseGuards(AuthGuard)
export class FundraisersController {
  constructor(private readonly fundraisersService: FundraisersService) {}

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
}
