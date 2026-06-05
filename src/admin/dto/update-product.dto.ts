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

export class UpdateSizeStockDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  size?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sku?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  colorHex?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  availabilityMode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  madeToOrderMinDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  madeToOrderMaxDays?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateSizeStockDto)
  stocks?: UpdateSizeStockDto[];

  @IsOptional()
  @IsArray()
  images?: any[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateVariantDto)
  variants?: UpdateVariantDto[];
}
