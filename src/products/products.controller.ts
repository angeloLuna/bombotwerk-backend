import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getActiveProducts(
    @Query('category') category?: string,
    @Query('collection') collection?: string,
    @Query('availability') availability?: string,
    @Query('sort') sort?: string,
    @Query('search') search?: string,
  ) {
    return this.productsService.findAllActive({
      category,
      collection,
      availability,
      sort,
      search,
    });
  }

  @Get(':slug')
  async getProductBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }
}
