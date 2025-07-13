import { faker } from '@faker-js/faker/.';
import { AccountType, PrismaClient } from '../../generated/prisma';
import { createDevelopmentToken } from '../test-utils';

const prisma = new PrismaClient();

interface CreateFakeUserOptions {
  accountType?: AccountType;
  setupComplete?: boolean;
}

export const createFakeUser = (options: CreateFakeUserOptions = {}) => {
  const { accountType = AccountType.individual, setupComplete = true } =
    options;

  return prisma.user.create({
    data: {
      id: faker.string.uuid(),
      clerkId: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      avatarUrl: faker.image.url(),
      bio: faker.lorem.paragraph(),
      accountType,
      setupComplete,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
    },
  });
};

export const createFakeUserWithToken = async (
  options: CreateFakeUserOptions = {},
) => {
  const user = await createFakeUser(options);
  const token = createDevelopmentToken(user.clerkId);
  return { user, token };
};
