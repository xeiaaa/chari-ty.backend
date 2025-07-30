import { IsOptional, IsString } from 'class-validator';

export class UpdateMilestoneUploadDto {
  @IsOptional()
  @IsString()
  caption?: string;
}
