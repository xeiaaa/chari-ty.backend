import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { AccountType, DonationStatus } from '../../../generated/prisma';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  ClerkWebhookEvent,
  ClerkUserData,
  MappedUserData,
} from './dtos/clerk-webhook.dto';

/**
 * Service to handle Clerk webhook events
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Process a Clerk webhook event
   */
  async processClerkWebhook(event: ClerkWebhookEvent): Promise<void> {
    this.logger.log(`Processing Clerk webhook: ${event.type}`);

    try {
      switch (event.type) {
        case 'user.created':
          await this.handleUserCreated(event.data);
          break;
        case 'user.updated':
          await this.handleUserUpdated(event.data);
          break;
        case 'user.deleted':
          await this.handleUserDeleted(event.data);
          break;
        default:
          this.logger.warn(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing webhook event ${event.type}:`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Handle user.created event
   */
  private async handleUserCreated(userData: ClerkUserData): Promise<void> {
    this.logger.log(`Creating user from webhook: ${userData.id}`);
    const mappedData = this.mapClerkUserToUserData(userData);
    // Check if user already exists
    const existingUser = await this.usersService.findUserByClerkId(userData.id);
    if (existingUser) {
      this.logger.warn(`User with clerkId ${userData.id} already exists`);
      return;
    }
    // Generate username if not provided
    const username =
      mappedData.username ||
      this.generateUsername(mappedData.firstName, mappedData.lastName);

    // Create the user
    const newUser = await this.usersService.createUser({
      ...mappedData,
      username,
    });
    this.logger.log(`User created successfully: ${userData.id}`);
    // If this user was invited to a group, update the GroupMember row
    // See Clerk docs: public_metadata is transferred to the user on invite acceptance
    const publicMeta = userData.public_metadata || {};
    if (publicMeta.groupId && publicMeta.invitedByEmail && publicMeta.role) {
      // Find the GroupMember row by groupId and invitedEmail
      const groupMember = await this.prisma.groupMember.findFirst({
        where: {
          groupId: publicMeta.groupId,
          invitedEmail: mappedData.email,
          userId: null,
        },
      });
      if (groupMember) {
        await this.prisma.groupMember.update({
          where: { id: groupMember.id },
          data: {
            userId: newUser.id,
            invitedName: `${mappedData.firstName} ${mappedData.lastName}`,
            invitedEmail: mappedData.email,
            status: 'active',
          },
        });
        this.logger.log(
          `GroupMember updated for invited user (by publicMetadata): ${userData.id}`,
        );
      } else {
        this.logger.warn(
          `No GroupMember found for invited user (by publicMetadata): ${userData.id}`,
        );
      }
    }
  }

  /**
   * Handle user.updated event
   */
  private async handleUserUpdated(userData: ClerkUserData): Promise<void> {
    this.logger.log(`Updating user from webhook: ${userData.id}`);

    const existingUser = await this.usersService.findUserByClerkId(userData.id);
    if (!existingUser) {
      this.logger.warn(`User with clerkId ${userData.id} not found for update`);
      return;
    }

    const mappedData = this.mapClerkUserToUserData(userData);

    // Remove clerkId from update data since it shouldn't change
    const updateData = {
      email: mappedData.email,
      username: mappedData.username,
      firstName: mappedData.firstName,
      lastName: mappedData.lastName,
      avatarUrl: mappedData.avatarUrl,
      bio: mappedData.bio,
      accountType: mappedData.accountType,
      setupComplete: mappedData.setupComplete,
    };

    await this.usersService.updateUser(existingUser.id, updateData);
    this.logger.log(`User updated successfully: ${userData.id}`);
  }

  /**
   * Handle user.deleted event
   */
  private async handleUserDeleted(userData: ClerkUserData): Promise<void> {
    this.logger.log(`Deleting user from webhook: ${userData.id}`);

    const existingUser = await this.usersService.findUserByClerkId(userData.id);
    if (!existingUser) {
      this.logger.warn(
        `User with clerkId ${userData.id} not found for deletion`,
      );
      return;
    }

    await this.usersService.deleteUser(existingUser.id);
    this.logger.log(`User deleted successfully: ${userData.id}`);
  }

  /**
   * Process a Stripe webhook event
   */
  async processStripeWebhook(event: any): Promise<void> {
    this.logger.log(`Processing Stripe webhook: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;
        default:
          this.logger.warn(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing Stripe webhook event ${event.type}:`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Handle checkout.session.completed event
   */
  private async handleCheckoutSessionCompleted(session: any): Promise<void> {
    this.logger.log(`Processing checkout session completed: ${session.id}`);

    const metadata = session.metadata;
    if (!metadata?.donationId || !metadata?.fundraiserId) {
      this.logger.warn(
        'Missing required metadata in checkout session',
        metadata,
      );
      return;
    }

    // Update donation status to completed
    const donation = await this.prisma.donation.update({
      where: { id: metadata.donationId },
      data: { status: DonationStatus.completed },
    });

    this.logger.log(`Donation ${donation.id} marked as completed`);

    // Calculate total donations for the fundraiser
    const totalDonations = await this.prisma.donation.aggregate({
      where: {
        fundraiserId: metadata.fundraiserId,
        status: DonationStatus.completed,
      },
      _sum: { amount: true },
    });

    const totalAmount = totalDonations._sum.amount || new Decimal(0);

    // Update milestone achievements with cumulative logic
    await this.updateMilestoneAchievements(metadata.fundraiserId, totalAmount);

    this.logger.log(
      `Updated milestone achievements for fundraiser ${metadata.fundraiserId}`,
    );
  }

  /**
   * Update milestone achievements based on cumulative amounts
   */
  private async updateMilestoneAchievements(
    fundraiserId: string,
    totalAmount: Decimal,
  ): Promise<void> {
    // Get all milestones for this fundraiser ordered by step number
    const milestones = await this.prisma.milestone.findMany({
      where: { fundraiserId },
      orderBy: { stepNumber: 'asc' },
    });

    let cumulativeAmount = new Decimal(0);

    // Calculate cumulative amounts and update achievements
    for (const milestone of milestones) {
      cumulativeAmount = cumulativeAmount.add(milestone.amount);

      // Check if this milestone should be achieved
      const shouldBeAchieved = totalAmount.gte(cumulativeAmount);

      // Update milestone if status has changed
      if (shouldBeAchieved && !milestone.achieved) {
        await this.prisma.milestone.update({
          where: { id: milestone.id },
          data: {
            achieved: true,
            achievedAt: new Date(),
          },
        });
        this.logger.log(`Milestone ${milestone.id} achieved`);
      } else if (!shouldBeAchieved && milestone.achieved) {
        // Handle case where milestone was achieved but should no longer be
        // (e.g., if donation was refunded)
        await this.prisma.milestone.update({
          where: { id: milestone.id },
          data: {
            achieved: false,
            achievedAt: null,
          },
        });
        this.logger.log(`Milestone ${milestone.id} no longer achieved`);
      }
    }
  }

  /**
   * Generate a username from first and last name
   */
  private generateUsername(firstName: string, lastName: string): string {
    const baseUsername =
      `${firstName.toLowerCase()}${lastName.toLowerCase()}`.replace(
        /[^a-z0-9]/g,
        '',
      );
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    return `${baseUsername}${randomSuffix}`;
  }

  /**
   * Map Clerk user data to our User model
   */
  private mapClerkUserToUserData(userData: ClerkUserData): MappedUserData {
    // Get primary email address
    const primaryEmail = userData.email_addresses.find(
      (email) => email.id === userData.primary_email_address_id,
    );

    if (!primaryEmail) {
      throw new Error(`No primary email found for user ${userData.id}`);
    }

    // Default to individual account type - this can be customized based on metadata
    let accountType: AccountType = AccountType.individual;

    // Check public_metadata for account type
    if (userData.public_metadata?.accountType) {
      const metadataAccountType = userData.public_metadata.accountType
        .toString()
        .toLowerCase();
      if (
        Object.values(AccountType).includes(metadataAccountType as AccountType)
      ) {
        accountType = metadataAccountType as AccountType;
      }
    }

    return {
      clerkId: userData.id,
      email: primaryEmail.email_address,
      username: userData.username || undefined,
      firstName: userData.first_name || '',
      lastName: userData.last_name || '',
      avatarUrl: userData.image_url || undefined,
      bio: userData.public_metadata?.bio || undefined,
      accountType,
      setupComplete: userData.public_metadata?.setupComplete || false,
    };
  }

  /**
   * Verify webhook signature using Clerk's webhook signing method
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    // Allow bypass in development for easier testing
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(
        'Bypassing webhook signature verification in development',
      );
      return true;
    }

    try {
      if (!signature || !secret) {
        this.logger.error(
          'Missing signature or secret for webhook verification',
        );
        return false;
      }

      // Parse Clerk signature header format: "t=timestamp,v1=signature"
      const signatureParts = signature.split(',');
      let timestamp: string | undefined;
      let v1Signature: string | undefined;

      for (const part of signatureParts) {
        const [key, value] = part.split('=');
        if (key === 't') {
          timestamp = value;
        } else if (key === 'v1') {
          v1Signature = value;
        }
      }

      if (!timestamp || !v1Signature) {
        this.logger.error('Invalid signature format');
        return false;
      }

      // Check timestamp (prevent replay attacks - allow 5 minute tolerance)
      const webhookTimestamp = parseInt(timestamp, 10);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const timestampTolerance = 300; // 5 minutes

      if (Math.abs(currentTimestamp - webhookTimestamp) > timestampTolerance) {
        this.logger.error('Webhook timestamp outside tolerance window');
        return false;
      }

      // Create signed payload: timestamp + . + payload
      const signedPayload = `${timestamp}.${payload}`;

      // Compute expected signature using HMAC-SHA256
      const expectedSignature = createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');

      // Compare signatures using timing-safe comparison
      const signatureBuffer = Buffer.from(v1Signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (signatureBuffer.length !== expectedBuffer.length) {
        this.logger.error('Signature length mismatch');
        return false;
      }

      const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);

      if (!isValid) {
        this.logger.error('Webhook signature verification failed');
      } else {
        this.logger.debug('Webhook signature verified successfully');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error during webhook signature verification:', error);
      return false;
    }
  }
}
