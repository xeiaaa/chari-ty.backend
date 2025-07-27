import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateCheckoutSessionDto } from './dtos/create-checkout-session.dto';
import { ListGroupDonationsDto } from './dtos/list-group-donations.dto';
import Stripe from 'stripe';
import { User, DonationStatus } from '../../../generated/prisma';

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

  /**
   * List donations for a specific fundraiser
   */
  async listByFundraiser(
    user: User,
    fundraiserId: string,
    status?: DonationStatus,
  ) {
    // Verify fundraiser exists and user has access
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
    });

    if (!fundraiser) {
      throw new BadRequestException('Fundraiser not found');
    }

    // Check if user has access to this fundraiser's group
    const groupMember = await this.prisma.groupMember.findFirst({
      where: {
        groupId: fundraiser.groupId,
        userId: user.id,
        status: 'active',
      },
    });

    if (!groupMember) {
      throw new BadRequestException('Access denied');
    }

    // Build where clause
    const where: any = {
      fundraiserId,
    };

    if (status) {
      where.status = status;
    }

    // Get donations
    const donations = await this.prisma.donation.findMany({
      where,
      include: {
        donor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            avatarUrl: true,
          },
        },
        sourceLink: {
          select: {
            alias: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate totals
    const totalDonations = await this.prisma.donation.count({ where });
    const totalAmount = await this.prisma.donation.aggregate({
      where: {
        ...where,
        status: DonationStatus.completed,
      },
      _sum: {
        amount: true,
      },
    });

    return {
      items: donations,
      meta: {
        total: totalDonations,
        totalAmount: totalAmount._sum.amount || 0,
      },
    };
  }

  /**
   * List public donations for a fundraiser by slug
   */
  async listPublicBySlug(slug: string, status?: DonationStatus) {
    // Verify fundraiser exists and is public
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { slug },
    });

    if (!fundraiser) {
      throw new BadRequestException('Fundraiser not found');
    }

    if (!fundraiser.isPublic || fundraiser.status !== 'published') {
      throw new BadRequestException('Fundraiser is not public');
    }

    // Build where clause - only show completed donations for public view
    const where: any = {
      fundraiserId: fundraiser.id,
      status: DonationStatus.completed,
    };

    // If a specific status is requested, use it instead of defaulting to completed
    if (status) {
      where.status = status;
    }

    // Get donations
    const donations = await this.prisma.donation.findMany({
      where,
      include: {
        donor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            avatarUrl: true,
          },
        },
        sourceLink: {
          select: {
            alias: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate totals
    const totalDonations = await this.prisma.donation.count({ where });
    const totalAmount = await this.prisma.donation.aggregate({
      where: {
        ...where,
        status: DonationStatus.completed,
      },
      _sum: {
        amount: true,
      },
    });

    return {
      items: donations,
      meta: {
        total: totalDonations,
        totalAmount: totalAmount._sum.amount || 0,
      },
    };
  }

  /**
   * List donations for a group with pagination, sorting, and filtering
   */
  async listByGroup(
    user: User,
    groupSlug: string,
    query: ListGroupDonationsDto,
  ) {
    // Verify group exists and user has access
    const group = await this.prisma.group.findUnique({
      where: { slug: groupSlug },
      include: {
        members: {
          where: {
            userId: user.id,
            status: 'active',
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.members.length === 0) {
      throw new ForbiddenException('You do not have access to this group');
    }

    // Build where clause for donations
    const where: any = {
      fundraiser: {
        groupId: group.id,
      },
    };

    // Apply filters
    if (query.fundraiserId) {
      where.fundraiserId = query.fundraiserId;
    }

    if (query.fundraiserLinkId) {
      where.fundraiserLinkId = query.fundraiserLinkId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.isAnonymous !== undefined) {
      where.isAnonymous = query.isAnonymous;
    }

    if (query.currency) {
      where.currency = query.currency;
    }

    if (query.updatedAt) {
      where.updatedAt = {
        gte: new Date(query.updatedAt),
      };
    }

    // Calculate pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Build order by clause
    const orderBy: any = {};
    orderBy[query.sortBy || 'createdAt'] = query.sortOrder || 'desc';

    // Get donations with pagination
    const [donations, totalCount] = await Promise.all([
      this.prisma.donation.findMany({
        where,
        include: {
          fundraiser: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
          donor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              avatarUrl: true,
            },
          },
          sourceLink: {
            select: {
              id: true,
              alias: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.donation.count({ where }),
    ]);

    // Calculate total amount for completed donations
    const totalAmount = await this.prisma.donation.aggregate({
      where: {
        ...where,
        status: DonationStatus.completed,
      },
      _sum: {
        amount: true,
      },
    });

    return {
      items: donations,
      meta: {
        total: totalCount,
        totalAmount: totalAmount._sum.amount || 0,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }
}
