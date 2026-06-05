import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutPaymentDto } from './dto/checkout-payment.dto';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import * as fs from 'fs';
import * as path from 'path';
import { CheckoutPricingService } from './checkout-pricing.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class CheckoutService {
  private paymentClient: Payment;

  constructor(
    private prisma: PrismaService,
    private pricingService: CheckoutPricingService,
    private emailService: EmailService
  ) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.warn('WARNING: MERCADOPAGO_ACCESS_TOKEN is not defined in the environment variables.');
    }
    const client = new MercadoPagoConfig({
      accessToken: accessToken || '',
    });
    this.paymentClient = new Payment(client);
  }

  async processPayment(dto: CheckoutPaymentDto, user?: any) {
    const { formData, cartItems, shippingDetails, email, phone, orderId } = dto;

    const bypass = shippingDetails.bypassShipping && user?.role === 'admin';

    // 1. Calculate & validate total amount on backend using CheckoutPricingService
    const calculation = await this.pricingService.calculateShipping(
      cartItems,
      !!shippingDetails.splitShippingSelected,
      !!bypass
    );

    const computedTotal = calculation.total;

    // Strict validation of transaction amount
    const clientAmount = Number(formData.transaction_amount);
    if (Math.abs(computedTotal - clientAmount) > 0.01) {
      throw new BadRequestException(
        `Transaction amount mismatch. Local calculation: ${computedTotal}, Client sent: ${clientAmount}`
      );
    }

    // 2. Find or create customer (optional historical tracking)
    let verifiedUserId: string | null = null;
    if (user?.id) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
      });
      if (dbUser) {
        verifiedUserId = dbUser.id;
      } else {
        const userEmail = user.email || email;
        if (userEmail) {
          const dbUserByEmail = await this.prisma.user.findUnique({
            where: { email: userEmail.trim().toLowerCase() },
          });
          if (dbUserByEmail) {
            verifiedUserId = dbUserByEmail.id;
          }
        }
      }
    }

    let customer = await this.prisma.customer.findUnique({
      where: { email },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          email,
          name: shippingDetails.name,
          phone,
          userId: verifiedUserId,
        },
      });
    } else {
      const updateData: any = {};
      if (phone && !customer.phone) updateData.phone = phone;
      if (verifiedUserId && !customer.userId) updateData.userId = verifiedUserId;

      if (Object.keys(updateData).length > 0) {
        await this.prisma.customer.update({
          where: { id: customer.id },
          data: updateData,
        });
      }
    }

    // 3. Find or create order
    let order;
    const shippingAddressStr = `${shippingDetails.address}, ${shippingDetails.city}, C.P. ${shippingDetails.zip}`;
    if (orderId) {
      order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID "${orderId}" not found.`);
      }
      if (order.status !== 'pending') {
        throw new BadRequestException(`Order with ID "${orderId}" is already in "${order.status}" status.`);
      }

      // Update the existing order with the recalculated totals and shipping snapshot fields
      order = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          customerName: shippingDetails.name,
          customerEmail: email,
          customerPhone: phone,
          userId: verifiedUserId,
          guestEmail: verifiedUserId ? null : email,
          shippingAddress: shippingAddressStr,
          shippingMethod: calculation.shippingMethod,
          subtotal: calculation.subtotal,
          shippingTotal: calculation.shippingCost,
          total: calculation.total,
          
          // Shipping snapshot fields
          shippingLabel: calculation.shippingLabel,
          shippingCost: calculation.shippingCost,
          isFreeShipping: calculation.isFreeShipping,
          freeShippingThreshold: calculation.freeShippingThreshold,
          amountRemainingForFreeShipping: calculation.amountRemainingForFreeShipping,
          hasInStockItems: calculation.hasInStockItems,
          hasMadeToOrderItems: calculation.hasMadeToOrderItems,
          isMixedFulfillmentCart: calculation.isMixedFulfillmentCart,
          splitShippingSelected: calculation.splitShippingSelected,
          splitShippingCost: calculation.splitShippingCost,
          estimatedDeliveryMinBusinessDays: calculation.estimatedDeliveryMinBusinessDays,
          estimatedDeliveryMaxBusinessDays: calculation.estimatedDeliveryMaxBusinessDays,
          firstPackageEstimatedMinBusinessDays: calculation.firstPackageEstimatedMinBusinessDays,
          firstPackageEstimatedMaxBusinessDays: calculation.firstPackageEstimatedMaxBusinessDays,
          secondPackageEstimatedMinBusinessDays: calculation.secondPackageEstimatedMinBusinessDays,
          secondPackageEstimatedMaxBusinessDays: calculation.secondPackageEstimatedMaxBusinessDays,
          fulfillmentNotes: calculation.fulfillmentNotes,
          shippingNotes: calculation.shippingNotes,
        },
      });
    } else {
      const count = await this.prisma.order.count();
      const nextNum = String(count + 1).padStart(6, '0');
      const orderNumber = `BT-${new Date().getFullYear()}-${nextNum}`;

      order = await this.prisma.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          userId: verifiedUserId,
          guestEmail: verifiedUserId ? null : email,
          customerName: shippingDetails.name,
          customerEmail: email,
          customerPhone: phone,
          shippingAddress: shippingAddressStr,
          shippingMethod: calculation.shippingMethod,
          subtotal: calculation.subtotal,
          shippingTotal: calculation.shippingCost,
          total: calculation.total,
          currency: 'MXN',
          status: 'pending',
          items: {
            create: calculation.items,
          },

          // Shipping snapshot fields
          shippingLabel: calculation.shippingLabel,
          shippingCost: calculation.shippingCost,
          isFreeShipping: calculation.isFreeShipping,
          freeShippingThreshold: calculation.freeShippingThreshold,
          amountRemainingForFreeShipping: calculation.amountRemainingForFreeShipping,
          hasInStockItems: calculation.hasInStockItems,
          hasMadeToOrderItems: calculation.hasMadeToOrderItems,
          isMixedFulfillmentCart: calculation.isMixedFulfillmentCart,
          splitShippingSelected: calculation.splitShippingSelected,
          splitShippingCost: calculation.splitShippingCost,
          estimatedDeliveryMinBusinessDays: calculation.estimatedDeliveryMinBusinessDays,
          estimatedDeliveryMaxBusinessDays: calculation.estimatedDeliveryMaxBusinessDays,
          firstPackageEstimatedMinBusinessDays: calculation.firstPackageEstimatedMinBusinessDays,
          firstPackageEstimatedMaxBusinessDays: calculation.firstPackageEstimatedMaxBusinessDays,
          secondPackageEstimatedMinBusinessDays: calculation.secondPackageEstimatedMinBusinessDays,
          secondPackageEstimatedMaxBusinessDays: calculation.secondPackageEstimatedMaxBusinessDays,
          fulfillmentNotes: calculation.fulfillmentNotes,
          shippingNotes: calculation.shippingNotes,
        },
      });
    }

    // 4. Send request to Mercado Pago
    try {
      const body: any = {
        transaction_amount: computedTotal,
        token: formData.token,
        description: `BOMBO TWERK - Order ${order.orderNumber}`,
        installments: formData.installments ? Number(formData.installments) : undefined,
        payment_method_id: formData.payment_method_id,
        issuer_id: formData.issuer_id ? Number(formData.issuer_id) : undefined,
        payer: {
          email: email,
        },
        external_reference: order.id,
        metadata: {
          order_id: order.id,
        },
      };

      if (formData.payer?.identification) {
        body.payer.identification = formData.payer.identification;
      }

      console.log(`[MercadoPago] Creating payment for Order ${order.orderNumber}...`);
      console.log(`[MercadoPago] Request Body:`, JSON.stringify(body, null, 2));
      console.log(`[MercadoPago] Frontend formData:`, JSON.stringify(formData, null, 2));
      
      const logFilePath = path.join(process.cwd(), 'payment-debug.log');
      const logData = {
        timestamp: new Date().toISOString(),
        orderNumber: order.orderNumber,
        accessTokenPrefix: process.env.MERCADOPAGO_ACCESS_TOKEN 
          ? process.env.MERCADOPAGO_ACCESS_TOKEN.substring(0, 25) + '...' 
          : 'UNDEFINED',
        body,
        formData,
      };
      fs.appendFileSync(logFilePath, `REQUEST:\n${JSON.stringify(logData, null, 2)}\n---\n`);

      const paymentResponse = await this.paymentClient.create({ body });
      const mpStatus = paymentResponse.status;
      const mpStatusDetail = paymentResponse.status_detail;
      const mpId = paymentResponse.id?.toString();

      console.log(`[MercadoPago] Payment result for Order ${order.orderNumber}: ID=${mpId}, Status=${mpStatus}, Detail=${mpStatusDetail}`);

      // Map Mercado Pago status to local status
      let localPaymentStatus = 'pending';
      if (mpStatus === 'approved') {
        localPaymentStatus = 'approved';
      } else if (mpStatus === 'rejected') {
        localPaymentStatus = 'rejected';
      } else if (mpStatus === 'cancelled') {
        localPaymentStatus = 'cancelled';
      } else if (mpStatus === 'in_process' || mpStatus === 'pending') {
        localPaymentStatus = 'in_process';
      }

      // Map payment status to order status
      let localOrderStatus = 'pending';
      if (localPaymentStatus === 'approved') {
        localOrderStatus = 'paid';
      } else if (localPaymentStatus === 'rejected') {
        localOrderStatus = 'failed';
      } else if (localPaymentStatus === 'cancelled') {
        localOrderStatus = 'cancelled';
      }

      // 5. Update local Payment in DB
      await this.prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
          amount: computedTotal,
          status: localPaymentStatus,
          providerStatus: mpStatus,
          statusDetail: mpStatusDetail,
          providerPaymentId: mpId,
          transactionId: mpId,
          method: formData.payment_method_id,
          paymentMethod: formData.payment_method_id,
          currency: 'MXN',
          rawResponse: JSON.parse(JSON.stringify(paymentResponse)),
        },
        create: {
          orderId: order.id,
          amount: computedTotal,
          status: localPaymentStatus,
          providerStatus: mpStatus,
          statusDetail: mpStatusDetail,
          provider: 'mercadopago',
          providerPaymentId: mpId,
          transactionId: mpId,
          method: formData.payment_method_id,
          paymentMethod: formData.payment_method_id,
          currency: 'MXN',
          rawResponse: JSON.parse(JSON.stringify(paymentResponse)),
        },
      });

      // 6. Update local Order status
      const affected = await this.prisma.order.updateMany({
        where: { id: order.id, status: { not: 'paid' } },
        data: { status: localOrderStatus },
      });

      if (affected.count > 0 && localOrderStatus === 'paid') {
        await this.decrementStockForOrder(order.id);
        this.emailService.sendConfirmationEmail(order.id).catch((err) => {
          console.error('[Email Send Error in processPayment]', err);
        });
      }

      const successLogData = {
        timestamp: new Date().toISOString(),
        orderNumber: order.orderNumber,
        status: localPaymentStatus,
        statusDetail: mpStatusDetail,
        paymentId: mpId,
      };
      fs.appendFileSync(logFilePath, `SUCCESS:\n${JSON.stringify(successLogData, null, 2)}\n---\n`);

      return {
        success: localPaymentStatus === 'approved',
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentStatus: localPaymentStatus,
        paymentStatusDetail: mpStatusDetail,
        providerPaymentId: mpId,
      };

    } catch (error: any) {
      console.error(`[MercadoPago] Exception during payment processing for Order ${order.id}:`, error);
      
      const detailedErrorObj = {
        message: error.message,
        name: error.name,
        status: error.status,
        statusCode: error.statusCode,
        cause: error.cause,
        apiResponse: error.apiResponse ? {
          status: error.apiResponse.status,
          statusText: error.apiResponse.statusText,
          body: error.apiResponse.body,
        } : undefined,
      };
      
      const detailedError = JSON.stringify(detailedErrorObj, null, 2);
      console.error(`[MercadoPago] Full Error Details:`, detailedError);

      const logFilePath = path.join(process.cwd(), 'payment-debug.log');
      fs.appendFileSync(logFilePath, `ERROR:\n${detailedError}\n---\n`);
      
      const errorMessage = `MercadoPago Error: ${error.message || 'Unknown error'}`;

      // Create/Update the payment record as rejected
      await this.prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
          status: 'rejected',
          statusDetail: errorMessage.substring(0, 1000),
        },
        create: {
          orderId: order.id,
          amount: computedTotal,
          status: 'rejected',
          statusDetail: errorMessage.substring(0, 1000),
          provider: 'mercadopago',
          method: formData.payment_method_id || 'unknown',
          paymentMethod: formData.payment_method_id || 'unknown',
        },
      });

      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'failed' },
      });

      throw new BadRequestException(errorMessage);
    }
  }

  async handleWebhook(body: any) {
    console.log('[MercadoPago Webhook] Received event payload:', JSON.stringify(body));

    if (body.type !== 'payment' || !body.data?.id) {
      console.log('[MercadoPago Webhook] Event is not of type "payment", ignoring.');
      return { received: true };
    }

    const paymentId = body.data.id;
    console.log(`[MercadoPago Webhook] Processing payment ID: ${paymentId}`);

    try {
      const paymentResponse = await this.paymentClient.get({ id: paymentId });
      const mpStatus = paymentResponse.status;
      const mpStatusDetail = paymentResponse.status_detail;
      const orderId = paymentResponse.external_reference;

      if (!orderId) {
        console.warn(`[MercadoPago Webhook] Payment ${paymentId} has no external_reference (orderId), skipping update.`);
        return { received: true };
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        console.warn(`[MercadoPago Webhook] Order with ID "${orderId}" not found in database.`);
        return { received: true };
      }

      console.log(`[MercadoPago Webhook] Found local order ${order.orderNumber}. MP Status: ${mpStatus}`);

      // Map status
      let localPaymentStatus = 'pending';
      if (mpStatus === 'approved') {
        localPaymentStatus = 'approved';
      } else if (mpStatus === 'rejected') {
        localPaymentStatus = 'rejected';
      } else if (mpStatus === 'cancelled') {
        localPaymentStatus = 'cancelled';
      } else if (mpStatus === 'in_process' || mpStatus === 'pending') {
        localPaymentStatus = 'in_process';
      } else if (mpStatus === 'refunded') {
        localPaymentStatus = 'refunded';
      }

      // Map payment status to order status
      let localOrderStatus = order.status;
      if (localPaymentStatus === 'approved') {
        localOrderStatus = 'paid';
      } else if (localPaymentStatus === 'rejected') {
        localOrderStatus = 'failed';
      } else if (localPaymentStatus === 'cancelled') {
        localOrderStatus = 'cancelled';
      }

      // Update local Payment record
      await this.prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
          status: localPaymentStatus,
          providerStatus: mpStatus,
          statusDetail: mpStatusDetail,
          providerPaymentId: paymentId.toString(),
          transactionId: paymentId.toString(),
          rawResponse: JSON.parse(JSON.stringify(paymentResponse)),
          paymentMethod: paymentResponse.payment_method_id,
          amount: Number(paymentResponse.transaction_amount || 0),
          currency: paymentResponse.currency_id || 'MXN',
        },
        create: {
          orderId: order.id,
          provider: 'mercadopago',
          status: localPaymentStatus,
          providerStatus: mpStatus,
          statusDetail: mpStatusDetail,
          providerPaymentId: paymentId.toString(),
          transactionId: paymentId.toString(),
          rawResponse: JSON.parse(JSON.stringify(paymentResponse)),
          method: paymentResponse.payment_method_id || 'unknown',
          paymentMethod: paymentResponse.payment_method_id || 'unknown',
          amount: Number(paymentResponse.transaction_amount || 0),
          currency: paymentResponse.currency_id || 'MXN',
        },
      });

      if (order.status !== localOrderStatus) {
        const affected = await this.prisma.order.updateMany({
          where: { id: order.id, status: { not: 'paid' } },
          data: { status: localOrderStatus },
        });

        if (affected.count > 0 && localOrderStatus === 'paid') {
          await this.decrementStockForOrder(order.id);
          this.emailService.sendConfirmationEmail(order.id).catch((err) => {
            console.error('[Email Send Error in handleWebhook]', err);
          });
        }
        console.log(`[MercadoPago Webhook] Order ${order.orderNumber} status updated to: ${localOrderStatus}`);
      } else {
        console.log(`[MercadoPago Webhook] Order ${order.orderNumber} status already matches: ${localOrderStatus}`);
      }

      return { success: true };
    } catch (error) {
      console.error(`[MercadoPago Webhook] Error processing payment verification for ID ${paymentId}:`, error);
      throw error;
    }
  }

  private async decrementStockForOrder(orderId: string) {
    console.log(`[Stock Decrement] Processing stock decrement for Order ${orderId}...`);
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
        },
      });

      if (!order) {
        console.error(`[Stock Decrement] Order ${orderId} not found`);
        return;
      }

      for (const item of order.items) {
        if (!item.variantId) continue;

        const variant = await this.prisma.productVariant.findUnique({
          where: { id: item.variantId },
          include: {
            stocks: true,
          },
        });

        if (!variant) {
          console.warn(`[Stock Decrement] Variant ${item.variantId} not found for item ${item.id}`);
          continue;
        }

        if (item.fulfillmentType === 'stock') {
          const sizeStock = variant.stocks.find((s) => s.size.toUpperCase() === item.size.toUpperCase());
          if (sizeStock) {
            const newQty = Math.max(0, sizeStock.quantity - item.quantity);
            await this.prisma.sizeStock.update({
              where: { id: sizeStock.id },
              data: { quantity: newQty },
            });
            console.log(
              `[Stock Decrement] Reduced stock for variant ${variant.sku} size ${item.size} from ${sizeStock.quantity} to ${newQty} (sold ${item.quantity})`
            );
          } else {
            console.warn(
              `[Stock Decrement] SizeStock not found for variant ${variant.sku} size ${item.size}`
            );
          }
        } else {
          console.log(
            `[Stock Decrement] Skipping variant ${variant.sku} with fulfillmentType: ${item.fulfillmentType}`
          );
        }
      }
    } catch (err) {
      console.error(`[Stock Decrement] Failed to decrement stock for Order ${orderId}:`, err);
    }
  }
}



