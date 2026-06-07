-- CreateTable
CREATE TABLE "ProductTypeCard" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imageAlt" TEXT,
    "badgeLabel" TEXT,
    "badgeType" TEXT,
    "href" TEXT NOT NULL,
    "linkType" TEXT NOT NULL DEFAULT 'category',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTypeCard_pkey" PRIMARY KEY ("id")
);
