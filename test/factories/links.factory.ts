import { faker } from '@faker-js/faker';
import {
  Fundraiser,
  FundraiserLink,
  PrismaClient,
} from '../../generated/prisma';

const prisma = new PrismaClient();

export const createFakeLink = async (
  fundraiser: Fundraiser,
  override: Partial<FundraiserLink> = {},
): Promise<{ link: FundraiserLink }> => {
  const link = await prisma.fundraiserLink.create({
    data: {
      id: faker.string.uuid(),
      fundraiserId: fundraiser.id,
      alias: faker.internet.domainWord(),
      note: faker.lorem.sentence(),
      createdAt: faker.date.past(),
      ...override,
    },
  });

  return { link };
};

export const buildFakeLink = (
  override: Partial<any> = {},
): {
  alias: string;
  note?: string;
} => {
  return {
    alias: faker.internet.domainWord(),
    note: faker.lorem.sentence(),
    ...override,
  };
};
