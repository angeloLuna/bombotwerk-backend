import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

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
      confirmationEmailSentAt: order.confirmationEmailSentAt,
      confirmationEmailStatus: order.confirmationEmailStatus,
      confirmationEmailError: order.confirmationEmailError,
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
        fulfillmentType: item.fulfillmentType,
        madeToOrderMinDays: item.madeToOrderMinDays,
        madeToOrderMaxDays: item.madeToOrderMaxDays,
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
      confirmationEmailSentAt: order.confirmationEmailSentAt,
      confirmationEmailStatus: order.confirmationEmailStatus,
      confirmationEmailError: order.confirmationEmailError,

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
        fulfillmentType: item.fulfillmentType,
        madeToOrderMinDays: item.madeToOrderMinDays,
        madeToOrderMaxDays: item.madeToOrderMaxDays,
      })),
    };
  }

  async resendEmail(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found.`);
    }

    // Trigger confirmation email forcing resend
    await this.emailService.sendConfirmationEmail(order.id, true);

    const updated = await this.prisma.order.findUnique({
      where: { id },
    });
    if (!updated) {
      throw new NotFoundException(`Order with ID "${id}" was deleted during resend.`);
    }

    return {
      success: updated.confirmationEmailStatus === 'sent',
      confirmationEmailStatus: updated.confirmationEmailStatus,
      confirmationEmailSentAt: updated.confirmationEmailSentAt,
      confirmationEmailError: updated.confirmationEmailError,
    };
  }
}
