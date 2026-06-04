import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminProductsController } from './admin-products.controller';
import { AdminCollectionsController } from './admin-collections.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminCollectionsService } from './admin-collections.service';
import { AdminOrdersService } from './admin-orders.service';

import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, StorageModule, EmailModule],
  controllers: [AdminProductsController, AdminCollectionsController, AdminOrdersController],
  providers: [AdminProductsService, AdminCollectionsService, AdminOrdersService],
})
export class AdminModule {}

