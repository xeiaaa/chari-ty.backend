import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PaymentsService } from './payments.service';
import { CreateConnectAccountDto } from './dtos/create-connect-account.dto';
import { CreateIntentDto } from './dtos/create-intent.dto';
import { User } from '../../../generated/prisma';
import { Public } from 'src/common/decorators';

/**
 * PaymentsController handles payment-related endpoints
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Create a Stripe Connect account for a group
   */
  @UseGuards(AuthGuard)
  @Post('stripe/connect')
  async createConnectAccount(
    @Body() createConnectAccountDto: CreateConnectAccountDto,
    @Req() req: Request,
  ): Promise<{ url: string }> {
    const user = req.authUser as User;
    return this.paymentsService.createConnectAccount(
      user,
      createConnectAccountDto.groupId,
    );
  }

  /**
   * Create a Stripe PaymentIntent for a donation
   */
  @Post('stripe/create-intent')
  @Public()
  async createIntent(
    @Body() createIntentDto: CreateIntentDto,
  ): Promise<{ clientSecret: string }> {
    return this.paymentsService.createPaymentIntent(createIntentDto);
  }
}
