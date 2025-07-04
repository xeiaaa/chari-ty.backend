import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpException,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../common/decorators';
import { WebhooksService } from './webhooks.service';
import { ClerkWebhookEvent } from './dtos/clerk-webhook.dto';

/**
 * Controller to handle webhook endpoints
 */
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * Handle Clerk webhook events
   * POST /api/v1/webhooks/clerk
   */
  @Public()
  @Post('clerk')
  async handleClerkWebhook(
    @Body() event: ClerkWebhookEvent,
    @Headers('clerk-signature') clerkSignature: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Verify webhook signature in production
      if (process.env.NODE_ENV === 'production') {
        const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
        if (!webhookSecret) {
          throw new HttpException(
            'Webhook secret not configured',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        // Get raw body for signature verification
        const rawBody = req.body?.toString() || JSON.stringify(event);

        const isValid = this.webhooksService.verifyWebhookSignature(
          rawBody,
          clerkSignature,
          webhookSecret,
        );

        if (!isValid) {
          throw new HttpException(
            'Invalid webhook signature',
            HttpStatus.UNAUTHORIZED,
          );
        }
      }

      // Process the webhook event
      await this.webhooksService.processClerkWebhook(event);

      return {
        success: true,
        message: `Successfully processed ${event.type} event`,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to process webhook: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check endpoint for webhook testing
   * GET /api/v1/webhooks/test
   */
  @Public()
  @Post('test')
  testWebhook(): { status: string; timestamp: string } {
    return {
      status: 'Webhook endpoint is working',
      timestamp: new Date().toISOString(),
    };
  }
}
