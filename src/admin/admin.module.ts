import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminProductsController } from './admin-products.controller';
import { AdminCollectionsController } from './admin-collections.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminCollectionsService } from './admin-collections.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminProductsController, AdminCollectionsController],
  providers: [AdminProductsService, AdminCollectionsService],
})
export class AdminModule {}
