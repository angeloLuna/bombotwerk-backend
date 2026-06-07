import { AdminMerchandisingService } from './admin-merchandising.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('==================================================');
  console.log('🚀 Running Admin Merchandising Test Suite...');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  // Mock StorageService
  const mockStorageService = {
    uploadFile: async (file: any, folder: string) => {
      assert(folder === 'merchandising/uploads', 'Should upload to the merchandising uploads folder');
      return {
        publicUrl: `https://r2.bombotwerk.com/${folder}/${file.originalname}`,
        key: `key-${file.originalname}`,
      };
    },
  } as unknown as StorageService;

  // --- TEST 1: AdminMerchandisingService.findAll ---
  try {
    const mockCards = [
      { id: '1', title: 'A', sortOrder: 0, createdAt: new Date('2026-06-01') },
      { id: '2', title: 'B', sortOrder: 1, createdAt: new Date('2026-06-02') },
    ];

    const mockPrisma = {
      productTypeCard: {
        findMany: async (args: any) => {
          assert(args.orderBy[0].sortOrder === 'asc', 'Should order by sortOrder asc');
          assert(args.orderBy[1].createdAt === 'desc', 'Should order by createdAt desc');
          return mockCards;
        },
      },
    } as unknown as PrismaService;

    const service = new AdminMerchandisingService(mockPrisma, mockStorageService);
    const result = await service.findAll();
    assert(result.length === 2, 'Should return 2 cards');
    assert(result[0].id === '1', 'First card matches');

    console.log('✅ 1. AdminMerchandisingService.findAll: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 1. AdminMerchandisingService.findAll: FAILED', e.stack);
    failed++;
  }

  // --- TEST 2: AdminMerchandisingService.create ---
  try {
    let capturedCreateData: any = null;
    let capturedAuditLog: any = null;

    const mockPrisma = {
      productTypeCard: {
        create: async ({ data }: any) => {
          capturedCreateData = data;
          return { id: 'card-123', ...data, createdAt: new Date(), updatedAt: new Date() };
        },
      },
      auditLog: {
        create: async ({ data }: any) => {
          capturedAuditLog = data;
          return { id: 'audit-1', ...data };
        },
      },
    } as unknown as PrismaService;

    const service = new AdminMerchandisingService(mockPrisma, mockStorageService);
    const dto = {
      title: 'Cacheteros',
      slug: 'cacheteros',
      imageUrl: 'https://images.unsplash.com/photo-1',
      href: '/tienda?category=cacheteros',
      linkType: 'category',
      sortOrder: 5,
    };

    const card = await service.create(dto, 'admin-user-id');

    // Assert creations
    assert(card.id === 'card-123', 'Should return created card');
    assert(capturedCreateData.title === 'Cacheteros', 'Title match');
    assert(capturedCreateData.sortOrder === 5, 'sortOrder match');
    assert(capturedCreateData.isActive === true, 'isActive defaults to true');
    assert(capturedCreateData.highlight === false, 'highlight defaults to false');

    // Assert audit log
    assert(capturedAuditLog !== null, 'Audit log should be created');
    assert(capturedAuditLog.adminUserId === 'admin-user-id', 'Admin user ID match');
    assert(capturedAuditLog.action === 'admin_created_product_type_card', 'Action match');
    assert(capturedAuditLog.entityType === 'ProductTypeCard', 'EntityType match');
    assert(capturedAuditLog.entityId === 'card-123', 'EntityId matches created card');
    assert(capturedAuditLog.after.title === 'Cacheteros', 'State after matches');

    console.log('✅ 2. AdminMerchandisingService.create: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 2. AdminMerchandisingService.create: FAILED', e.stack);
    failed++;
  }

  // --- TEST 3: AdminMerchandisingService.update ---
  try {
    const existingCard = {
      id: 'card-123',
      title: 'Cacheteros Old',
      slug: 'cacheteros-old',
      imageUrl: 'https://images.unsplash.com/photo-1',
      href: '/tienda?category=cacheteros',
      linkType: 'category',
      sortOrder: 5,
      isActive: true,
      highlight: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let capturedUpdateData: any = null;
    let capturedAuditLog: any = null;

    const mockPrisma = {
      productTypeCard: {
        findUnique: async ({ where }: any) => {
          assert(where.id === 'card-123', 'Should check correct card ID');
          return existingCard;
        },
        update: async ({ where, data }: any) => {
          assert(where.id === 'card-123', 'Should update correct card ID');
          capturedUpdateData = data;
          return { ...existingCard, ...data, updatedAt: new Date() };
        },
      },
      auditLog: {
        create: async ({ data }: any) => {
          capturedAuditLog = data;
          return { id: 'audit-2', ...data };
        },
      },
    } as unknown as PrismaService;

    const service = new AdminMerchandisingService(mockPrisma, mockStorageService);
    const dto = {
      title: 'Cacheteros New',
      sortOrder: 10,
      highlight: true,
    };

    const card = await service.update('card-123', dto, 'admin-user-id');

    // Assert update data
    assert(card.title === 'Cacheteros New', 'Title updated');
    assert(capturedUpdateData.title === 'Cacheteros New', 'Updated field check');
    assert(capturedUpdateData.sortOrder === 10, 'Updated field check');
    assert(capturedUpdateData.highlight === true, 'Updated field check');
    assert(capturedUpdateData.isActive === undefined, 'Unspecified fields should not be included in update');

    // Assert audit log
    assert(capturedAuditLog !== null, 'Audit log should be created');
    assert(capturedAuditLog.action === 'admin_updated_product_type_card', 'Action matches update');
    assert(capturedAuditLog.before.title === 'Cacheteros Old', 'Audit before state matches');
    assert(capturedAuditLog.after.title === 'Cacheteros New', 'Audit after state matches');

    console.log('✅ 3. AdminMerchandisingService.update: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 3. AdminMerchandisingService.update: FAILED', e.stack);
    failed++;
  }

  // --- TEST 4: AdminMerchandisingService.update (Not Found) ---
  try {
    const mockPrisma = {
      productTypeCard: {
        findUnique: async () => null,
      },
    } as unknown as PrismaService;

    const service = new AdminMerchandisingService(mockPrisma, mockStorageService);
    try {
      await service.update('non-existent', {}, 'admin-user-id');
      assert(false, 'Should throw NotFoundException');
    } catch (err: any) {
      assert(err instanceof NotFoundException, 'Should be NotFoundException');
      assert(err.message === 'ProductTypeCard non-existent not found', 'Message check');
    }

    console.log('✅ 4. AdminMerchandisingService.update NotFoundException: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 4. AdminMerchandisingService.update NotFoundException: FAILED', e.stack);
    failed++;
  }

  // --- TEST 5: AdminMerchandisingService.delete ---
  try {
    const existingCard = {
      id: 'card-delete',
      title: 'Delete Me',
      slug: 'delete-me',
      imageUrl: 'https://images.unsplash.com/photo-1',
      href: '/tienda',
      linkType: 'category',
      sortOrder: 0,
      isActive: true,
      highlight: false,
    };

    let deletedId: string = '';
    let capturedAuditLog: any = null;

    const mockPrisma = {
      productTypeCard: {
        findUnique: async ({ where }: any) => {
          assert(where.id === 'card-delete', 'Should check correct card ID');
          return existingCard;
        },
        delete: async ({ where }: any) => {
          deletedId = where.id;
          return existingCard;
        },
      },
      auditLog: {
        create: async ({ data }: any) => {
          capturedAuditLog = data;
          return { id: 'audit-3', ...data };
        },
      },
    } as unknown as PrismaService;

    const service = new AdminMerchandisingService(mockPrisma, mockStorageService);
    const result = await service.delete('card-delete', 'admin-user-id');

    assert(result.success === true, 'Should return success');
    assert(deletedId === 'card-delete', 'Correct card deleted');

    // Assert audit log
    assert(capturedAuditLog !== null, 'Audit log created');
    assert(capturedAuditLog.action === 'admin_deleted_product_type_card', 'Action check');
    assert(capturedAuditLog.before.title === 'Delete Me', 'Before state logged');
    assert(capturedAuditLog.after === undefined, 'No after state for delete');

    console.log('✅ 5. AdminMerchandisingService.delete: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 5. AdminMerchandisingService.delete: FAILED', e.stack);
    failed++;
  }

  // --- TEST 6: AdminMerchandisingService.uploadImage ---
  try {
    let capturedAuditLog: any = null;

    const mockPrisma = {
      auditLog: {
        create: async ({ data }: any) => {
          capturedAuditLog = data;
          return { id: 'audit-4', ...data };
        },
      },
    } as unknown as PrismaService;

    const service = new AdminMerchandisingService(mockPrisma, mockStorageService);
    const fileMock = {
      originalname: 'test-category.png',
      buffer: Buffer.from('mock-data'),
    } as unknown as Express.Multer.File;

    const result = await service.uploadImage(fileMock, 'admin-user-id');

    assert(result.url === 'https://r2.bombotwerk.com/merchandising/uploads/test-category.png', 'Public URL returned');
    assert(result.key === 'key-test-category.png', 'Storage key returned');

    // Assert audit log
    assert(capturedAuditLog !== null, 'Audit log created');
    assert(capturedAuditLog.action === 'admin_uploaded_product_type_card_image', 'Action check');
    assert(capturedAuditLog.entityType === 'ProductTypeCardImage', 'EntityType check');
    assert(capturedAuditLog.entityId === 'key-test-category.png', 'EntityId matches storage key');
    assert(capturedAuditLog.after.url === result.url, 'Public url logged in metadata');

    console.log('✅ 6. AdminMerchandisingService.uploadImage: PASSED');
    passed++;
  } catch (e: any) {
    console.error('❌ 6. AdminMerchandisingService.uploadImage: FAILED', e.stack);
    failed++;
  }

  console.log('\n==================================================');
  console.log(`📊 Merchandising Test Results: ${passed} passed, ${failed} failed.`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
