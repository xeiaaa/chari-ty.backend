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
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccountType } from '../../../../generated/prisma';

/**
 * Allowed roles for team members (excluding 'owner')
 */
export enum TeamMemberRole {
  viewer = 'viewer',
  editor = 'editor',
  admin = 'admin',
}

/**
 * Custom validator to disallow 'owner' as a role
 */
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isNotOwnerRole', async: false })
export class IsNotOwnerRole implements ValidatorConstraintInterface {
  validate(role: any): boolean {
    return role !== 'owner';
  }
  defaultMessage(): string {
    return 'Role cannot be "owner"';
  }
}

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

  @IsEnum(TeamMemberRole)
  @Validate(IsNotOwnerRole)
  role: TeamMemberRole;
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

  // Name field - required for team and nonprofit, not applicable for individual
  @ValidateIf((o) => o.accountType === 'team' || o.accountType === 'nonprofit')
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

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
  @MinLength(9)
  @MaxLength(10)
  ein?: string;

  @IsArray()
  @IsString({ each: true })
  @IsUrl({}, { each: true })
  @IsOptional()
  documentsUrls?: string[];
}
