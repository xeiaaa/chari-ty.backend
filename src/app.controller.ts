import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators';

import Stripe from 'stripe';

const key =
  'sk_test_51Rm2H1BRqGZQDQEgIsO2POgZtWoH2Vxa3qS4S9VvmsZNRM62X61RhXtJOU2mMqp4G4kxMbqIpUT0sPH9ff6ICXFm00ndkVxZiB';
const stripe = new Stripe(key);

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('stripe-test')
  @Public()
  async stripeTest(): Promise<any> {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Chari-ty Test Donation',
            },
            unit_amount: 5000, // $50.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'http://localhost:3001/success',
      cancel_url: 'http://localhost:3001/cancel',
      metadata: {
        fundraiserId: '123',
        myappname: 'Chari-ty',
      },
    });

    return session;
  }
}
