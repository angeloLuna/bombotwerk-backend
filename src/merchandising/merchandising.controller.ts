import { Controller, Get } from '@nestjs/common';
import { MerchandisingService } from './merchandising.service';

@Controller('merchandising')
export class MerchandisingController {
  constructor(private readonly service: MerchandisingService) {}

  @Get('product-type-cards')
  getProductTypeCards() {
    return this.service.getProductTypeCards();
  }
}
