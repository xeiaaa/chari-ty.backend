import { IsString, IsArray, IsOptional, MaxLength } from 'class-validator';

export class CompleteMilestoneDto {
  @IsString()
  @MaxLength(1000, {
    message: 'Completion details must be less than 1000 characters',
  })
  completionDetails: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  proofUrls?: string[];
}
