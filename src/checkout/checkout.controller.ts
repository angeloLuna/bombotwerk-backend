import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutPaymentDto } from './dto/checkout-payment.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('payment')
  @HttpCode(HttpStatus.OK)
  async processPayment(@Body() dto: CheckoutPaymentDto) {
    return this.checkoutService.processPayment(dto);
  }
}
