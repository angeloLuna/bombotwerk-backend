import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

function sanitizeLikePattern(val: string): string {
  return val.replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_');
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    page?: string;
    limit?: string;
    email?: string;
    name?: string;
    hasOrders?: string;
    isRegistered?: string;
    isGuest?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const page = Math.max(1, parseInt(query.page || '1') || 1);
    const limit = Math.max(1, parseInt(query.limit || '20') || 20);
    const offset = (page - 1) * limit;

    const filterConditions: string[] = ['1=1'];
    
    if (query.email) {
      const escapedEmail = `%${sanitizeLikePattern(query.email)}%`;
      filterConditions.push(`e.email ILIKE '${escapedEmail}'`);
    }

    if (query.name) {
      const escapedName = `%${sanitizeLikePattern(query.name)}%`;
      filterConditions.push(`(u.name ILIKE '${escapedName}' OR c.name ILIKE '${escapedName}')`);
    }

    if (query.hasOrders === 'true') {
      filterConditions.push(`COALESCE(c_orders.order_count, 0) > 0`);
    }

    if (query.isRegistered === 'true') {
      filterConditions.push(`u.id IS NOT NULL`);
    }

    if (query.isGuest === 'true') {
      filterConditions.push(`u.id IS NULL`);
    }

    const whereClause = filterConditions.join(' AND ');

    const sortFieldMap: Record<string, string> = {
      createdAt: 'createdAt',
      lastOrderDate: 'lastOrderDate',
      totalSpent: 'totalSpent',
      orderCount: 'orderCount',
      email: 'email',
      name: 'name',
    };

    const sortBy = sortFieldMap[query.sortBy || ''] || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const countQuery = `
      SELECT COUNT(DISTINCT e.email)::int as count
      FROM (
        SELECT email FROM "User"
        UNION
        SELECT email FROM "Customer"
      ) e
      LEFT JOIN "User" u ON u.email = e.email
      LEFT JOIN "Customer" c ON c.email = e.email
      LEFT JOIN (
        SELECT 
          "customerEmail" as email,
          COUNT(id) as order_count
        FROM "Order"
        GROUP BY "customerEmail"
      ) c_orders ON c_orders.email = e.email
      WHERE ${whereClause}
    `;

    const dataQuery = `
      WITH unified_users AS (
        SELECT 
          e.email,
          COALESCE(u.name, c.name) as name,
          u.id as "userId",
          c.id as "customerId",
          CASE 
            WHEN u.role = 'admin' THEN 'admin'
            WHEN u.id IS NOT NULL THEN 'registered'
            ELSE 'guest'
          END as "userType",
          COALESCE(u."createdAt", c_orders.first_order_date) as "createdAt",
          COALESCE(c_orders.order_count, 0)::int as "orderCount",
          COALESCE(c_orders.total_spent, 0)::float as "totalSpent",
          COALESCE(c_orders.average_ticket, 0)::float as "averageTicket",
          c_orders.last_order_date as "lastOrderDate",
          COALESCE(
            (SELECT MAX(al."createdAt") FROM "ActivityLog" al WHERE al."userId" = u.id OR al."guestEmail" = e.email),
            u."updatedAt",
            c_orders.last_order_date
          ) as "lastActivity"
        FROM (
          SELECT DISTINCT email FROM (
            SELECT email FROM "User"
            UNION
            SELECT email FROM "Customer"
          ) AS temp
        ) e
        LEFT JOIN "User" u ON u.email = e.email
        LEFT JOIN "Customer" c ON c.email = e.email
        LEFT JOIN (
          SELECT 
            "customerEmail" as email,
            COUNT(id) as order_count,
            SUM(total) as total_spent,
            AVG(total) as average_ticket,
            MAX("createdAt") as last_order_date,
            MIN("createdAt") as first_order_date
          FROM "Order"
          GROUP BY "customerEmail"
        ) c_orders ON c_orders.email = e.email
      )
      SELECT * FROM unified_users
      WHERE ${whereClause}
      ORDER BY "${sortBy}" ${sortOrder} NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [countResult, usersResult] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ count: number }>>(countQuery),
      this.prisma.$queryRawUnsafe<any[]>(dataQuery),
    ]);

    const total = countResult[0]?.count || 0;

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: usersResult.map(user => ({
        ...user,
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
        lastOrderDate: user.lastOrderDate ? new Date(user.lastOrderDate).toISOString() : null,
        lastActivity: user.lastActivity ? new Date(user.lastActivity).toISOString() : null,
      })),
    };
  }

  async findOne(idOrEmail: string) {
    let user = await this.prisma.user.findUnique({
      where: { id: idOrEmail },
    });

    let customer = await this.prisma.customer.findFirst({
      where: { userId: idOrEmail },
    });

    let email = user?.email || customer?.email;

    if (!user && !customer) {
      customer = await this.prisma.customer.findUnique({
        where: { id: idOrEmail },
      });
      if (customer) {
        email = customer.email;
        if (customer.userId) {
          user = await this.prisma.user.findUnique({
            where: { id: customer.userId },
          });
        }
      }
    }

    if (!user && !customer) {
      customer = await this.prisma.customer.findUnique({
        where: { email: idOrEmail.trim().toLowerCase() },
      });
      user = await this.prisma.user.findUnique({
        where: { email: idOrEmail.trim().toLowerCase() },
      });
      email = user?.email || customer?.email;
    }

    if (!email) {
      throw new NotFoundException(`Usuario o cliente "${idOrEmail}" no encontrado.`);
    }

    const [orders, activityLogs] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerEmail: email },
        include: { payment: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.activityLog.findMany({
        where: {
          OR: [
            user ? { userId: user.id } : {},
            { guestEmail: email },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const orderCount = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const averageTicket = orderCount > 0 ? totalSpent / orderCount : 0;
    const lastOrder = orders[0] || null;

    const productsMap = new Map<string, { id: string; name: string; quantity: number; size: string; unitPrice: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        if (!item.productId) continue;
        const key = `${item.productId}-${item.size}`;
        const existing = productsMap.get(key);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          productsMap.set(key, {
            id: item.productId,
            name: item.productName || 'Producto sin nombre',
            quantity: item.quantity,
            size: item.size,
            unitPrice: Number(item.unitPrice),
          });
        }
      }
    }
    const productsBought = Array.from(productsMap.values());

    const shippingAddresses = Array.from(
      new Set(orders.map((o) => o.shippingAddress).filter(Boolean))
    );

    return {
      id: user?.id || customer?.id || email,
      email,
      name: user?.name || customer?.name || null,
      phone: customer?.phone || null,
      userType: user?.role === 'admin' ? 'admin' : user ? 'registered' : 'guest',
      createdAt: user?.createdAt || (orders[orders.length - 1]?.createdAt) || null,
      lastActivity: activityLogs[0]?.createdAt || user?.updatedAt || (lastOrder?.createdAt) || null,
      provider: user?.provider || null,
      image: user?.image || null,
      metrics: {
        orderCount,
        totalSpent,
        averageTicket,
      },
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        total: Number(order.total),
        status: order.status,
        paymentStatus: order.payment?.status || 'pending',
      })),
      productsBought,
      shippingAddresses,
      activityLogs: activityLogs.map(log => ({
        id: log.id,
        eventType: log.eventType,
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
    };
  }
}
