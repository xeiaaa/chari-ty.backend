import {
  IsString,
  IsOptional,
  IsEnum,
  IsEmail,
  IsUrl,
  IsArray,
  ValidateNested,
  MinLength,
  MaxLength,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccountType } from '../../../../generated/prisma';

/**
 * Team member data for team onboarding
 */
export class TeamMemberDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

/**
 * Unified onboarding DTO that handles all account types
 */
export class OnboardingDto {
  @IsEnum(AccountType)
  @IsNotEmpty()
  accountType: AccountType;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  // Team-specific fields
  @ValidateIf((o) => o.accountType === 'team')
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  teamName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  mission?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  website?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamMemberDto)
  @IsOptional()
  members?: TeamMemberDto[];

  // Nonprofit-specific fields
  @ValidateIf((o) => o.accountType === 'nonprofit')
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  organizationName?: string;

  @ValidateIf((o) => o.accountType === 'nonprofit')
  @IsString()
  @IsNotEmpty()
  @MinLength(9)
  @MaxLength(10)
  ein?: string;

  @IsArray()
  @IsString({ each: true })
  @IsUrl({}, { each: true })
  @IsOptional()
  documentsUrls?: string[];
}

// Legacy exports for backward compatibility
export class BaseOnboardingDto {
  @IsEnum(AccountType)
  @IsNotEmpty()
  accountType: AccountType;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

export class IndividualOnboardingDto extends BaseOnboardingDto {
  @IsEnum(AccountType)
  @IsNotEmpty()
  accountType: 'individual';
}

export class TeamOnboardingDto extends BaseOnboardingDto {
  @IsEnum(AccountType)
  @IsNotEmpty()
  accountType: 'team';

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  teamName: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  mission?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  website?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamMemberDto)
  @IsOptional()
  members?: TeamMemberDto[];
}

export class NonprofitOnboardingDto extends BaseOnboardingDto {
  @IsEnum(AccountType)
  @IsNotEmpty()
  accountType: 'nonprofit';

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  organizationName: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  mission?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  website?: string;

  @ValidateIf((o) => o.accountType === 'nonprofit')
  @IsString()
  @IsNotEmpty()
  @MinLength(9)
  @MaxLength(10)
  ein: string;

  @IsArray()
  @IsString({ each: true })
  @IsUrl({}, { each: true })
  @IsOptional()
  documentsUrls?: string[];
}
