import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { FundraisersService } from './fundraisers.service';
import { CreateFundraiserDto } from './dtos/create-fundraiser.dto';
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
}
