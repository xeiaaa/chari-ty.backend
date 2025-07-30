import { IsOptional, IsString } from 'class-validator';

export class UpdateGroupUploadDto {
  @IsOptional()
  @IsString()
  caption?: string;
}
