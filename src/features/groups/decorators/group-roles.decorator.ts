import { SetMetadata } from '@nestjs/common';

export const GROUP_ROLES_KEY = 'groupRoles';

export type GroupRolesMeta = {
  roles: string[];
  message?: string;
};

export const GroupRoles = (roles: string[], message?: string) =>
  SetMetadata(GROUP_ROLES_KEY, {
    roles,
    message,
  } satisfies GroupRolesMeta);
