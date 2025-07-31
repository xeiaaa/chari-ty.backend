import { SetMetadata } from '@nestjs/common';

export const FUNDRAISER_ROLES_KEY = 'fundraiserRoles';

export type FundraiserRolesMeta = {
  roles: string[];
  message?: string;
};

export const FundraiserRoles = (roles: string[], message?: string) =>
  SetMetadata(FUNDRAISER_ROLES_KEY, {
    roles,
    message,
  } satisfies FundraiserRolesMeta);
