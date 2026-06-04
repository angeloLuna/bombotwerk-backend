import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CartItemInput {
  productId: string;
  variantId: string;
  size: string;
  quantity: number;
}

@Injectable()
export class CheckoutPricingService {
  constructor(private readonly prisma: PrismaService) {}

  // Constants
  readonly STANDARD_SHIPPING_COST_MXN = 150;
  readonly FREE_SHIPPING_THRESHOLD_MXN = 1000;
  readonly STANDARD_SHIPPING_MIN_BUSINESS_DAYS = 2;
  readonly STANDARD_SHIPPING_MAX_BUSINESS_DAYS = 5;
  readonly MADE_TO_ORDER_PRODUCTION_MIN_BUSINESS_DAYS = 7;
  readonly MADE_TO_ORDER_PRODUCTION_MAX_BUSINESS_DAYS = 9;
  readonly MADE_TO_ORDER_TOTAL_MIN_BUSINESS_DAYS = 9;
  readonly MADE_TO_ORDER_TOTAL_MAX_BUSINESS_DAYS = 14;
  readonly SPLIT_SHIPPING_COST_MXN = 150;

  async calculateShipping(
    cartItems: CartItemInput[],
    splitShippingSelected: boolean,
    bypassShipping?: boolean
  ) {
    let subtotal = 0;
    let hasInStockItems = false;
    let hasMadeToOrderItems = false;

    const validatedItems = [];

    for (const item of cartItems) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product with ID "${item.productId}" not found.`);
      }

      const variant = await this.prisma.productVariant.findFirst({
        where: { id: item.variantId, productId: item.productId },
      });
      if (!variant) {
        throw new NotFoundException(`Variant with ID "${item.variantId}" not found for product "${product.name}".`);
      }

      const sizeStock = await this.prisma.sizeStock.findFirst({
        where: { variantId: variant.id, size: item.size },
      });
      const stockQty = sizeStock ? sizeStock.quantity : 0;

      let fulfillmentType = 'stock';

      if (variant.availabilityMode === 'discontinued') {
        throw new BadRequestException(
          `El producto "${product.name}" (${variant.color || 'Estándar'} - Talla ${item.size}) está descontinuado y no se puede comprar.`
        );
      } else if (variant.availabilityMode === 'made_to_order_only') {
        fulfillmentType = 'made_to_order';
      } else if (variant.availabilityMode === 'stock_and_made_to_order') {
        if (stockQty >= item.quantity) {
          fulfillmentType = 'stock';
        } else {
          fulfillmentType = 'made_to_order';
        }
      } else if (variant.availabilityMode === 'stock_only') {
        if (stockQty < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para el producto "${product.name}" (${variant.color || 'Estándar'} - Talla ${item.size}). Disponible: ${stockQty}.`
          );
        }
        fulfillmentType = 'stock';
      } else {
        if (stockQty < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para el producto "${product.name}" (${variant.color || 'Estándar'} - Talla ${item.size}).`
          );
        }
        fulfillmentType = 'stock';
      }

      if (fulfillmentType === 'made_to_order') {
        hasMadeToOrderItems = true;
      } else {
        hasInStockItems = true;
      }

      const itemPrice = Number(product.price);
      subtotal += itemPrice * item.quantity;

      validatedItems.push({
        productId: item.productId,
        variantId: item.variantId,
        size: item.size,
        quantity: item.quantity,
        unitPrice: product.price,
        total: itemPrice * item.quantity,
        fulfillmentType,
        productName: product.name,
        variantName: `${variant.color || 'Standard'} / ${item.size}`,
        madeToOrderMinDays: fulfillmentType === 'made_to_order' ? variant.madeToOrderMinDays : null,
        madeToOrderMaxDays: fulfillmentType === 'made_to_order' ? variant.madeToOrderMaxDays : null,
      });
    }

    const isMixedFulfillmentCart = hasInStockItems && hasMadeToOrderItems;
    const splitShippingAvailable = isMixedFulfillmentCart;
    const finalSplitShippingSelected = splitShippingAvailable ? splitShippingSelected : false;

    // Shipping rules
    const isFreeShipping = !!bypassShipping || subtotal >= this.FREE_SHIPPING_THRESHOLD_MXN;
    const shippingCost = isFreeShipping ? 0 : this.STANDARD_SHIPPING_COST_MXN;
    const amountRemainingForFreeShipping = Math.max(0, this.FREE_SHIPPING_THRESHOLD_MXN - subtotal);
    const splitShippingCost = finalSplitShippingSelected && !bypassShipping ? this.SPLIT_SHIPPING_COST_MXN : 0;
    const total = subtotal + shippingCost + splitShippingCost;

    // Delivery estimates
    let estimatedDeliveryMinBusinessDays = this.STANDARD_SHIPPING_MIN_BUSINESS_DAYS;
    let estimatedDeliveryMaxBusinessDays = this.STANDARD_SHIPPING_MAX_BUSINESS_DAYS;
    let firstPackageEstimatedMinBusinessDays: number | null = null;
    let firstPackageEstimatedMaxBusinessDays: number | null = null;
    let secondPackageEstimatedMinBusinessDays: number | null = null;
    let secondPackageEstimatedMaxBusinessDays: number | null = null;

    let fulfillmentNotes = '';

    if (isMixedFulfillmentCart) {
      if (finalSplitShippingSelected) {
        estimatedDeliveryMinBusinessDays = this.STANDARD_SHIPPING_MIN_BUSINESS_DAYS;
        estimatedDeliveryMaxBusinessDays = this.MADE_TO_ORDER_TOTAL_MAX_BUSINESS_DAYS;
        
        firstPackageEstimatedMinBusinessDays = this.STANDARD_SHIPPING_MIN_BUSINESS_DAYS;
        firstPackageEstimatedMaxBusinessDays = this.STANDARD_SHIPPING_MAX_BUSINESS_DAYS;
        
        secondPackageEstimatedMinBusinessDays = this.MADE_TO_ORDER_TOTAL_MIN_BUSINESS_DAYS;
        secondPackageEstimatedMaxBusinessDays = this.MADE_TO_ORDER_TOTAL_MAX_BUSINESS_DAYS;

        fulfillmentNotes = 'Envío dividido seleccionado: piezas disponibles primero (2 a 5 días hábiles), piezas bajo demanda después (9 a 14 días hábiles).';
      } else {
        estimatedDeliveryMinBusinessDays = this.MADE_TO_ORDER_TOTAL_MIN_BUSINESS_DAYS;
        estimatedDeliveryMaxBusinessDays = this.MADE_TO_ORDER_TOTAL_MAX_BUSINESS_DAYS;
        
        fulfillmentNotes = 'Tu pedido combina piezas disponibles y piezas bajo demanda. Enviaremos tu pedido completo cuando todas las piezas estén listas.';
      }
    } else if (hasMadeToOrderItems) {
      estimatedDeliveryMinBusinessDays = this.MADE_TO_ORDER_TOTAL_MIN_BUSINESS_DAYS;
      estimatedDeliveryMaxBusinessDays = this.MADE_TO_ORDER_TOTAL_MAX_BUSINESS_DAYS;
      
      fulfillmentNotes = 'Tu pedido incluye piezas bajo demanda. Entrega estimada: 9 a 14 días hábiles (incluye fabricación).';
    } else {
      estimatedDeliveryMinBusinessDays = this.STANDARD_SHIPPING_MIN_BUSINESS_DAYS;
      estimatedDeliveryMaxBusinessDays = this.STANDARD_SHIPPING_MAX_BUSINESS_DAYS;
      
      fulfillmentNotes = 'Entrega estimada: 2 a 5 días hábiles.';
    }

    const shippingNotes = bypassShipping
      ? 'Envío gratis (Pruebas)'
      : finalSplitShippingSelected
        ? 'Envío dividido (+ $150 MXN)'
        : isFreeShipping
          ? 'Envío estándar (Gratis)'
          : 'Envío estándar ($150 MXN)';

    return {
      subtotal,
      shippingMethod: 'standard',
      shippingLabel: 'Envío estándar',
      shippingCost,
      isFreeShipping,
      freeShippingThreshold: this.FREE_SHIPPING_THRESHOLD_MXN,
      amountRemainingForFreeShipping,
      hasInStockItems,
      hasMadeToOrderItems,
      isMixedFulfillmentCart,
      splitShippingAvailable,
      splitShippingSelected: finalSplitShippingSelected,
      splitShippingCost,
      estimatedDeliveryMinBusinessDays,
      estimatedDeliveryMaxBusinessDays,
      firstPackageEstimatedMinBusinessDays,
      firstPackageEstimatedMaxBusinessDays,
      secondPackageEstimatedMinBusinessDays,
      secondPackageEstimatedMaxBusinessDays,
      total,
      fulfillmentNotes,
      shippingNotes,
      items: validatedItems,
    };
  }
}
