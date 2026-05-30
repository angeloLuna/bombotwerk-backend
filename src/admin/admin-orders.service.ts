import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    status?: string;
    email?: string;
    orderNumber?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const whereClause: any = {};

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.email) {
      whereClause.customerEmail = {
        contains: filters.email,
        mode: 'insensitive',
      };
    }

    if (filters.orderNumber) {
      whereClause.orderNumber = {
        contains: filters.orderNumber,
        mode: 'insensitive',
      };
    }

    if (filters.startDate || filters.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) {
        whereClause.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        whereClause.createdAt.lte = new Date(filters.endDate);
      }
    }

    const orders = await this.prisma.order.findMany({
      where: whereClause,
      include: {
        payment: true,
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      status: order.status,
      subtotal: Number(order.subtotal),
      shippingTotal: Number(order.shippingTotal),
      total: Number(order.total),
      currency: order.currency,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      payment: order.payment ? {
        id: order.payment.id,
        provider: order.payment.provider,
        providerPaymentId: order.payment.providerPaymentId,
        providerStatus: order.payment.providerStatus,
        status: order.payment.status,
        statusDetail: order.payment.statusDetail,
        amount: Number(order.payment.amount),
        currency: order.payment.currency,
        paymentMethod: order.payment.paymentMethod,
        createdAt: order.payment.createdAt,
        updatedAt: order.payment.updatedAt,
        method: order.payment.method,
        transactionId: order.payment.transactionId,
        rawResponse: order.payment.rawResponse,
      } : null,
      items: order.items.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        variantName: item.variantName,
        size: item.size,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
    }));
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        payment: true,
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found.`);
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      shippingMethod: order.shippingMethod,
      status: order.status,
      subtotal: Number(order.subtotal),
      shippingTotal: Number(order.shippingTotal),
      total: Number(order.total),
      currency: order.currency,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      payment: order.payment ? {
        id: order.payment.id,
        provider: order.payment.provider,
        providerPaymentId: order.payment.providerPaymentId,
        providerStatus: order.payment.providerStatus,
        status: order.payment.status,
        statusDetail: order.payment.statusDetail,
        amount: Number(order.payment.amount),
        currency: order.payment.currency,
        paymentMethod: order.payment.paymentMethod,
        createdAt: order.payment.createdAt,
        updatedAt: order.payment.updatedAt,
        method: order.payment.method,
        transactionId: order.payment.transactionId,
        rawResponse: order.payment.rawResponse,
      } : null,
      items: order.items.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        variantName: item.variantName,
        size: item.size,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
    };
  }
}
