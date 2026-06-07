import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminProductsController } from './admin-products.controller';
import { AdminCollectionsController } from './admin-collections.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminLogsController } from './admin-logs.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminCollectionsService } from './admin-collections.service';
import { AdminOrdersService } from './admin-orders.service';
import { AdminUsersService } from './admin-users.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminMerchandisingController } from './admin-merchandising.controller';
import { AdminMerchandisingService } from './admin-merchandising.service';

import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, StorageModule, EmailModule],
  controllers: [
    AdminProductsController,
    AdminCollectionsController,
    AdminOrdersController,
    AdminUsersController,
    AdminLogsController,
    AdminDashboardController,
    AdminMerchandisingController,
  ],
  providers: [
    AdminProductsService,
    AdminCollectionsService,
    AdminOrdersService,
    AdminUsersService,
    AdminDashboardService,
    AdminMerchandisingService,
  ],
})
export class AdminModule {}

