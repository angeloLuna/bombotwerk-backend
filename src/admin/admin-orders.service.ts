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
    fulfillmentStatus?: string;
    fulfillmentPreset?: string;
    email?: string;
    orderNumber?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const whereClause: any = {};

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.fulfillmentStatus) {
      whereClause.fulfillmentStatus = filters.fulfillmentStatus;
    }

    if (filters.fulfillmentPreset) {
      if (filters.fulfillmentPreset === 'pending_prepare') {
        whereClause.status = 'paid';
        whereClause.fulfillmentStatus = { in: ['pending_review', 'paid', 'preparing', 'in_production', 'ready_to_ship'] };
      } else if (filters.fulfillmentPreset === 'in_production') {
        whereClause.fulfillmentStatus = 'in_production';
      } else if (filters.fulfillmentPreset === 'ready_to_ship') {
        whereClause.fulfillmentStatus = 'ready_to_ship';
      } else if (filters.fulfillmentPreset === 'shipped') {
        whereClause.fulfillmentStatus = 'shipped';
      } else if (filters.fulfillmentPreset === 'cancelled') {
        whereClause.fulfillmentStatus = 'cancelled';
      }
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
      fulfillmentStatus: order.fulfillmentStatus,
      subtotal: Number(order.subtotal),
      shippingTotal: Number(order.shippingTotal),
      total: Number(order.total),
      currency: order.currency,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      confirmationEmailSentAt: order.confirmationEmailSentAt,
      confirmationEmailStatus: order.confirmationEmailStatus,
      confirmationEmailError: order.confirmationEmailError,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
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
        notes: {
          include: {
            adminUser: {
              select: {
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
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
      fulfillmentStatus: order.fulfillmentStatus,
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
      
      // Shipping tracking fields
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,

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
      notes: order.notes.map(note => ({
        id: note.id,
        content: note.content,
        createdAt: note.createdAt,
        adminUser: note.adminUser ? {
          name: note.adminUser.name,
          email: note.adminUser.email,
          image: note.adminUser.image,
        } : null,
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

  async updateStatus(id: string, status: string, adminUserId: string) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Order with ID "${id}" not found.`);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_updated_order_status',
        entityType: 'Order',
        entityId: id,
        before: { status: existing.status },
        after: { status: updated.status },
      },
    });

    return {
      id: updated.id,
      orderNumber: updated.orderNumber,
      status: updated.status,
      updatedAt: updated.updatedAt,
    };
  }

  async updateFulfillmentStatus(id: string, fulfillmentStatus: string, adminUserId: string) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Order with ID "${id}" not found.`);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { fulfillmentStatus },
    });

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_updated_order_fulfillment_status',
        entityType: 'Order',
        entityId: id,
        before: { fulfillmentStatus: existing.fulfillmentStatus },
        after: { fulfillmentStatus: updated.fulfillmentStatus },
      },
    });

    return {
      id: updated.id,
      fulfillmentStatus: updated.fulfillmentStatus,
      updatedAt: updated.updatedAt,
    };
  }

  async updateShipping(id: string, dto: any, adminUserId: string) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Order with ID "${id}" not found.`);
    }

    const shippedAt = dto.shippedAt ? new Date(dto.shippedAt) : new Date();
    const deliveredAt = dto.deliveredAt ? new Date(dto.deliveredAt) : null;
    const fulfillmentStatus = 'shipped';

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        carrier: dto.carrier,
        trackingNumber: dto.trackingNumber,
        trackingUrl: dto.trackingUrl || null,
        shippedAt,
        deliveredAt,
        fulfillmentStatus,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_updated_order_shipping',
        entityType: 'Order',
        entityId: id,
        before: {
          carrier: existing.carrier,
          trackingNumber: existing.trackingNumber,
          trackingUrl: existing.trackingUrl,
          shippedAt: existing.shippedAt,
          deliveredAt: existing.deliveredAt,
          fulfillmentStatus: existing.fulfillmentStatus,
        },
        after: {
          carrier: updated.carrier,
          trackingNumber: updated.trackingNumber,
          trackingUrl: updated.trackingUrl,
          shippedAt: updated.shippedAt,
          deliveredAt: updated.deliveredAt,
          fulfillmentStatus: updated.fulfillmentStatus,
        },
      },
    });

    return {
      id: updated.id,
      carrier: updated.carrier,
      trackingNumber: updated.trackingNumber,
      trackingUrl: updated.trackingUrl,
      shippedAt: updated.shippedAt,
      deliveredAt: updated.deliveredAt,
      fulfillmentStatus: updated.fulfillmentStatus,
      updatedAt: updated.updatedAt,
    };
  }

  async addNote(id: string, content: string, adminUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found.`);
    }

    const note = await this.prisma.orderNote.create({
      data: {
        orderId: id,
        adminUserId,
        content,
      },
      include: {
        adminUser: {
          select: {
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_updated_order_internal_notes',
        entityType: 'Order',
        entityId: id,
        metadata: {
          noteId: note.id,
          contentPreview: content.substring(0, 100),
        },
      },
    });

    return {
      id: note.id,
      orderId: note.orderId,
      content: note.content,
      createdAt: note.createdAt,
      adminUser: note.adminUser ? {
        name: note.adminUser.name,
        email: note.adminUser.email,
        image: note.adminUser.image,
      } : null,
    };
  }
}
