import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with Bombo Twerk details...');

  // 1. Clean existing records
  await prisma.payment.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.productMedia.deleteMany({});
  await prisma.sizeStock.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.collection.deleteMany({});

  console.log('Tables cleared.');

  // 2. Create Collections
  const c1 = await prisma.collection.create({
    data: {
      name: 'LATIN PULSE',
      slug: 'latin-pulse',
      tagline: 'RHYTHM OF THE NIGHT',
      description: 'Curated performance pieces featuring high-gloss technical finishes that catch every beam of light, designed for high-intensity movement and night energy.',
      bgImage: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?q=80&w=1000',
    },
  });

  const c2 = await prisma.collection.create({
    data: {
      name: 'NOCTURNAL PULSE',
      slug: 'nocturnal-pulse',
      tagline: 'SEDUCTIVE SILHOUETTES',
      description: 'Seductive silhouettes engineered for high-intensity movement and neon-lit floors. A dark editorial statement that blends studio luxury with dancehall energy.',
      bgImage: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1000',
    },
  });

  const c3 = await prisma.collection.create({
    data: {
      name: 'VELVET MOTION',
      slug: 'velvet-motion',
      tagline: 'LIQUID TEXTURES',
      description: 'Liquid textures that capture the amber glow of the midnight pulse. Soft to the touch, heavy on performance, crafting an unforgettable skin-to-fabric sensation.',
      bgImage: 'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?q=80&w=1000',
    },
  });

  console.log('Collections created successfully.');

  // 3. Create Products, Variants, SizeStocks, and Images
  const productsData = [
    {
      name: 'LATIN PULSE LEGGING',
      slug: 'latin-pulse-legging',
      description: 'High-gloss technical finishes that match every beam of light. Anatomical seams and compressive zones engineered for maximum flexibility during high-intensity sequences.',
      price: 1850.00,
      category: 'cacheteros',
      isFeatured: true,
      collectionId: c1.id,
      images: [
        { url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?q=80&w=800', alt: 'Latin Pulse Legging Editorial', type: 'editorial', isCover: true, sortOrder: 0 },
        { url: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?q=80&w=800', alt: 'Latin Pulse Legging Catalog', type: 'catalog', isCover: false, sortOrder: 1 },
        { url: 'https://images.unsplash.com/photo-1506152983158-b4a74a01c721?q=80&w=800', alt: 'Latin Pulse Legging Detail', type: 'detail', isCover: false, sortOrder: 2 },
      ],
      variants: [
        {
          sku: 'LP-LEG-BLK',
          color: 'Glossy Black',
          availabilityMode: 'stock_and_made_to_order',
          madeToOrderMinDays: 7,
          madeToOrderMaxDays: 9,
          stocks: [
            { size: 'XCH', quantity: 0 },
            { size: 'CH', quantity: 5 },
            { size: 'M', quantity: 0 },
            { size: 'G', quantity: 3 },
            { size: 'XG', quantity: 0 },
          ]
        }
      ]
    },
    {
      name: 'NOCTURNAL CROP',
      slug: 'nocturnal-crop',
      description: 'Designed to sculpt and move with you. High-stretch performance fabric with a glossy sheen and a double-strap support system that thrives under the spotlight.',
      price: 980.00,
      category: 'arneses',
      isFeatured: true,
      collectionId: c2.id,
      images: [
        { url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800', alt: 'Nocturnal Crop Editorial', type: 'editorial', isCover: true, sortOrder: 0 },
        { url: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?q=80&w=800', alt: 'Nocturnal Crop Catalog', type: 'catalog', isCover: false, sortOrder: 1 },
      ],
      variants: [
        {
          sku: 'NC-CRP-BLK',
          color: 'Deep Charcoal',
          availabilityMode: 'stock_and_made_to_order',
          madeToOrderMinDays: 7,
          madeToOrderMaxDays: 9,
          stocks: [
            { size: 'XCH', quantity: 0 },
            { size: 'CH', quantity: 4 },
            { size: 'M', quantity: 4 },
            { size: 'G', quantity: 4 },
            { size: 'XG', quantity: 0 },
          ]
        }
      ]
    },
    {
      name: 'GOLDEN CORE CHAIN',
      slug: 'golden-core-chain',
      description: 'Complete the look with this heavy-drape reflective body accessory. Captures the warm amber tones of the CDMX night.',
      price: 450.00,
      compareAtPrice: 600.00,
      category: 'arneses',
      collectionId: c3.id,
      images: [
        { url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=800', alt: 'Golden Core Chain Catalog', type: 'catalog', isCover: true, sortOrder: 0 },
      ],
      variants: [
        {
          sku: 'GCC-CHN-GLD',
          color: 'Gold',
          availabilityMode: 'stock_only',
          stocks: [
            { size: 'XCH', quantity: 0 },
            { size: 'CH', quantity: 1 },
            { size: 'M', quantity: 1 },
            { size: 'G', quantity: 1 },
            { size: 'XG', quantity: 0 },
          ]
        }
      ]
    },
    {
      name: 'PULSE HEELS',
      slug: 'pulse-heels',
      description: 'Extreme-comfort stiletto heels with a high-gloss finish, designed to stabilize and secure footwork during twerk and pole routines.',
      price: 2400.00,
      compareAtPrice: 2900.00,
      category: 'arneses',
      collectionId: c1.id,
      images: [
        { url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&w=800', alt: 'Pulse Heels Catalog', type: 'catalog', isCover: true, sortOrder: 0 },
      ],
      variants: [
        {
          sku: 'PH-HEL-BLK-23',
          color: 'Patent Black',
          availabilityMode: 'stock_only',
          stocks: [
            { size: 'XCH', quantity: 2 },
            { size: 'CH', quantity: 4 },
            { size: 'M', quantity: 0 },
            { size: 'G', quantity: 1 },
            { size: 'XG', quantity: 0 },
          ]
        }
      ]
    },
    {
      name: 'MOTION LEGGINGS',
      slug: 'motion-leggings',
      description: 'Textured mesh paneling legging for ventilation and sheer styling. Created with reinforced panels for high-friction support.',
      price: 1800.00,
      category: 'cacheteros',
      collectionId: c2.id,
      images: [
        { url: 'https://images.unsplash.com/photo-1506152983158-b4a74a01c721?q=80&w=800', alt: 'Motion Leggings Catalog', type: 'catalog', isCover: true, sortOrder: 0 },
      ],
      variants: [
        {
          sku: 'ML-LEG-PLM',
          color: 'Night Plum',
          availabilityMode: 'stock_and_made_to_order',
          madeToOrderMinDays: 7,
          madeToOrderMaxDays: 9,
          stocks: [
            { size: 'XCH', quantity: 0 },
            { size: 'CH', quantity: 0 },
            { size: 'M', quantity: 6 },
            { size: 'G', quantity: 0 },
            { size: 'XG', quantity: 0 },
          ]
        }
      ]
    },
    {
      name: 'CLUB GLOW T-SHIRT',
      slug: 'club-glow-tshirt',
      description: 'Relaxed fit drop shoulder tee with reflective branding that reacts with camera flashes.',
      price: 850.00,
      compareAtPrice: 1200.00,
      category: 'conjuntos',
      collectionId: c3.id,
      images: [
        { url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=800', alt: 'Club Glow T-shirt Catalog', type: 'catalog', isCover: true, sortOrder: 0 },
      ],
      variants: [
        {
          sku: 'CG-TSH-WHT',
          color: 'Reflective Silver',
          availabilityMode: 'stock_and_made_to_order',
          madeToOrderMinDays: 7,
          madeToOrderMaxDays: 9,
          stocks: [
            { size: 'XCH', quantity: 0 },
            { size: 'CH', quantity: 0 },
            { size: 'M', quantity: 2 },
            { size: 'G', quantity: 1 },
            { size: 'XG', quantity: 0 },
          ]
        }
      ]
    },
    {
      name: 'SAVAGE GLOW BODY',
      slug: 'savage-glow-body',
      description: 'Ultra-contouring sleeveless performance bodysuit, equipped with custom elastic straps and glossy reflective magenta detailing.',
      price: 1650.00,
      category: 'bodys',
      isFeatured: true,
      collectionId: c1.id,
      images: [
        { url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=800', alt: 'Savage Glow Bodysuit Editorial', type: 'editorial', isCover: true, sortOrder: 0 },
      ],
      variants: [
        {
          sku: 'SG-BOD-MAG',
          color: 'Cyber Magenta',
          availabilityMode: 'stock_and_made_to_order',
          madeToOrderMinDays: 7,
          madeToOrderMaxDays: 9,
          stocks: [
            { size: 'XCH', quantity: 0 },
            { size: 'CH', quantity: 4 },
            { size: 'M', quantity: 8 },
            { size: 'G', quantity: 0 },
            { size: 'XG', quantity: 0 },
          ]
        }
      ]
    },
    {
      name: 'VELVET MOTION SHORTS',
      slug: 'velvet-motion-shorts',
      description: 'Rich velvet-feel styling shorts with side cinch-ties to adjust rise and drape. Ideal for both floorwork and stage performance.',
      price: 780.00,
      category: 'faldas-flecos',
      collectionId: c3.id,
      images: [
        { url: 'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?q=80&w=800', alt: 'Velvet Motion Shorts Catalog', type: 'catalog', isCover: true, sortOrder: 0 },
      ],
      variants: [
        {
          sku: 'VM-SHO-VLT',
          color: 'Liquid Velvet Purple',
          availabilityMode: 'made_to_order_only',
          madeToOrderMinDays: 7,
          madeToOrderMaxDays: 9,
          stocks: [
            { size: 'XCH', quantity: 0 },
            { size: 'CH', quantity: 0 },
            { size: 'M', quantity: 0 },
            { size: 'G', quantity: 0 },
            { size: 'XG', quantity: 0 },
          ]
        }
      ]
    }
  ];

  for (const p of productsData) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        category: p.category,
        isFeatured: p.isFeatured ?? false,
        compareAtPrice: p.compareAtPrice ?? null,
        collectionId: p.collectionId,
        images: {
          create: p.images.map((img) => ({
            url: img.url,
            alt: img.alt,
            type: img.type as any,
            isCover: img.isCover,
            sortOrder: img.sortOrder,
          })),
        },
      },
    });

    for (const v of p.variants) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: v.sku,
          color: v.color,
          availabilityMode: v.availabilityMode,
          madeToOrderMinDays: (v as any).madeToOrderMinDays ?? 7,
          madeToOrderMaxDays: (v as any).madeToOrderMaxDays ?? 9,
          stocks: {
            create: v.stocks.map((s) => ({
              size: s.size,
              quantity: s.quantity,
            })),
          },
        },
      });
    }
  }

  console.log('Seeded 8 sample products with S/M/L stock combinations and multiple images.');
  console.log('Database seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
