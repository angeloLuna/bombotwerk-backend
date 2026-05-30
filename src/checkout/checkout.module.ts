import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckoutController } from './checkout.controller';
import { WebhooksController } from './webhooks.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [PrismaModule],
  controllers: [CheckoutController, WebhooksController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
