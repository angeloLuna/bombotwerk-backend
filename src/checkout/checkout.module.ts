import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckoutController } from './checkout.controller';
import { WebhooksController } from './webhooks.controller';
import { CheckoutService } from './checkout.service';
import { CheckoutPricingService } from './checkout-pricing.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [CheckoutController, WebhooksController],
  providers: [CheckoutService, CheckoutPricingService],
  exports: [CheckoutPricingService],
})
export class CheckoutModule {}
