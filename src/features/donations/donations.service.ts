import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateCheckoutSessionDto } from './dtos/create-checkout-session.dto';
import Stripe from 'stripe';
import { User } from '../../../generated/prisma';

@Injectable()
export class DonationsService {
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(stripeSecretKey);
  }

  async createCheckoutSession(
    user: User | null,
    data: CreateCheckoutSessionDto,
  ) {
    // Verify fundraiser exists and is published
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: data.fundraiserId },
    });

    if (!fundraiser) {
      throw new BadRequestException('Fundraiser not found');
    }

    if (fundraiser.status !== 'published') {
      throw new BadRequestException('Fundraiser is not published');
    }

    // Find fundraiser link if alias provided
    let fundraiserLinkId: string | null = null;
    if (data.alias) {
      const link = await this.prisma.fundraiserLink.findUnique({
        where: {
          unique_fundraiser_alias: {
            fundraiserId: fundraiser.id,
            alias: data.alias,
          },
        },
      });
      fundraiserLinkId = link?.id || null;
    }

    // Create donation record
    const donation = await this.prisma.donation.create({
      data: {
        fundraiserId: fundraiser.id,
        donorId: user?.id,
        amount: data.amount,
        currency: data.currency,
        name: data.name,
        message: data.message,
        isAnonymous: data.isAnonymous ?? false,
        fundraiserLinkId,
      },
    });

    const frontendUrl = this.configService.get('FRONTEND_URL');
    if (!frontendUrl) {
      throw new Error('FRONTEND_URL is not configured');
    }

    // Create Stripe checkout session
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'] as const,
      line_items: [
        {
          price_data: {
            currency: data.currency.toLowerCase(),
            product_data: {
              name: `Donation to ${fundraiser.title}`,
              description: data.message || undefined,
            },
            unit_amount: data.amount * 100, // Amount should be in smallest currency unit (e.g., cents)
          },
          quantity: 1,
        },
      ],
      mode: 'payment' as const,
      success_url:
        data.successUrl ||
        `${frontendUrl}/fundraisers/${fundraiser.slug}/thank-you`,
      cancel_url:
        data.cancelUrl || `${frontendUrl}/fundraisers/${fundraiser.slug}`,
      metadata: {
        donationId: donation.id,
        fundraiserId: fundraiser.id,
        donorId: user?.id || '',
        isAnonymous: data.isAnonymous ? 'true' : 'false',
      },
    });

    // Update donation with Stripe session ID
    await this.prisma.donation.update({
      where: { id: donation.id },
      data: { stripeId: session.id },
    });

    return {
      sessionId: session.id,
      sessionUrl: session.url,
    };
  }
}
