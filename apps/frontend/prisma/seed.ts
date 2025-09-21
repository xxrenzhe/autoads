import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.createMany({
    data: [
      {
        id: 'free',
        name: 'Free',
        description: 'Basic features for getting started.',
        price: 0,
        tokenCredit: 1000,
      },
      {
        id: 'pro',
        name: 'Pro',
        description: 'Advanced features for professionals.',
        price: 49,
        tokenCredit: 10000,
      },
      {
        id: 'max',
        name: 'Max',
        description: 'All features for power users.',
        price: 99,
        tokenCredit: 100000,
      },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
