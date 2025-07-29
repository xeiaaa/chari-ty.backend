import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as crypto from 'crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CloudinaryAssetDto } from '../../common/dtos/cloudinary-asset.dto';

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
}

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Generate upload signature for secure client-side uploads
   * This allows the frontend to upload directly to Cloudinary without exposing the API secret
   */
  generateUploadSignature(folder: string = 'uploads'): UploadSignature {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const eager = 'q_auto,f_auto';

    // Generate signature using Cloudinary's utility
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder, eager },
      process.env.CLOUDINARY_API_SECRET!,
    );

    return {
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY!,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    };
  }

  /**
   * Alternative method using crypto for signature generation
   * This is more explicit and gives you full control over the signature process
   */
  generateUploadSignatureWithCrypto(
    folder: string = 'uploads',
  ): UploadSignature {
    const timestamp = Math.round(new Date().getTime() / 1000);

    const params = {
      eager: 'q_auto,f_auto',
      timestamp,
      folder,
    };

    const paramString = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key as keyof typeof params]}`)
      .join('&');

    const signature = crypto
      .createHash('sha1')
      .update(paramString + process.env.CLOUDINARY_API_SECRET!)
      .digest('hex');

    return {
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY!,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    };
  }

  /**
   * Create an upload record in the database
   */
  async createUpload(asset: CloudinaryAssetDto, uploadedById: string) {
    return await this.prisma.upload.create({
      data: {
        cloudinaryAssetId: asset.cloudinaryAssetId,
        publicId: asset.publicId,
        url: asset.url,
        eagerUrl: asset.eagerUrl,
        format: asset.format,
        resourceType: asset.resourceType,
        size: asset.size,
        pages: asset.pages,
        originalFilename: asset.originalFilename,
        uploadedAt: new Date(asset.uploadedAt),
        uploadedById,
      },
    });
  }
}
