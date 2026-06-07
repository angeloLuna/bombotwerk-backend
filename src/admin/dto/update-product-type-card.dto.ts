import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class UpdateProductTypeCardDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imageAlt?: string;

  @IsOptional()
  @IsString()
  badgeLabel?: string;

  @IsOptional()
  @IsString()
  badgeType?: string;

  @IsOptional()
  @IsString()
  href?: string;

  @IsOptional()
  @IsString()
  linkType?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  highlight?: boolean;
}
