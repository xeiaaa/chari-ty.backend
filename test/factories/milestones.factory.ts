import { faker } from '@faker-js/faker';
import { Fundraiser, Milestone, PrismaClient } from '../../generated/prisma';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

export const createFakeMilestone = async (
  fundraiser: Fundraiser,
  override: Partial<Milestone> = {},
): Promise<{ milestone: Milestone }> => {
  const milestone = await prisma.milestone.create({
    data: {
      id: faker.string.uuid(),
      fundraiserId: fundraiser.id,
      stepNumber: faker.number.int({ min: 1, max: 10 }),
      amount: new Decimal(
        faker.number.float({ min: 100, max: 100000, fractionDigits: 2 }),
      ),
      title: faker.lorem.sentence(3),
      purpose: faker.lorem.sentence(),
      createdAt: faker.date.past(),
      ...override,
    },
  });

  return { milestone };
};

export const buildFakeMilestone = (
  override: Partial<any> = {},
): {
  amount: number;
  title: string;
  purpose: string;
} => {
  return {
    amount: faker.number.float({ min: 100, max: 1000, fractionDigits: 0 }),
    title: faker.lorem.sentence(3),
    purpose: faker.lorem.sentence(),
    ...override,
  };
};
