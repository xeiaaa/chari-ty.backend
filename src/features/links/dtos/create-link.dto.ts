import { IsString, IsOptional, Length } from 'class-validator';

export class CreateLinkDto {
  @IsString()
  @Length(1, 50, { message: 'Alias must be between 1 and 50 characters' })
  alias: string;

  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Note must be at most 500 characters' })
  note?: string;
}
