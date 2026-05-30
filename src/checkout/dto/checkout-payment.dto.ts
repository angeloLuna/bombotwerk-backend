import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

class CartItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  variantId: string;

  @IsString()
  @IsNotEmpty()
  size: string;

  @IsNumber()
  quantity: number;
}

class ShippingDetailsDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  zip: string;

  @IsString()
  @IsNotEmpty()
  method: 'express' | 'crafted';
}

export class CheckoutPaymentDto {
  @IsNotEmpty()
  formData: any; // Dynamic from Mercado Pago SDK

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  cartItems: CartItemDto[];

  @ValidateNested()
  @Type(() => ShippingDetailsDto)
  shippingDetails: ShippingDetailsDto;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  orderId?: string;
}
