import { AccountType } from '../generated/prisma';

export const createMockUser = (id: string) => {
  return {
    id,
    clerkId: `test-clerk-${id}-id`,
    email: `user${id}@example.com`,
    firstName: 'John',
    lastName: 'Doe',
    avatarUrl: 'https://example.com/avatar1.jpg',
    bio: 'First test user bio',
    accountType: AccountType.individual,
    setupComplete: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    groupMemberships: [],
  };
};

export const MOCK_USER_1 = createMockUser('1');
export const MOCK_USER_2 = createMockUser('2');
export const MOCK_USER_3 = createMockUser('3');
export const MOCK_USER_4 = createMockUser('4');
export const MOCK_USER_5 = createMockUser('5');
