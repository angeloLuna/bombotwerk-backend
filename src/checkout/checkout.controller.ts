import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutPaymentDto, CalculateShippingDto } from './dto/checkout-payment.dto';
import { CheckoutPricingService } from './checkout-pricing.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly pricingService: CheckoutPricingService,
  ) {}

  @Post('payment')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  async processPayment(@Body() dto: CheckoutPaymentDto, @Req() req: any) {
    return this.checkoutService.processPayment(dto, req.user);
  }

  @Post('calculate-shipping')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  async calculateShipping(@Body() dto: CalculateShippingDto, @Req() req: any) {
    const user = req.user;
    const bypass = dto.bypassShipping && user?.role === 'admin';
    return this.pricingService.calculateShipping(
      dto.cartItems,
      !!dto.splitShippingSelected,
      !!bypass
    );
  }
}


