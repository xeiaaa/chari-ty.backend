import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { GroupsService } from '../groups/groups.service';
import { FundraisersService } from '../fundraisers/fundraisers.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { User } from '../../../generated/prisma';
import { CreateIntentDto } from './dtos/create-intent.dto';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * PaymentsService handles Stripe Connect account operations
 */
@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly groupsService: GroupsService,
    @Inject(forwardRef(() => FundraisersService))
    private readonly fundraisersService: FundraisersService,
    private readonly prisma: PrismaService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-06-30.basil',
    });
  }

  /**
   * Create a Stripe Connect account for a group
   */
  async createConnectAccount(
    user: User,
    groupId: string,
  ): Promise<{ url: string }> {
    // Find the group and verify ownership
    const group = await this.groupsService.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.ownerId !== user.id) {
      throw new BadRequestException('You are not allowed to link this group');
    }

    // Create Connect account only if not yet linked
    if (!group.stripeId) {
      const account = await this.stripe.accounts.create({
        type: 'standard',
        email: user.email,
        metadata: {
          ownerUserId: user.id,
          groupId: group.id,
        },
      });

      await this.groupsService.updateStripeId(group.id, account.id);
      group.stripeId = account.id;
    }

    // Create account link for onboarding
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      throw new Error('FRONTEND_URL environment variable is required');
    }

    const accountLink = await this.stripe.accountLinks.create({
      account: group.stripeId,
      refresh_url: `${frontendUrl}/payments/refresh`,
      return_url: `${frontendUrl}/payments/return`,
      type: 'account_onboarding',
    });

    return { url: accountLink.url };
  }

  /**
   * Create a Stripe PaymentIntent and a pending donation
   */
  async createPaymentIntent(
    dto: CreateIntentDto,
  ): Promise<{ clientSecret: string }> {
    // Fetch fundraiser (must include group and currency)
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: dto.fundraiserId },
      include: { group: true },
    });
    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }
    if (!fundraiser.group.stripeId) {
      throw new BadRequestException(
        'Fundraiser group is not connected to Stripe',
      );
    }
    // Calculate amounts
    const amountInCents = Math.round(dto.amount * 100);
    const applicationFeeAmount = Math.round(amountInCents * 0.05);
    // 1. Create pending donation (without stripeId)
    const donation = await this.prisma.donation.create({
      data: {
        amount: new Decimal(dto.amount),
        currency: fundraiser.currency,
        fundraiserId: dto.fundraiserId,
        fundraiserLinkId: dto.fundraiserLinkId,
        name: dto.name,
        message: dto.message,
        isAnonymous: dto.isAnonymous,
        status: 'pending',
      },
    });
    // 2. Create PaymentIntent with donation.id in metadata
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: fundraiser.currency,
      payment_method_types: ['card'],
      transfer_data: {
        destination: fundraiser.group.stripeId,
      },
      application_fee_amount: applicationFeeAmount,
      metadata: {
        donationId: donation.id,
        fundraiserId: dto.fundraiserId,
        fundraiserLinkId: dto.fundraiserLinkId || '',
      },
    });
    // 3. Update donation with stripeId
    await this.prisma.donation.update({
      where: { id: donation.id },
      data: { stripeId: paymentIntent.id },
    });
    return { clientSecret: paymentIntent.client_secret || '' };
  }

  /**
   * Disconnect a Stripe Connect account for a group
   */
  async disconnectStripeAccount(
    user: User,
    groupId: string,
  ): Promise<{ message: string }> {
    // Find the group and verify ownership
    const group = await this.groupsService.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.ownerId !== user.id) {
      throw new BadRequestException(
        'You are not allowed to disconnect this group',
      );
    }

    if (!group.stripeId) {
      throw new BadRequestException('Group is not connected to Stripe');
    }

    // Check if group has published fundraisers
    const publishedFundraisers = await this.prisma.fundraiser.findMany({
      where: {
        groupId: group.id,
        status: 'published',
      },
    });

    if (publishedFundraisers.length > 0) {
      throw new BadRequestException(
        'Cannot disconnect Stripe account while group has published fundraisers. Please unpublish all fundraisers first.',
      );
    }

    // Disconnect the Stripe account by setting stripeId to null
    await this.groupsService.updateStripeId(group.id, null);

    return { message: 'Stripe account disconnected successfully' };
  }
}
