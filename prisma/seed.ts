import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with Bombo Twerk details...');

  // 1. Clean existing records
  await prisma.payment.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.customer.deleteMany({});
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

  // 3. Create Products, Variants, SizeStocks, and Media
  const productsData = [
    {
      name: 'LATIN PULSE LEGGING',
      slug: 'latin-pulse-legging',
      description: 'High-gloss technical finishes that match every beam of light. Anatomical seams and compressive zones engineered for maximum flexibility during high-intensity sequences.',
      price: 1850.00,
      category: 'LEGGINGS',
      collectionId: c1.id,
      media: [
        { url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?q=80&w=800', altText: 'Latin Pulse Legging front' },
        { url: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?q=80&w=800', altText: 'Latin Pulse Legging back' },
      ],
      variants: [
        {
          sku: 'LP-LEG-BLK',
          color: 'Glossy Black',
          madeToOrderEnabled: true, // If stock drops to 0, item can still be made to order (Crafted in CDMX)
          stocks: [
            { size: 'S', quantity: 5 }, // Ready to Ship (stock > 0)
            { size: 'M', quantity: 0 }, // Crafted in CDMX (stock = 0 & madeToOrderEnabled = true)
            { size: 'L', quantity: 3 }, // Ready to Ship
          ]
        }
      ]
    },
    {
      name: 'NOCTURNAL CROP',
      slug: 'nocturnal-crop',
      description: 'Designed to sculpt and move with you. High-stretch performance fabric with a glossy sheen and a double-strap support system that thrives under the spotlight.',
      price: 980.00,
      category: 'TOPS',
      collectionId: c2.id,
      media: [
        { url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800', altText: 'Nocturnal Crop top' }
      ],
      variants: [
        {
          sku: 'NC-CRP-BLK',
          color: 'Deep Charcoal',
          madeToOrderEnabled: true,
          stocks: [
            { size: 'OS', quantity: 12 } // Ready to Ship
          ]
        }
      ]
    },
    {
      name: 'GOLDEN CORE CHAIN',
      slug: 'golden-core-chain',
      description: 'Complete the look with this heavy-drape reflective body accessory. Captures the warm amber tones of the CDMX night.',
      price: 450.00,
      category: 'ACCESSORIES',
      collectionId: c3.id,
      media: [
        { url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=800', altText: 'Golden Core Chain detail' }
      ],
      variants: [
        {
          sku: 'GCC-CHN-GLD',
          color: 'Gold',
          madeToOrderEnabled: false, // Accessories are stock-only. If stock runs out, it is Unavailable
          stocks: [
            { size: 'OS', quantity: 0 } // Unavailable (stock = 0 & madeToOrderEnabled = false)
          ]
        }
      ]
    },
    {
      name: 'PULSE HEELS',
      slug: 'pulse-heels',
      description: 'Extreme-comfort stiletto heels with a high-gloss finish, designed to stabilize and secure footwork during twerk and pole routines.',
      price: 2400.00,
      category: 'FOOTWEAR',
      collectionId: c1.id,
      media: [
        { url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&w=800', altText: 'Pulse Heels stiletto view' }
      ],
      variants: [
        {
          sku: 'PH-HEL-BLK-23',
          color: 'Patent Black',
          madeToOrderEnabled: false,
          stocks: [
            { size: '23', quantity: 2 },
            { size: '24', quantity: 4 },
            { size: '25', quantity: 0 }, // Unavailable
            { size: '26', quantity: 1 }
          ]
        }
      ]
    },
    {
      name: 'MOTION LEGGINGS',
      slug: 'motion-leggings',
      description: 'Textured mesh paneling legging for ventilation and sheer styling. Created with reinforced panels for high-friction support.',
      price: 1800.00,
      category: 'LEGGINGS',
      collectionId: c2.id,
      media: [
        { url: 'https://images.unsplash.com/photo-1506152983158-b4a74a01c721?q=80&w=800', altText: 'Motion Leggings fit' }
      ],
      variants: [
        {
          sku: 'ML-LEG-PLM',
          color: 'Night Plum',
          madeToOrderEnabled: true,
          stocks: [
            { size: 'S', quantity: 0 }, // Crafted in CDMX
            { size: 'M', quantity: 6 }, // Ready to Ship
            { size: 'L', quantity: 0 }  // Crafted in CDMX
          ]
        }
      ]
    },
    {
      name: 'CLUB GLOW T-SHIRT',
      slug: 'club-glow-tshirt',
      description: 'Relaxed fit drop shoulder tee with reflective branding that reacts with camera flashes.',
      price: 850.00,
      category: 'TOPS',
      collectionId: c3.id,
      media: [
        { url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=800', altText: 'Club Glow T-shirt' }
      ],
      variants: [
        {
          sku: 'CG-TSH-WHT',
          color: 'Reflective Silver',
          madeToOrderEnabled: true,
          stocks: [
            { size: 'M', quantity: 10 },
            { size: 'L', quantity: 10 },
            { size: 'XL', quantity: 0 } // Crafted in CDMX
          ]
        }
      ]
    },
    {
      name: 'SAVAGE GLOW BODY',
      slug: 'savage-glow-body',
      description: 'Ultra-contouring sleeveless performance bodysuit, equipped with custom elastic straps and glossy reflective magenta detailing.',
      price: 1650.00,
      category: 'BODIES',
      collectionId: c1.id,
      media: [
        { url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=800', altText: 'Savage Glow bodysuit' }
      ],
      variants: [
        {
          sku: 'SG-BOD-MAG',
          color: 'Cyber Magenta',
          madeToOrderEnabled: true,
          stocks: [
            { size: 'S', quantity: 4 },
            { size: 'M', quantity: 8 },
            { size: 'L', quantity: 0 } // Crafted in CDMX
          ]
        }
      ]
    },
    {
      name: 'VELVET MOTION SHORTS',
      slug: 'velvet-motion-shorts',
      description: 'Rich velvet-feel styling shorts with side cinch-ties to adjust rise and drape. Ideal for both floorwork and stage performance.',
      price: 780.00,
      category: 'SHORTS',
      collectionId: c3.id,
      media: [
        { url: 'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?q=80&w=800', altText: 'Velvet Motion Shorts' }
      ],
      variants: [
        {
          sku: 'VM-SHO-VLT',
          color: 'Liquid Velvet Purple',
          madeToOrderEnabled: true,
          stocks: [
            { size: 'S', quantity: 0 }, // Crafted in CDMX
            { size: 'M', quantity: 0 }, // Crafted in CDMX
            { size: 'L', quantity: 0 }  // Crafted in CDMX
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
        collectionId: p.collectionId,
        media: {
          create: p.media.map((m, idx) => ({
            url: m.url,
            altText: m.altText,
            sortOrder: idx,
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
          madeToOrderEnabled: v.madeToOrderEnabled,
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

  console.log('Seeded 8 sample products with S/M/L stock combinations and media.');
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
