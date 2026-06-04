import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private publicBaseUrl: string;

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME || '';
    this.publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || '';

    // Validate environment variables
    if (
      !process.env.R2_ENDPOINT ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY ||
      !this.bucketName ||
      !this.publicBaseUrl
    ) {
      console.warn('WARNING: Cloudflare R2 environment variables are not fully configured.');
    }

    this.s3Client = new S3Client({
      endpoint: process.env.R2_ENDPOINT || undefined,
      region: 'auto',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  }

  generateSafeKey(productIdOrPrefix: string, originalName: string): string {
    const timestamp = Date.now();
    // Normalize filename to be url-safe
    const safeName = originalName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9.]/g, '-')
      .replace(/-+/g, '-');
    if (productIdOrPrefix.startsWith('products/') || productIdOrPrefix.startsWith('collections/')) {
      return `${productIdOrPrefix}/${timestamp}-${safeName}`;
    }
    return `products/${productIdOrPrefix}/${timestamp}-${safeName}`;
  }

  async uploadFile(
    file: Express.Multer.File,
    productId: string
  ): Promise<{
    key: string;
    publicUrl: string;
    originalName: string;
    mimeType: string;
    size: number;
  }> {
    if (
      !process.env.R2_ENDPOINT ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY ||
      !this.bucketName ||
      !this.publicBaseUrl
    ) {
      throw new InternalServerErrorException('Cloudflare R2 credentials or configuration is missing in environment variables.');
    }

    const key = this.generateSafeKey(productId, file.originalname);
    
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );
    } catch (err: any) {
      console.error(`R2 Upload failure for key ${key}:`, err);
      throw new InternalServerErrorException(`Fallo en la subida a Cloudflare R2: ${err.message || 'Error desconocido'}`);
    }

    const publicUrl = `${this.publicBaseUrl}/${key}`;

    return {
      key,
      publicUrl,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  async deleteFile(key: string): Promise<void> {
    if (
      !process.env.R2_ENDPOINT ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY ||
      !this.bucketName
    ) {
      throw new InternalServerErrorException('Cloudflare R2 credentials or configuration is missing in environment variables.');
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
    } catch (err: any) {
      console.error(`R2 Delete failure for key ${key}:`, err);
      throw new InternalServerErrorException(`Fallo al eliminar archivo de Cloudflare R2: ${err.message || 'Error desconocido'}`);
    }
  }
}
