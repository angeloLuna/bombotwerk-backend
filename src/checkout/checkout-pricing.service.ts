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

      let stockUnits = 0;
      let mtoUnits = 0;

      if (variant.availabilityMode === 'discontinued') {
        if (stockQty <= 0) {
          throw new BadRequestException(
            `El producto "${product.name}" (${variant.color || 'Estándar'} - Talla ${item.size}) está descontinuado y agotado.`
          );
        }
        if (item.quantity > stockQty) {
          throw new BadRequestException(
            `El producto "${product.name}" (${variant.color || 'Estándar'} - Talla ${item.size}) está descontinuado. Solo quedan ${stockQty} unidades en existencia.`
          );
        }
        stockUnits = item.quantity;
      } else if (variant.availabilityMode === 'stock_only') {
        if (stockQty < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para el producto "${product.name}" (${variant.color || 'Estándar'} - Talla ${item.size}). Disponible: ${stockQty}.`
          );
        }
        stockUnits = item.quantity;
      } else if (variant.availabilityMode === 'made_to_order_only') {
        mtoUnits = item.quantity;
      } else if (variant.availabilityMode === 'stock_and_made_to_order') {
        if (stockQty >= item.quantity) {
          stockUnits = item.quantity;
        } else {
          stockUnits = Math.max(0, stockQty);
          mtoUnits = item.quantity - stockUnits;
        }
      } else {
        // Fallback to stock_only behavior
        if (stockQty < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para el producto "${product.name}" (${variant.color || 'Estándar'} - Talla ${item.size}).`
          );
        }
        stockUnits = item.quantity;
      }

      const itemPrice = Number(product.price);

      // Add stock item part if any
      if (stockUnits > 0) {
        hasInStockItems = true;
        subtotal += itemPrice * stockUnits;
        validatedItems.push({
          productId: item.productId,
          variantId: item.variantId,
          size: item.size,
          quantity: stockUnits,
          unitPrice: product.price,
          total: itemPrice * stockUnits,
          fulfillmentType: 'stock',
          productName: product.name,
          variantName: `${variant.color || 'Standard'} / ${item.size}`,
          madeToOrderMinDays: null,
          madeToOrderMaxDays: null,
        });
      }

      // Add made-to-order item part if any
      if (mtoUnits > 0) {
        hasMadeToOrderItems = true;
        subtotal += itemPrice * mtoUnits;
        validatedItems.push({
          productId: item.productId,
          variantId: item.variantId,
          size: item.size,
          quantity: mtoUnits,
          unitPrice: product.price,
          total: itemPrice * mtoUnits,
          fulfillmentType: 'made_to_order',
          productName: product.name,
          variantName: `${variant.color || 'Standard'} / ${item.size}`,
          madeToOrderMinDays: variant.madeToOrderMinDays ?? 7,
          madeToOrderMaxDays: variant.madeToOrderMaxDays ?? 9,
        });
      }
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
