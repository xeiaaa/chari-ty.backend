import { faker } from '@faker-js/faker/.';
import {
  AccountType,
  GroupMemberRole,
  GroupMemberStatus,
  GroupType,
  PrismaClient,
} from '../../generated/prisma';
import { createDevelopmentToken } from '../test-utils';

const prisma = new PrismaClient();

interface CreateFakeUserOptions {
  accountType?: AccountType;
  setupComplete?: boolean;
}

export const createFakeUser = async (options: CreateFakeUserOptions = {}) => {
  const { accountType = AccountType.individual, setupComplete = true } =
    options;

  const user = await prisma.user.create({
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

  if (
    setupComplete &&
    (accountType === AccountType.team || accountType === AccountType.nonprofit)
  ) {
    const group = await prisma.group.create({
      data: {
        name: faker.company.name(),
        type:
          accountType === AccountType.team
            ? GroupType.team
            : GroupType.nonprofit,
        description: faker.company.catchPhrase(),
        avatarUrl: faker.image.avatar(),
        website: faker.internet.url(),
        verified: accountType === AccountType.nonprofit,
        documentsUrls: [],
        ein: accountType === AccountType.nonprofit ? faker.string.uuid() : null,
        members: {
          create: {
            userId: user.id,
            role: GroupMemberRole.owner,
            status: GroupMemberStatus.active,
          },
        },
      },
    });

    return { user, group };
  }

  return { user };
};

export const createFakeUserWithToken = async (
  options: CreateFakeUserOptions = {},
) => {
  const { user, group } = await createFakeUser(options);
  const token = createDevelopmentToken(user.clerkId);
  return { user, group, token };
};
