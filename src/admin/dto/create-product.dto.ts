import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSizeStockDto {
  @IsString()
  @IsNotEmpty()
  size: string; // S | M | L | OS

  @IsInt()
  @Min(0)
  quantity: number;
}

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  colorHex?: string;

  @IsString()
  @IsNotEmpty()
  availabilityMode: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  madeToOrderMinDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  madeToOrderMaxDays?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSizeStockDto)
  stocks: CreateSizeStockDto[];

  @IsOptional()
  @IsArray()
  images?: any[];
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  collectionId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isNewArrival?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  compareAtPrice?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants: CreateVariantDto[];

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsString()
  seoKeywords?: string;

  @IsOptional()
  @IsString()
  canonicalSlug?: string;
}
