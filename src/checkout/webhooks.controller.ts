import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CheckoutService } from './checkout.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('mercadopago')
  @HttpCode(HttpStatus.OK)
  async handleMercadoPagoWebhook(@Body() body: any) {
    // Process asynchronously so we return 200 immediately
    this.checkoutService.handleWebhook(body).catch((err) => {
      console.error('[Webhook Processing Error]', err);
    });

    return { received: true };
  }
}
