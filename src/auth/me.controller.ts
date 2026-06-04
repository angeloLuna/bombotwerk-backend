import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getProfile(@Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      provider: user.provider,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  @Get('orders')
  async getMyOrders(@Req() req: any) {
    const orders = await this.prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        payment: true,
      },
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      status: order.status,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      shippingTotal: Number(order.shippingTotal),
      paymentStatus: order.payment?.status || 'pending',
    }));
  }

  @Get('orders/:orderNumber')
  async getMyOrderDetail(@Param('orderNumber') orderNumber: string, @Req() req: any) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Pedido ${orderNumber} no encontrado.`);
    }

    // Validation: Admin can see any order, normal customer can only see their own
    if (req.user.role !== 'admin' && order.userId !== req.user.id) {
      throw new ForbiddenException('No tienes permiso para ver esta orden.');
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      shippingMethod: order.shippingMethod,
      subtotal: Number(order.subtotal),
      shippingTotal: Number(order.shippingTotal),
      total: Number(order.total),
      currency: order.currency,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,

      // Shipping snapshot fields
      shippingLabel: order.shippingLabel,
      shippingCost: Number(order.shippingCost),
      isFreeShipping: order.isFreeShipping,
      freeShippingThreshold: Number(order.freeShippingThreshold),
      amountRemainingForFreeShipping: Number(order.amountRemainingForFreeShipping),
      hasInStockItems: order.hasInStockItems,
      hasMadeToOrderItems: order.hasMadeToOrderItems,
      isMixedFulfillmentCart: order.isMixedFulfillmentCart,
      splitShippingSelected: order.splitShippingSelected,
      splitShippingCost: Number(order.splitShippingCost),
      estimatedDeliveryMinBusinessDays: order.estimatedDeliveryMinBusinessDays,
      estimatedDeliveryMaxBusinessDays: order.estimatedDeliveryMaxBusinessDays,
      firstPackageEstimatedMinBusinessDays: order.firstPackageEstimatedMinBusinessDays,
      firstPackageEstimatedMaxBusinessDays: order.firstPackageEstimatedMaxBusinessDays,
      secondPackageEstimatedMinBusinessDays: order.secondPackageEstimatedMinBusinessDays,
      secondPackageEstimatedMaxBusinessDays: order.secondPackageEstimatedMaxBusinessDays,
      fulfillmentNotes: order.fulfillmentNotes,
      shippingNotes: order.shippingNotes,

      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        variantName: item.variantName,
        size: item.size,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        fulfillmentType: item.fulfillmentType,
        madeToOrderMinDays: item.madeToOrderMinDays,
        madeToOrderMaxDays: item.madeToOrderMaxDays,
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
