import { Controller, Post, Body } from '@nestjs/common';
import { DonationsService } from './donations.service';
import { CreateCheckoutSessionDto } from './dtos/create-checkout-session.dto';
import { Public } from '../../common/decorators';
import { User as UserEntity } from '../../../generated/prisma';
import { AuthUser } from '../../common/decorators/user.decorator';

@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post('stripe/create-checkout-session')
  @Public()
  async createCheckoutSession(
    @Body() data: CreateCheckoutSessionDto,
    @AuthUser() user?: UserEntity,
  ) {
    return this.donationsService.createCheckoutSession(user || null, data);
  }
}
