import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found.`);
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      subtotal: Number(order.subtotal),
      shippingTotal: Number(order.shippingTotal),
      total: Number(order.total),
      currency: order.currency,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        variantName: item.variantName,
        size: item.size,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),

      payment: order.payment
        ? {
            id: order.payment.id,
            provider: order.payment.provider,
            providerPaymentId: order.payment.providerPaymentId,
            providerStatus: order.payment.providerStatus,
            status: order.payment.status,
            amount: Number(order.payment.amount),
            currency: order.payment.currency,
            paymentMethod: order.payment.paymentMethod,
            createdAt: order.payment.createdAt,
          }
        : null,
    };
  }
}
