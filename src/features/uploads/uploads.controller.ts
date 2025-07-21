import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { UploadsService, UploadSignature } from './uploads.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateUploadSignatureDto } from './dtos/create-upload-signature.dto';

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
}
