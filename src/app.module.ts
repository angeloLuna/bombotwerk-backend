import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { CollectionsModule } from './collections/collections.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';
import { CheckoutModule } from './checkout/checkout.module';

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    CollectionsModule,
    OrdersModule,
    PaymentsModule,
    AdminModule,
    CheckoutModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
