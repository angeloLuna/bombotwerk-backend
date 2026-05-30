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

  @IsBoolean()
  madeToOrderEnabled: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  productionDaysMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  productionDaysMax?: number;
}

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSizeStockDto)
  stocks: CreateSizeStockDto[];
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
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants: CreateVariantDto[];
}
