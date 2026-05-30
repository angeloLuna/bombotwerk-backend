import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutPaymentDto } from './dto/checkout-payment.dto';
import { MercadoPagoConfig, Payment } from 'mercadopago';

@Injectable()
export class CheckoutService {
  private paymentClient: Payment;

  constructor(private prisma: PrismaService) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.warn('WARNING: MERCADOPAGO_ACCESS_TOKEN is not defined in the environment variables.');
    }
    const client = new MercadoPagoConfig({
      accessToken: accessToken || '',
    });
    this.paymentClient = new Payment(client);
  }

  async processPayment(dto: CheckoutPaymentDto) {
    const { formData, cartItems, shippingDetails, email, orderId } = dto;

    // 1. Calculate & validate total amount on backend
    let computedTotal = 0;
    const itemsData = [];

    for (const item of cartItems) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product with ID "${item.productId}" not found.`);
      }

      // Verify the variant exists
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: item.variantId, productId: item.productId },
      });
      if (!variant) {
        throw new NotFoundException(`Variant with ID "${item.variantId}" not found for product "${product.name}".`);
      }

      // Add to running totals
      const itemPrice = Number(product.price);
      computedTotal += itemPrice * item.quantity;

      itemsData.push({
        productId: item.productId,
        variantId: item.variantId,
        size: item.size,
        quantity: item.quantity,
        price: product.price,
      });
    }

    const shippingCost = shippingDetails.method === 'express' ? 250 : 0;
    computedTotal += shippingCost;

    // Strict validation of transaction amount
    const clientAmount = Number(formData.transaction_amount);
    if (Math.abs(computedTotal - clientAmount) > 0.01) {
      throw new BadRequestException(
        `Transaction amount mismatch. Local calculation: ${computedTotal}, Client sent: ${clientAmount}`
      );
    }

    // 2. Find or create customer
    let customer = await this.prisma.customer.findUnique({
      where: { email },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          email,
          name: shippingDetails.name,
        },
      });
    }

    // 3. Find or create order
    let order;
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
    } else {
      const orderNumber = `BOMBO-${Date.now()}`;
      order = await this.prisma.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          shippingAddress: `${shippingDetails.address}, ${shippingDetails.city}, C.P. ${shippingDetails.zip}`,
          shippingMethod: shippingDetails.method,
          shippingCost,
          totalAmount: computedTotal,
          status: 'pending',
          items: {
            create: itemsData,
          },
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
          first_name: shippingDetails.name,
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
      } else if (mpStatus === 'in_process') {
        localPaymentStatus = 'in_process';
      }

      // 5. Update local Payment in DB
      await this.prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
          method: formData.payment_method_id,
          amount: computedTotal,
          status: localPaymentStatus,
          statusDetail: mpStatusDetail,
          providerPaymentId: mpId,
          transactionId: mpId,
        },
        create: {
          orderId: order.id,
          method: formData.payment_method_id,
          amount: computedTotal,
          status: localPaymentStatus,
          statusDetail: mpStatusDetail,
          provider: 'mercadopago',
          providerPaymentId: mpId,
          transactionId: mpId,
        },
      });

      // 6. Update local Order status
      let localOrderStatus = 'pending';
      if (localPaymentStatus === 'approved') {
        localOrderStatus = 'paid';
      } else if (localPaymentStatus === 'rejected') {
        localOrderStatus = 'rejected';
      } else if (localPaymentStatus === 'cancelled') {
        localOrderStatus = 'cancelled';
      }

      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: { status: localOrderStatus },
      });

      return {
        success: localPaymentStatus === 'approved',
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentStatus: localPaymentStatus,
        paymentStatusDetail: mpStatusDetail,
        providerPaymentId: mpId,
      };

    } catch (error) {
      console.error(`[MercadoPago] Exception during payment processing for Order ${order.id}:`, error);

      // Create/Update the payment record as rejected
      await this.prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
          status: 'rejected',
          statusDetail: error.message || 'API_ERROR',
        },
        create: {
          orderId: order.id,
          method: formData.payment_method_id || 'unknown',
          amount: computedTotal,
          status: 'rejected',
          statusDetail: error.message || 'API_ERROR',
          provider: 'mercadopago',
        },
      });

      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'rejected' },
      });

      throw new BadRequestException(error.message || 'Payment processing failed');
    }
  }

  async handleWebhook(body: any) {
    console.log('[MercadoPago Webhook] Received event payload:', JSON.stringify(body));

    // Webhook notifications structure:
    // { action: 'payment.updated', type: 'payment', data: { id: '...' } }
    if (body.type !== 'payment' || !body.data?.id) {
      console.log('[MercadoPago Webhook] Event is not of type "payment", ignoring.');
      return { received: true };
    }

    const paymentId = body.data.id;
    console.log(`[MercadoPago Webhook] Processing payment ID: ${paymentId}`);

    try {
      // Query Mercado Pago directly to get the source of truth
      const paymentResponse = await this.paymentClient.get({ id: paymentId });
      const mpStatus = paymentResponse.status;
      const mpStatusDetail = paymentResponse.status_detail;
      const orderId = paymentResponse.external_reference;

      if (!orderId) {
        console.warn(`[MercadoPago Webhook] Payment ${paymentId} has no external_reference (orderId), skipping update.`);
        return { received: true };
      }

      // Check if order exists in local DB
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
      } else if (mpStatus === 'in_process') {
        localPaymentStatus = 'in_process';
      } else if (mpStatus === 'refunded') {
        localPaymentStatus = 'refunded';
      }

      // Update local Payment record
      await this.prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
          status: localPaymentStatus,
          statusDetail: mpStatusDetail,
          providerPaymentId: paymentId.toString(),
          transactionId: paymentId.toString(),
        },
        create: {
          orderId: order.id,
          method: paymentResponse.payment_method_id || 'unknown',
          amount: Number(paymentResponse.transaction_amount || 0),
          status: localPaymentStatus,
          statusDetail: mpStatusDetail,
          provider: 'mercadopago',
          providerPaymentId: paymentId.toString(),
          transactionId: paymentId.toString(),
        },
      });

      // Update local Order record status
      let localOrderStatus = order.status;
      if (localPaymentStatus === 'approved') {
        localOrderStatus = 'paid';
      } else if (localPaymentStatus === 'rejected') {
        localOrderStatus = 'rejected';
      } else if (localPaymentStatus === 'cancelled') {
        localOrderStatus = 'cancelled';
      }

      if (order.status !== localOrderStatus) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: localOrderStatus },
        });
        console.log(`[MercadoPago Webhook] Order ${order.orderNumber} status updated to: ${localOrderStatus}`);
      } else {
        console.log(`[MercadoPago Webhook] Order ${order.orderNumber} status already matches: ${localOrderStatus}`);
      }

      return { success: true };
    } catch (error) {
      console.error(`[MercadoPago Webhook] Error processing payment verification for ID ${paymentId}:`, error);
      throw error; // Re-throw to signal retry if needed, though MP expects 200/201.
    }
  }
}
