import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as crypto from 'crypto';

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
}

@Injectable()
export class UploadsService {
  constructor() {
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

    // Generate signature using Cloudinary's utility
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
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

    // Create the parameters to sign
    const params = {
      timestamp,
      folder,
    };

    // Convert params to string for signing
    const paramString = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key as keyof typeof params]}`)
      .join('&');

    // Generate SHA1 signature
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
}
