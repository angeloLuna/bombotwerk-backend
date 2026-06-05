import { CheckoutPricingService, CartItemInput } from './checkout-pricing.service';
import { PrismaService } from '../prisma/prisma.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('==================================================');
  console.log('🚀 Running CheckoutPricingService Test Suite...');
  console.log('==================================================\n');

  // Create mock database state
  const mockProducts: Record<string, any> = {
    'prod-1': { id: 'prod-1', name: 'Product 1', price: 100 },
    'prod-2': { id: 'prod-2', name: 'Product 2', price: 200 },
  };

  const mockVariants: Record<string, any> = {
    'var-1-prod-1': { id: 'var-1', productId: 'prod-1', availabilityMode: 'stock_only', color: 'Rojo' },
    'var-2-prod-1': { id: 'var-2', productId: 'prod-1', availabilityMode: 'made_to_order_only', color: 'Azul', madeToOrderMinDays: 7, madeToOrderMaxDays: 9 },
    'var-3-prod-1': { id: 'var-3', productId: 'prod-1', availabilityMode: 'stock_and_made_to_order', color: 'Verde', madeToOrderMinDays: 8, madeToOrderMaxDays: 10 },
    'var-4-prod-1': { id: 'var-4', productId: 'prod-1', availabilityMode: 'discontinued', color: 'Negro' },
  };

  const mockSizeStocks: Record<string, any> = {
    'var-1-S': { quantity: 10 },
    'var-2-S': { quantity: 0 },
    'var-3-S': { quantity: 2 },
    'var-4-S': { quantity: 0 },
  };

  // Mock Prisma Service
  const mockPrisma = {
    product: {
      findUnique: async ({ where }: any) => mockProducts[where.id] || null,
    },
    productVariant: {
      findFirst: async ({ where }: any) => {
        const key = `${where.id}-${where.productId}`;
        return mockVariants[key] || null;
      },
    },
    sizeStock: {
      findFirst: async ({ where }: any) => {
        const key = `${where.variantId}-${where.size}`;
        return mockSizeStocks[key] || null;
      },
    },
  } as unknown as PrismaService;

  const service = new CheckoutPricingService(mockPrisma);

  const testCalc = async (items: CartItemInput[], split: boolean = false) => {
    return await service.calculateShipping(items, split);
  };

  let passed = 0;
  let failed = 0;

  // 1. stock_only con stock suficiente
  try {
    const res = await testCalc([{ productId: 'prod-1', variantId: 'var-1', size: 'S', quantity: 5 }]);
    assert(res.items.length === 1, 'stock_only stock suficiente: 1 item');
    assert(res.items[0].fulfillmentType === 'stock', 'fulfillmentType === stock');
    assert(res.items[0].quantity === 5, 'quantity === 5');
    assert(res.total === 650, 'total should be 500 + 150 shipping');
    console.log('✅ 1. stock_only con stock suficiente: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 1. stock_only con stock suficiente: FAILED', e.message);
    failed++;
  }

  // 2. stock_only con stock insuficiente
  try {
    await testCalc([{ productId: 'prod-1', variantId: 'var-1', size: 'S', quantity: 15 }]);
    console.error('❌ 2. stock_only con stock insuficiente: FAILED (did not throw)');
    failed++;
  } catch (e: any) {
    assert(e.message.includes('Stock insuficiente'), 'Error message is correct');
    console.log('✅ 2. stock_only con stock insuficiente: PASSED');
    passed++;
  }

  // 3. made_to_order_only con stock 0
  try {
    const res = await testCalc([{ productId: 'prod-1', variantId: 'var-2', size: 'S', quantity: 3 }]);
    assert(res.items.length === 1, 'made_to_order_only: 1 item');
    assert(res.items[0].fulfillmentType === 'made_to_order', 'fulfillmentType === made_to_order');
    assert(res.items[0].quantity === 3, 'quantity === 3');
    assert(res.items[0].madeToOrderMinDays === 7, 'min days correct');
    console.log('✅ 3. made_to_order_only con stock 0: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 3. made_to_order_only con stock 0: FAILED', e.message);
    failed++;
  }

  // 4. stock_and_made_to_order con quantity menor o igual a stock
  try {
    const res = await testCalc([{ productId: 'prod-1', variantId: 'var-3', size: 'S', quantity: 2 }]);
    assert(res.items.length === 1, 'stock_and_made_to_order <= stock: 1 item');
    assert(res.items[0].fulfillmentType === 'stock', 'fulfillmentType === stock');
    assert(res.items[0].quantity === 2, 'quantity === 2');
    console.log('✅ 4. stock_and_made_to_order con quantity <= stock: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 4. stock_and_made_to_order con quantity <= stock: FAILED', e.message);
    failed++;
  }

  // 5. stock_and_made_to_order con quantity mayor a stock (split!)
  try {
    const res = await testCalc([{ productId: 'prod-1', variantId: 'var-3', size: 'S', quantity: 5 }]);
    assert(res.items.length === 2, 'stock_and_made_to_order > stock: split into 2 items');
    
    const stockItem = res.items.find(i => i.fulfillmentType === 'stock');
    const mtoItem = res.items.find(i => i.fulfillmentType === 'made_to_order');
    
    assert(!!stockItem, 'has stock item');
    assert(stockItem!.quantity === 2, 'stock item quantity matches stockQty (2)');
    
    assert(!!mtoItem, 'has mto item');
    assert(mtoItem!.quantity === 3, 'mto item quantity is quantity - stockQty (3)');
    assert(mtoItem!.madeToOrderMinDays === 8, 'mto min days correct');
    
    assert(res.hasInStockItems === true, 'hasInStockItems should be true');
    assert(res.hasMadeToOrderItems === true, 'hasMadeToOrderItems should be true');
    assert(res.isMixedFulfillmentCart === true, 'isMixedFulfillmentCart should be true');
    console.log('✅ 5. stock_and_made_to_order con quantity > stock (split): PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 5. stock_and_made_to_order con quantity > stock (split): FAILED', e.message);
    failed++;
  }

  // 6. discontinued sin stock
  try {
    await testCalc([{ productId: 'prod-1', variantId: 'var-4', size: 'S', quantity: 1 }]);
    console.error('❌ 6. discontinued sin stock: FAILED (did not throw)');
    failed++;
  } catch (e: any) {
    assert(e.message.includes('agotado') || e.message.includes('descontinuado'), 'Error message correct');
    console.log('✅ 6. discontinued sin stock: PASSED');
    passed++;
  }

  // 7. carrito mixto con varios productos
  try {
    const res = await testCalc([
      { productId: 'prod-1', variantId: 'var-1', size: 'S', quantity: 2 }, // stock_only (200)
      { productId: 'prod-1', variantId: 'var-2', size: 'S', quantity: 1 }, // made_to_order (100)
    ]);
    assert(res.items.length === 2, 'mixed: 2 items');
    assert(res.hasInStockItems === true, 'hasInStockItems is true');
    assert(res.hasMadeToOrderItems === true, 'hasMadeToOrderItems is true');
    assert(res.isMixedFulfillmentCart === true, 'isMixedFulfillmentCart is true');
    assert(res.total === 450, 'total matches: 300 subtotal + 150 shipping');
    console.log('✅ 7. carrito mixto con varios productos: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 7. carrito mixto con varios productos: FAILED', e.message);
    failed++;
  }

  // 8. una misma variante con stock parcial y bajo pedido parcial (mismo que 5, but let's confirm details)
  try {
    const res = await testCalc([{ productId: 'prod-1', variantId: 'var-3', size: 'S', quantity: 4 }]);
    assert(res.items.length === 2, 'same variant partial stock: split in 2');
    const stockQty = res.items.find(i => i.fulfillmentType === 'stock')?.quantity;
    const mtoQty = res.items.find(i => i.fulfillmentType === 'made_to_order')?.quantity;
    assert(stockQty === 2, '2 immediate');
    assert(mtoQty === 2, '2 made to order');
    console.log('✅ 8. una misma variante con stock parcial y bajo pedido parcial: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 8. una misma variante con stock parcial y bajo pedido parcial: FAILED', e.message);
    failed++;
  }

  console.log('\n==================================================');
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed.`);
  console.log('==================================================');
}

runTests().catch(console.error);
