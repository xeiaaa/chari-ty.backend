import { Controller, Post, Body, UseGuards } from '@nestjs/common';
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
  async createUpload(
    @Body() asset: CloudinaryAssetDto,
    @AuthUser() user: UserEntity,
  ) {
    return await this.uploadsService.createUpload(asset, user.id);
  }
}
