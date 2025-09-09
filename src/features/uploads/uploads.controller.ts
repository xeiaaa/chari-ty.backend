import {
  Controller,
  Post,
  Body,
  UseGuards,
  Delete,
  Param,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UploadsService, UploadSignature } from './uploads.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateUploadSignatureDto } from './dtos/create-upload-signature.dto';
import { AuthUser } from '../../common/decorators/user.decorator';
import { User as UserEntity } from '../../../generated/prisma';
import { CloudinaryAssetDto } from '../../common/dtos/cloudinary-asset.dto';

@Controller('uploads')
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * Generate upload signature for secure client-side uploads
   * POST /api/v1/uploads/signature
   */
  @Post('signature')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute per user
  createUploadSignature(
    @Body() data: CreateUploadSignatureDto,
  ): UploadSignature {
    return this.uploadsService.generateUploadSignature(data.folder);
  }

  /**
   * Create an upload record in the database
   * POST /api/v1/uploads
   */
  @Post()
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute per user
  async createUpload(
    @Body() asset: CloudinaryAssetDto,
    @AuthUser() user: UserEntity,
  ) {
    return await this.uploadsService.createUpload(asset, user.id);
  }

  /**
   * Delete a Cloudinary resource by its public ID
   * DELETE /api/v1/uploads/cloudinary/:publicId
   */
  @Delete('cloudinary/:publicId')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute per user
  async deleteCloudinaryResource(@Param('publicId') publicId: string) {
    return await this.uploadsService.deleteCloudinaryResource(publicId);
  }
}
