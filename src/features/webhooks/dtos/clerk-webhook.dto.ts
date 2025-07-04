import { AccountType } from '../../../../generated/prisma';

/**
 * Base webhook event DTO
 */
export interface ClerkWebhookEvent {
  object: string;
  type: string;
  data: ClerkUserData;
  timestamp: number;
}

/**
 * Clerk user data from webhook payload
 */
export interface ClerkUserData {
  id: string;
  object: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  image_url?: string;
  has_image: boolean;
  primary_email_address_id?: string;
  primary_phone_number_id?: string;
  primary_web3_wallet_id?: string;
  password_enabled: boolean;
  two_factor_enabled: boolean;
  totp_enabled: boolean;
  backup_code_enabled: boolean;
  email_addresses: ClerkEmailAddress[];
  phone_numbers: ClerkPhoneNumber[];
  web3_wallets: any[];
  external_accounts: any[];
  saml_accounts: any[];
  public_metadata: Record<string, any>;
  private_metadata: Record<string, any>;
  unsafe_metadata: Record<string, any>;
  external_id?: string;
  last_sign_in_at?: number;
  banned: boolean;
  locked: boolean;
  lockout_expires_in_seconds?: number;
  verification_attempts_remaining?: number;
  created_at: number;
  updated_at: number;
  delete_self_enabled: boolean;
  create_organization_enabled: boolean;
  last_active_at?: number;
}

/**
 * Clerk email address data
 */
export interface ClerkEmailAddress {
  id: string;
  object: string;
  email_address: string;
  verification: {
    status: string;
    strategy: string;
    attempts?: number;
    expire_at?: number;
  };
  linked_to: any[];
  created_at: number;
  updated_at: number;
}

/**
 * Clerk phone number data
 */
export interface ClerkPhoneNumber {
  id: string;
  object: string;
  phone_number: string;
  reserved_for_second_factor: boolean;
  default_second_factor: boolean;
  verification: {
    status: string;
    strategy: string;
    attempts?: number;
    expire_at?: number;
  };
  linked_to: any[];
  backup_codes?: string[];
  created_at: number;
  updated_at: number;
}

/**
 * Mapped user data for our application
 */
export interface MappedUserData {
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  bio?: string;
  accountType: AccountType;
  setupComplete?: boolean;
}
