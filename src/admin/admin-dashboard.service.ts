import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Sales Aggregations (Only paid orders)
    const todaySalesAgg = await this.prisma.order.aggregate({
      where: {
        status: 'paid',
        createdAt: { gte: startOfToday },
      },
      _sum: { total: true },
    });

    const monthSalesAgg = await this.prisma.order.aggregate({
      where: {
        status: 'paid',
        createdAt: { gte: startOfMonth },
      },
      _sum: { total: true },
    });

    // Counts by Payment Status
    const totalOrders = await this.prisma.order.count();
    const paidOrders = await this.prisma.order.count({ where: { status: 'paid' } });
    const pendingOrders = await this.prisma.order.count({ where: { status: 'pending' } });
    const failedCancelledOrders = await this.prisma.order.count({
      where: { status: { in: ['failed', 'cancelled'] } },
    });

    // Counts by Operational Fulfillment Status
    const ordersToPrepare = await this.prisma.order.count({
      where: {
        status: 'paid',
        fulfillmentStatus: { in: ['pending_review', 'paid', 'preparing', 'in_production', 'ready_to_ship'] },
      },
    });

    const madeToOrderOrders = await this.prisma.order.count({
      where: { hasMadeToOrderItems: true },
    });

    const mixedOrders = await this.prisma.order.count({
      where: { isMixedFulfillmentCart: true },
    });

    // Inventory Alerts
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        variants: {
          select: {
            availabilityMode: true,
            stocks: {
              select: {
                quantity: true,
              },
            },
          },
        },
      },
    });

    let outOfStockCount = 0;
    let lowStockCount = 0;
    let madeToOrderActiveCount = 0;

    for (const p of products) {
      let totalStock = 0;
      let hasMto = false;
      for (const v of p.variants) {
        if (v.availabilityMode === 'made_to_order_only' || v.availabilityMode === 'stock_and_made_to_order') {
          hasMto = true;
        }
        for (const s of v.stocks) {
          totalStock += s.quantity;
        }
      }

      if (hasMto) {
        madeToOrderActiveCount++;
      }

      if (totalStock === 0) {
        outOfStockCount++;
      } else if (totalStock <= 2) {
        lowStockCount++;
      }
    }

    // Latest Registered Users
    const latestUsers = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        role: true,
      },
    });

    // Latest Orders
    const latestOrdersRaw = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        payment: true,
      },
    });

    const latestOrders = latestOrdersRaw.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      total: Number(order.total),
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      createdAt: order.createdAt,
    }));

    return {
      sales: {
        today: Number(todaySalesAgg._sum.total || 0),
        month: Number(monthSalesAgg._sum.total || 0),
      },
      orders: {
        total: totalOrders,
        paid: paidOrders,
        pending: pendingOrders,
        failedCancelled: failedCancelledOrders,
        toPrepare: ordersToPrepare,
        madeToOrder: madeToOrderOrders,
        mixed: mixedOrders,
      },
      inventory: {
        outOfStock: outOfStockCount,
        lowStock: lowStockCount,
        madeToOrderActive: madeToOrderActiveCount,
      },
      latestUsers,
      latestOrders,
    };
  }
}
