import { AdminUsersService } from './admin-users.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('==================================================');
  console.log('🚀 Running Admin Users & Audit Logs Test Suite...');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  // --- TEST 1: AdminGuard role verification ---
  try {
    const guard = new AdminGuard();
    
    // Mock Execution Context for admin user
    const mockAdminContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'admin-1', email: 'admin@bombotwerk.com', role: 'admin' },
        }),
      }),
    } as unknown as ExecutionContext;

    // Mock Execution Context for regular user
    const mockCustomerContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user-1', email: 'user@gmail.com', role: 'customer' },
        }),
      }),
    } as unknown as ExecutionContext;

    // Admin should pass
    const adminPassed = guard.canActivate(mockAdminContext);
    assert(adminPassed === true, 'Admin role should be authorized by AdminGuard');

    // Customer should throw ForbiddenException
    try {
      guard.canActivate(mockCustomerContext);
      assert(false, 'Customer role should throw ForbiddenException');
    } catch (err: any) {
      assert(err instanceof ForbiddenException, 'Error should be ForbiddenException');
      assert(err.message === 'Access denied. Admin role required.', 'Message matches');
    }

    console.log('✅ 1. AdminGuard role verification: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 1. AdminGuard role verification: FAILED', e.stack);
    failed++;
  }

  // --- TEST 2: AdminUsersService.findOne Consolidated Data resolving ---
  try {
    const mockOrders = [
      { id: 'order-1', orderNumber: 'BT-2026-000001', total: 1200, status: 'paid', customerEmail: 'buyer@gmail.com', payment: { status: 'approved' }, items: [{ productId: 'p1', productName: 'Twerk Shorts', size: 'M', quantity: 2, unitPrice: 600 }] },
      { id: 'order-2', orderNumber: 'BT-2026-000002', total: 800, status: 'pending', customerEmail: 'buyer@gmail.com', payment: null, items: [{ productId: 'p1', productName: 'Twerk Shorts', size: 'M', quantity: 1, unitPrice: 600 }] },
    ];

    const mockActivityLogs = [
      { id: 'log-1', eventType: 'add_to_cart', metadata: {}, createdAt: new Date() },
    ];

    const mockPrisma = {
      user: {
        findUnique: async () => ({ id: 'user-123', email: 'buyer@gmail.com', name: 'Buyer Test', role: 'customer', createdAt: new Date(), updatedAt: new Date() }),
      },
      customer: {
        findFirst: async () => ({ id: 'cust-123', email: 'buyer@gmail.com', name: 'Buyer Test', phone: '5511223344', userId: 'user-123' }),
        findUnique: async () => ({ id: 'cust-123', email: 'buyer@gmail.com', name: 'Buyer Test', phone: '5511223344', userId: 'user-123' }),
      },
      order: {
        findMany: async () => mockOrders,
      },
      activityLog: {
        findMany: async () => mockActivityLogs,
      },
    } as unknown as PrismaService;

    const service = new AdminUsersService(mockPrisma);
    const details = await service.findOne('buyer@gmail.com');

    // Assert consolidated metrics
    assert(details.email === 'buyer@gmail.com', 'Email matches');
    assert(details.name === 'Buyer Test', 'Name matches');
    assert(details.phone === '5511223344', 'Phone matches');
    assert(details.metrics.orderCount === 2, 'Aggregated orderCount matches (2)');
    assert(details.metrics.totalSpent === 2000, 'Aggregated totalSpent matches (2000)');
    assert(details.metrics.averageTicket === 1000, 'Aggregated averageTicket matches (1000)');
    assert(details.orders.length === 2, 'Orders array returned correctly');
    assert(details.productsBought.length === 1, 'Grouped unique products bought matches (1)');
    assert(details.productsBought[0].quantity === 3, 'Grouped quantity sum matches (2+1 = 3)');
    assert(details.activityLogs.length === 1, 'Activity logs returned');

    console.log('✅ 2. AdminUsersService.findOne Consolidated Data: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 2. AdminUsersService.findOne Consolidated Data: FAILED', e.stack);
    failed++;
  }

  // --- TEST 3: AdminUsersService.findAll SQL validation and dynamic filters ---
  try {
    let capturedQuery = '';
    const mockPrisma = {
      $queryRawUnsafe: async (sql: string) => {
        capturedQuery = sql;
        if (sql.trim().toLowerCase().startsWith('select count')) {
          return [{ count: 5 }];
        }
        return [
          { email: 'user1@gmail.com', name: 'User 1', orderCount: 2, totalSpent: 1200, averageTicket: 600, userType: 'registered' },
        ];
      },
    } as unknown as PrismaService;

    const service = new AdminUsersService(mockPrisma);

    // Call list with filters
    const results = await service.findAll({
      page: '1',
      limit: '10',
      email: 'search-email',
      name: 'search-name',
      hasOrders: 'true',
      isRegistered: 'true',
    });

    assert(results.total === 5, 'Total matching rows count is correct');
    assert(results.data.length === 1, 'Results data array matches');
    assert(results.data[0].email === 'user1@gmail.com', 'Data email is correct');

    // Check generated query filters
    assert(capturedQuery.includes("e.email ILIKE '%search-email%'"), 'Email filter generated correctly');
    assert(capturedQuery.includes("(u.name ILIKE '%search-name%' OR c.name ILIKE '%search-name%')"), 'Name filter generated correctly');
    assert(capturedQuery.includes('COALESCE(c_orders.order_count, 0) > 0'), 'HasOrders filter generated');
    assert(capturedQuery.includes('u.id IS NOT NULL'), 'isRegistered filter generated');

    console.log('✅ 3. AdminUsersService.findAll SQL and filters: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 3. AdminUsersService.findAll SQL and filters: FAILED', e.stack);
    failed++;
  }

  // --- TEST 4: Audit log creation during product update in AdminProductsService ---
  try {
    const mockExistingProduct = {
      id: 'prod-123',
      name: 'Velvet Shorts',
      slug: 'velvet-shorts',
      price: 500,
      variants: [{ id: 'var-1', sku: 'VS-S', stocks: [{ size: 'S', quantity: 2 }] }],
    };

    let capturedAuditLogs: any[] = [];

    const mockPrisma = {
      product: {
        findUnique: async () => mockExistingProduct,
        findFirst: async () => null,
        update: async () => mockExistingProduct,
      },
      productVariant: {
        findMany: async () => [{ id: 'var-1' }],
        deleteMany: async () => ({ count: 1 }),
        create: async () => ({ id: 'var-new', sku: 'VS-S-NEW' }),
      },
      sizeStock: {
        deleteMany: async () => ({ count: 1 }),
        createMany: async () => ({ count: 1 }),
      },
      variantImage: {
        findMany: async () => [],
        deleteMany: async () => ({ count: 1 }),
      },
      redirect: {
        upsert: async () => ({}),
        updateMany: async () => ({ count: 0 }),
      },
      auditLog: {
        create: async ({ data }: any) => {
          capturedAuditLogs.push(data);
          return { id: 'audit-log-1', ...data };
        },
      },
      $transaction: async (fn: any) => {
        // Execute the transaction callback using a mock tx object that maps directly to mockPrisma
        return fn(mockPrisma);
      },
    } as unknown as PrismaService;

    // We can simulate the product update audit logs using the service update logic or directly validating our injected queries
    const { AdminProductsService } = require('./admin-products.service');
    const storageServiceMock = {} as any;
    const prodService = new AdminProductsService(mockPrisma, storageServiceMock);
    
    // Trigger product update with variants (inventory update!)
    await prodService.update('prod-123', {
      name: 'Velvet Shorts Updated',
      variants: [{ sku: 'VS-S-NEW', stocks: [{ size: 'S', quantity: 5 }] }],
    }, 'admin-1');

    assert(capturedAuditLogs.length === 2, 'Two audit logs should be created: product update + inventory update');
    
    // Assert product update log
    const prodLog = capturedAuditLogs.find(l => l.action === 'admin_updated_product');
    assert(!!prodLog, 'admin_updated_product log exists');
    assert(prodLog.adminUserId === 'admin-1', 'adminUserId set correctly');
    assert(prodLog.entityType === 'Product', 'entityType is Product');
    assert(prodLog.entityId === 'prod-123', 'entityId matches');
    assert(prodLog.before.name === 'Velvet Shorts', 'before state matches');

    // Assert inventory update log
    const invLog = capturedAuditLogs.find(l => l.action === 'admin_updated_inventory');
    assert(!!invLog, 'admin_updated_inventory log exists');
    assert(invLog.adminUserId === 'admin-1', 'adminUserId set correctly');
    assert(invLog.entityType === 'Product', 'entityType is Product');
    assert(invLog.entityId === 'prod-123', 'entityId matches');

    console.log('✅ 4. Audit Log generation during product update: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 4. Audit Log generation during product update: FAILED', e.stack);
    failed++;
  }

  // --- TEST 5: AdminDashboardService Summary calculations ---
  try {
    const mockPrisma = {
      order: {
        aggregate: async () => ({ _sum: { total: 5000 } }),
        count: async () => 10,
        findMany: async () => [
          { id: 'order-1', orderNumber: 'BT-001', customerEmail: 'test@gmail.com', total: 500, status: 'paid', fulfillmentStatus: 'preparing', createdAt: new Date() }
        ],
      },
      product: {
        findMany: async () => [
          {
            id: 'p1',
            variants: [
              { availabilityMode: 'stock_only', stocks: [{ quantity: 1 }] },
              { availabilityMode: 'made_to_order_only', stocks: [] }
            ]
          }
        ],
      },
      user: {
        findMany: async () => [{ id: 'u1', email: 'u1@gmail.com', name: 'User 1', createdAt: new Date(), role: 'customer' }],
      },
    } as unknown as PrismaService;

    const { AdminDashboardService } = require('./admin-dashboard.service');
    const service = new AdminDashboardService(mockPrisma);
    const summary = await service.getSummary();

    assert(summary.sales.today === 5000, 'Today sales aggregated total should be 5000');
    assert(summary.sales.month === 5000, 'Month sales aggregated total should be 5000');
    assert(summary.orders.total === 10, 'Total orders count should be 10');
    assert(summary.inventory.lowStock === 1, 'Low stock count should be 1 (product p1 stock <= 2)');
    assert(summary.inventory.madeToOrderActive === 1, 'Made-to-order active count should be 1');
    assert(summary.latestOrders[0].orderNumber === 'BT-001', 'Latest orderNumber matches');

    console.log('✅ 5. AdminDashboardService Summary calculation: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 5. AdminDashboardService Summary calculation: FAILED', e.stack);
    failed++;
  }

  // --- TEST 6: AdminOrdersService operational updates (fulfillment, shipping, notes) ---
  try {
    const mockOrder = {
      id: 'order-99',
      orderNumber: 'BT-099',
      status: 'paid',
      fulfillmentStatus: 'pending_review',
      carrier: null,
      trackingNumber: null,
      trackingUrl: null,
      shippedAt: null,
      deliveredAt: null,
      updatedAt: new Date(),
    };

    let capturedAuditLogs: any[] = [];
    let updatedOrderData: any = {};
    let createdNoteData: any = {};

    const mockPrisma = {
      order: {
        findUnique: async () => mockOrder,
        update: async ({ data }: any) => {
          updatedOrderData = data;
          return { ...mockOrder, ...data };
        },
      },
      orderNote: {
        create: async ({ data }: any) => {
          createdNoteData = data;
          return { id: 'note-1', ...data, createdAt: new Date() };
        },
      },
      auditLog: {
        create: async ({ data }: any) => {
          capturedAuditLogs.push(data);
          return { id: 'audit-log-1', ...data };
        },
      },
    } as unknown as PrismaService;

    const { AdminOrdersService } = require('./admin-orders.service');
    const service = new AdminOrdersService(mockPrisma, {} as any);

    // Test 6.1: Update fulfillment status
    await service.updateFulfillmentStatus('order-99', 'preparing', 'admin-1');
    assert(updatedOrderData.fulfillmentStatus === 'preparing', 'Fulfillment status updated to preparing');
    assert(capturedAuditLogs.length === 1, 'One audit log created for fulfillment update');
    assert(capturedAuditLogs[0].action === 'admin_updated_order_fulfillment_status', 'Audit action matches');

    // Reset captured logs
    capturedAuditLogs = [];

    // Test 6.2: Update shipping details
    await service.updateShipping('order-99', {
      carrier: 'DHL',
      trackingNumber: 'TRACK123',
      trackingUrl: 'https://dhl.com',
      shippedAt: '2026-06-06',
    }, 'admin-1');

    assert(updatedOrderData.carrier === 'DHL', 'Carrier set correctly');
    assert(updatedOrderData.trackingNumber === 'TRACK123', 'Tracking number set correctly');
    assert(updatedOrderData.fulfillmentStatus === 'shipped', 'Fulfillment status auto-updated to shipped');
    assert(capturedAuditLogs.length === 1, 'One audit log created for shipping update');
    assert(capturedAuditLogs[0].action === 'admin_updated_order_shipping', 'Audit action matches');

    // Reset captured logs
    capturedAuditLogs = [];

    // Test 6.3: Add internal order note
    await service.addNote('order-99', 'Need to review size with client', 'admin-1');
    assert(createdNoteData.content === 'Need to review size with client', 'Note content saved correctly');
    assert(capturedAuditLogs.length === 1, 'One audit log created for order note');
    assert(capturedAuditLogs[0].action === 'admin_updated_order_internal_notes', 'Audit action matches');

    console.log('✅ 6. AdminOrdersService operational updates: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 6. AdminOrdersService operational updates: FAILED', e.stack);
    failed++;
  }

  console.log('\n==================================================');
  console.log(`📊 Admin & Audit Log Test Results: ${passed} passed, ${failed} failed.`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
