import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function check() {
  const product = await prisma.product.findUnique({
    where: { id: 'cmpw2x56f0002u6yfecy2hu6d' },
    include: {
      images: true,
    }
  });
  console.log('--- PRODUCT INFO ---');
  console.log(product);
  console.log('---------------------');
  process.exit(0);
}

check();
