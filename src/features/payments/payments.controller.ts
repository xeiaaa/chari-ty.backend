import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PaymentsService } from './payments.service';
import { CreateConnectAccountDto } from './dtos/create-connect-account.dto';
import { CreateIntentDto } from './dtos/create-intent.dto';
import { DisconnectAccountDto } from './dtos/disconnect-account.dto';
import { User } from '../../../generated/prisma';
import { AuthUser, Public } from '../../common/decorators';

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
    @AuthUser() user: User,
  ): Promise<{ url: string }> {
    return this.paymentsService.createConnectAccount(
      user,
      createConnectAccountDto.groupId,
    );
  }

  /**
   * Disconnect a Stripe Connect account for a group
   */
  @UseGuards(AuthGuard)
  @Post('stripe/disconnect')
  async disconnectAccount(
    @Body() disconnectAccountDto: DisconnectAccountDto,
    @AuthUser() user: User,
  ): Promise<{ message: string }> {
    return this.paymentsService.disconnectStripeAccount(
      user,
      disconnectAccountDto.groupId,
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
