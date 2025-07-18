import { IsBoolean, IsNotEmpty } from 'class-validator';

export class PublishFundraiserDto {
  @IsBoolean()
  @IsNotEmpty()
  published: boolean;
}
