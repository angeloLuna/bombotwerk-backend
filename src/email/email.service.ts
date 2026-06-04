import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private prisma: PrismaService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASSWORD;
    const from = process.env.EMAIL_FROM;

    this.logger.log(
      `Attempting to initialize SMTP Transporter with values: Host=${host || 'undefined'}, Port=${port}, User=${user || 'undefined'}, From=${from || 'undefined'}`
    );

    if (!host || !user || !pass) {
      this.logger.warn(
        'Email SMTP configuration is incomplete. EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD are required in the environment variables. Email sending will be bypassed.'
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports (like 587)
        auth: {
          user,
          pass,
        },
      });
      this.logger.log(`SMTP Email Transporter successfully initialized. Host: ${host}:${port}`);
    } catch (error) {
      this.logger.error('Failed to initialize SMTP Transporter:', error);
    }
  }

  /**
   * Sends the purchase confirmation email to the customer.
   * Uses an atomic db status claim ('sending') to prevent duplicates.
   */
  async sendConfirmationEmail(orderId: string, force = false): Promise<void> {
    this.logger.log(`[sendConfirmationEmail] Triggered for orderId: ${orderId} (force: ${force})`);

    // Fetch the order first to log diagnostic info
    const checkOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!checkOrder) {
      this.logger.error(`[sendConfirmationEmail] Skipping send: Order ${orderId} not found.`);
      return;
    }

    if (checkOrder.status !== 'paid') {
      this.logger.log(
        `[sendConfirmationEmail] Skipping send for Order ${checkOrder.orderNumber}: status is "${checkOrder.status}" (must be "paid").`
      );
      return;
    }

    if (checkOrder.confirmationEmailSentAt) {
      this.logger.log(
        `[sendConfirmationEmail] Skipping send for Order ${checkOrder.orderNumber}: confirmation email was already sent at ${checkOrder.confirmationEmailSentAt}.`
      );
      return;
    }

    if (checkOrder.confirmationEmailStatus === 'sending' || checkOrder.confirmationEmailStatus === 'sent') {
      if (!force) {
        this.logger.log(
          `[sendConfirmationEmail] Skipping send for Order ${checkOrder.orderNumber}: confirmation email status is "${checkOrder.confirmationEmailStatus}".`
        );
        return;
      }
    }

    // 1. Claim the task atomically (unless forced, which is for manual admin resending)
    if (!force) {
      const affected = await this.prisma.order.updateMany({
        where: {
          id: orderId,
          status: 'paid', // Must be paid/approved
          confirmationEmailSentAt: null,
          OR: [
            { confirmationEmailStatus: null },
            {
              NOT: {
                confirmationEmailStatus: { in: ['sending', 'sent'] },
              },
            },
          ],
        },
        data: {
          confirmationEmailStatus: 'sending',
        },
      });

      if (affected.count === 0) {
        this.logger.log(
          `[sendConfirmationEmail] Skipping send for Order ${checkOrder.orderNumber}: concurrency lock check failed (another process claimed it).`
        );
        return;
      }
      this.logger.log(`[sendConfirmationEmail] Atomic claim succeeded for Order ${checkOrder.orderNumber}. Status updated to 'sending'.`);
    } else {
      // Claim status for manual resend
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          confirmationEmailStatus: 'sending',
        },
      });
      this.logger.log(`[sendConfirmationEmail] Manual resend status claimed for Order ${checkOrder.orderNumber}.`);
    }

    // 2. Fetch the order with relations
    let order;
    try {
      order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          payment: true,
          items: true,
        },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found during fetch`);
      }

      if (!order.customerEmail) {
        throw new Error(`Order ${order.orderNumber} has no customerEmail registered.`);
      }
    } catch (fetchError: any) {
      this.logger.error(`[sendConfirmationEmail] Failed to fetch order details: ${fetchError.message}`);
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          confirmationEmailStatus: 'failed',
          confirmationEmailError: fetchError.message || String(fetchError),
        },
      });
      return;
    }

    // 3. Send email via Transporter
    try {
      if (!this.transporter) {
        this.logger.log('[sendConfirmationEmail] Transporter is null, attempting re-initialization...');
        this.initializeTransporter();
        if (!this.transporter) {
          throw new Error('SMTP transporter is not configured. Please define EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD.');
        }
      }

      const emailFrom = process.env.EMAIL_FROM || `"Bombo Twerk" <${process.env.EMAIL_USER}>`;
      const emailTo = order.customerEmail;
      const subject = `Confirmación de compra Bombo Twerk — ${order.orderNumber}`;

      // Log detailed payload info for audit/debugging
      this.logger.log(`[sendConfirmationEmail] Prepared SMTP Mail Payload:
        From: ${emailFrom}
        To: ${emailTo}
        Subject: ${subject}
        Order Number: ${order.orderNumber}
        Customer Name: ${order.customerName}
        Customer Phone: ${order.customerPhone}
        Shipping Address: ${order.shippingAddress}
        Subtotal: ${order.subtotal}
        Shipping Total: ${order.shippingTotal}
        Total Paid: ${order.total} MXN
        Payment Method: ${order.payment?.paymentMethod || 'N/A'}
        Transaction ID: ${order.payment?.providerPaymentId || 'N/A'}
        Number of items: ${order.items?.length || 0}
        Items: ${JSON.stringify(order.items.map((it: any) => ({ name: it.productName, size: it.size, qty: it.quantity, total: it.total })))}
      `);

      const htmlContent = this.generateReceiptHtml(order);

      this.logger.log(`[sendConfirmationEmail] Calling transporter.sendMail to send to: ${emailTo}...`);
      const info = await this.transporter.sendMail({
        from: emailFrom,
        to: emailTo,
        subject,
        html: htmlContent,
      });

      this.logger.log(`[sendConfirmationEmail] Mail successfully sent. Response: ${JSON.stringify(info)}`);

      // 4. Update order to 'sent' on success
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          confirmationEmailStatus: 'sent',
          confirmationEmailSentAt: new Date(),
          confirmationEmailError: null,
        },
      });
    } catch (sendError: any) {
      this.logger.error(
        `[sendConfirmationEmail] Failed sending confirmation email for Order ${order.orderNumber}: ${sendError.message}`,
        sendError.stack
      );

      // 5. Update order to 'failed' on failure without breaking the flow
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          confirmationEmailStatus: 'failed',
          confirmationEmailError: sendError.message || String(sendError),
        },
      });
    }
  }

  /**
   * Generates a fully inline-styled HTML email that mirrors EmailReceiptPreview.tsx
   */
  private generateReceiptHtml(order: any): string {
    const formattedDate = new Date(order.createdAt).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Mexico_City',
    });

    // Formatting helper
    const formatCurrency = (val: any) => {
      const num = Number(val || 0);
      return `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${order.currency}`;
    };

    // Build items rows
    const itemsHtml = order.items
      .map((item: any) => {
        return `
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 12px 0; text-align: left; vertical-align: top;">
              <p style="margin: 0; font-size: 12px; font-weight: bold; color: #111827;">${
                item.productName || 'Producto'
              }</p>
              <p style="margin: 4px 0 0 0; font-size: 10px; font-family: monospace; color: #6b7280; text-transform: uppercase;">
                VARIANTE: ${(item.variantName || 'N/A').toUpperCase()}
              </p>
              <p style="margin: 2px 0 0 0; font-size: 10px; color: #9ca3af;">Cantidad: ${item.quantity}</p>
            </td>
            <td style="padding: 12px 0; text-align: right; vertical-align: top; font-size: 12px; font-weight: 600; color: #111827; white-space: nowrap;">
              ${item.quantity} x ${formatCurrency(item.unitPrice)}
            </td>
          </tr>
        `;
      })
      .join('');

    // Shipping Cost layout
    const shippingCostHtml =
      Number(order.shippingTotal) > 0
        ? `<span>${formatCurrency(order.shippingTotal)}</span>`
        : `<span style="color: #16a34a; font-weight: bold; text-transform: uppercase; font-size: 9px; background-color: #f0fdf4; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.05em;">Gratis</span>`;

    // Payment Method & Transaction details
    let paymentMethodHtml = '';
    if (order.payment?.paymentMethod) {
      paymentMethodHtml = `
        <div style="display: table; width: 100%; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="display: table-cell; font-size: 12px; font-weight: 600; color: #6b7280; text-align: left;">Método de pago:</div>
          <div style="display: table-cell; font-size: 12px; font-weight: 500; color: #000000; text-align: right; text-transform: uppercase;">${order.payment.paymentMethod}</div>
        </div>
      `;
    }

    let transactionIdHtml = '';
    if (order.payment?.providerPaymentId) {
      transactionIdHtml = `
        <div style="display: table; width: 100%; padding-bottom: 0; margin-bottom: 0;">
          <div style="display: table-cell; font-size: 12px; font-weight: 600; color: #6b7280; text-align: left;">ID de transacción:</div>
          <div style="display: table-cell; font-size: 12px; font-family: monospace; color: #4b5563; text-align: right;">${order.payment.providerPaymentId}</div>
        </div>
      `;
    }

    // Shipping estimates
    let deliveryEstimatesHtml = '';
    if (order.splitShippingSelected) {
      deliveryEstimatesHtml = `
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-top: 8px; font-size: 11px;">
          <div style="margin-bottom: 8px;">
            <p style="margin: 0; font-weight: bold; color: #000000; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em;">Paquete 1 (Piezas Disponibles):</p>
            <p style="margin: 2px 0 0 0; color: #4b5563;">Llegada estimada en <strong>${order.firstPackageEstimatedMinBusinessDays ?? 2} a ${order.firstPackageEstimatedMaxBusinessDays ?? 5} días hábiles</strong>.</p>
          </div>
          <div style="border-top: 1px solid #e5e7eb; padding-top: 8px;">
            <p style="margin: 0; font-weight: bold; color: #000000; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em;">Paquete 2 (Piezas Bajo Demanda):</p>
            <p style="margin: 2px 0 0 0; color: #4b5563;">Confeccionado en CDMX y enviado. Llegada estimada en <strong>${order.secondPackageEstimatedMinBusinessDays ?? 9} a ${order.secondPackageEstimatedMaxBusinessDays ?? 14} días hábiles</strong>.</p>
          </div>
        </div>
      `;
    } else {
      deliveryEstimatesHtml = `
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-top: 8px; font-size: 11px; color: #4b5563;">
          Tu pedido se enviará completo. Llegada estimada general de: 
          <strong style="color: #db2777; margin-left: 2px;">${order.estimatedDeliveryMinBusinessDays ?? 2} a ${order.estimatedDeliveryMaxBusinessDays ?? 14} días hábiles</strong>.
        </div>
      `;
    }

    if (order.fulfillmentNotes) {
      deliveryEstimatesHtml += `
        <div style="background-color: #fff5f7; border: 1px solid #fce7f3; border-radius: 8px; padding: 10px; margin-top: 8px; font-size: 10px; color: #b91c1c; font-style: italic; line-height: 1.4;">
          <strong>Nota de confección:</strong> ${order.fulfillmentNotes}
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Confirmación de Compra</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;700;800&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 20px 0; background-color: #f3f4f6; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 10px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                
                <!-- Logo Header -->
                <tr>
                  <td style="padding: 24px 32px 16px 32px; text-align: center; border-bottom: 1px solid #f3f4f6;">
                    <h2 style="font-family: 'Bebas Neue', Arial, sans-serif; font-size: 32px; letter-spacing: 0.1em; color: #000000; text-transform: uppercase; margin: 0; font-weight: normal;">BOMBO TWERK</h2>
                    <p style="font-family: 'Inter', -apple-system, sans-serif; font-size: 9px; letter-spacing: 0.15em; color: #737373; font-weight: bold; text-transform: uppercase; margin: -4px 0 0 0;">
                      ATELIER // PERFORMANCEWEAR
                    </p>
                  </td>
                </tr>

                <!-- Content Area -->
                <tr>
                  <td style="padding: 32px; font-family: 'Inter', -apple-system, sans-serif;">
                    
                    <!-- Greeting -->
                    <div style="margin-bottom: 24px;">
                      <p style="font-size: 14px; font-weight: bold; color: #000000; margin: 0 0 8px 0;">Hola, ${
                        order.customerName || 'Invitado'
                      }.</p>
                      <p style="font-size: 12px; color: #4b5563; line-height: 1.6; margin: 0;">
                        Gracias por tu compra en <strong>Bombo Twerk</strong>. Tu pedido ha sido registrado con éxito y estamos listos para procesarlo en nuestro taller.
                      </p>
                    </div>

                    <!-- Order Info Banner -->
                    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                      <div style="display: table; width: 100%; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 8px;">
                        <div style="display: table-cell; font-size: 12px; font-weight: 600; color: #6b7280; text-align: left;">Estado del pago:</div>
                        <div style="display: table-cell; font-size: 12px; font-weight: bold; color: #16a34a; text-align: right; text-transform: uppercase; letter-spacing: 0.05em;">Aprobado</div>
                      </div>
                      <div style="display: table; width: 100%; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 8px;">
                        <div style="display: table-cell; font-size: 12px; font-weight: 600; color: #6b7280; text-align: left;">Número de orden:</div>
                        <div style="display: table-cell; font-size: 12px; font-family: monospace; font-weight: bold; color: #000000; text-align: right;">${
                          order.orderNumber
                        }</div>
                      </div>
                      <div style="display: table; width: 100%; border-bottom: ${
                        order.payment?.paymentMethod ? '1px solid #e5e7eb' : 'none'
                      }; padding-bottom: ${
                        order.payment?.paymentMethod ? '8px' : '0'
                      }; margin-bottom: ${order.payment?.paymentMethod ? '8px' : '0'};">
                        <div style="display: table-cell; font-size: 12px; font-weight: 600; color: #6b7280; text-align: left;">Fecha del pedido:</div>
                        <div style="display: table-cell; font-size: 12px; color: #000000; text-align: right;">${formattedDate}</div>
                      </div>
                      ${paymentMethodHtml}
                      ${transactionIdHtml}
                    </div>

                    <!-- Products Table -->
                    <div style="margin-bottom: 24px;">
                      <h3 style="font-size: 12px; font-weight: bold; color: #000000; letter-spacing: 0.05em; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin: 0 0 12px 0;">
                        DETALLE DEL PEDIDO
                      </h3>
                      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                        ${itemsHtml}
                      </table>
                    </div>

                    <!-- Pricing Summary -->
                    <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-bottom: 24px; font-size: 12px;">
                      <div style="display: table; width: 100%; margin-bottom: 8px;">
                        <div style="display: table-cell; color: #6b7280; text-align: left;">Subtotal</div>
                        <div style="display: table-cell; color: #111827; text-align: right;">${formatCurrency(
                          order.subtotal
                        )}</div>
                      </div>
                      <div style="display: table; width: 100%; margin-bottom: 12px;">
                        <div style="display: table-cell; color: #6b7280; text-align: left;">Costo de envío</div>
                        <div style="display: table-cell; color: #111827; text-align: right;">${shippingCostHtml}</div>
                      </div>
                      ${
                        order.splitShippingSelected
                          ? `
                      <div style="display: table; width: 100%; margin-bottom: 12px;">
                        <div style="display: table-cell; color: #6b7280; text-align: left;">Envío dividido</div>
                        <div style="display: table-cell; color: #111827; text-align: right;">${formatCurrency(
                          order.splitShippingCost ?? 150
                        )}</div>
                      </div>
                      `
                          : ''
                      }
                      <div style="display: table; width: 100%; border-top: 1px solid #f3f4f6; padding-top: 12px;">
                        <div style="display: table-cell; font-size: 14px; font-weight: bold; color: #000000; text-align: left; vertical-align: middle;">Total pagado</div>
                        <div style="display: table-cell; font-size: 18px; font-weight: bold; color: #db2777; text-align: right; vertical-align: middle;">${formatCurrency(
                          order.total
                        )}</div>
                      </div>
                    </div>

                    <!-- Shipping Address & Info -->
                    <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-bottom: 16px;">
                      <h3 style="font-size: 12px; font-weight: bold; color: #000000; letter-spacing: 0.05em; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin: 0 0 12px 0;">
                        DATOS DE ENTREGA
                      </h3>
                      <div style="font-size: 12px; color: #4b5563; line-height: 1.6;">
                        <p style="margin: 0 0 4px 0;"><span style="color: #6b7280; font-weight: 600;">Destinatario:</span> ${
                          order.customerName || 'Cliente'
                        }</p>
                        <p style="margin: 0 0 4px 0;"><span style="color: #6b7280; font-weight: 600;">Dirección:</span> ${
                          order.shippingAddress || 'N/A'
                        }</p>
                        ${
                          order.customerPhone
                            ? `<p style="margin: 0 0 4px 0;"><span style="color: #6b7280; font-weight: 600;">Teléfono:</span> ${order.customerPhone}</p>`
                            : ''
                        }
                      </div>
                    </div>

                    <!-- Estimates -->
                    <div style="margin-bottom: 8px;">
                      <span style="font-size: 10px; font-weight: bold; color: #6b7280; letter-spacing: 0.05em; text-transform: uppercase; display: block; margin-bottom: 4px;">ESTIMADO DE ENTREGA</span>
                      ${deliveryEstimatesHtml}
                    </div>

                    <!-- Footer -->
                    <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px; text-align: center;">
                      <p style="font-size: 10px; color: #9ca3af; line-height: 1.6; margin: 0 0 16px 0;">
                        Este correo es un comprobante de compra digital. Tan pronto como tu pedido sea despachado desde nuestro taller en CDMX, recibirás otro correo con la información de seguimiento.
                      </p>
                      <div style="font-size: 9px; font-weight: bold; color: #9ca3af; letter-spacing: 0.1em; text-transform: uppercase; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                        <span style="font-size: 12px; color: #9ca3af;">🛡️</span>
                        <span>CALIDAD CDMX ATELIER GARANTIZADA</span>
                      </div>
                    </div>

                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
