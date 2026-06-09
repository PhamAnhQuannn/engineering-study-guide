import "dotenv/config";
import { createPrismaClient } from "../lib/prisma";
import { TOPICS } from "../lib/taxonomy";

const prisma = createPrismaClient();

async function main() {
  for (const t of TOPICS) {
    await prisma.topic.upsert({
      where: { slug: t.slug },
      update: {
        tier: t.tier,
        name: t.name,
        description: t.description,
        difficulty: t.difficulty,
        supportedTypes: JSON.stringify(t.supportedTypes),
      },
      create: {
        tier: t.tier,
        name: t.name,
        slug: t.slug,
        description: t.description,
        difficulty: t.difficulty,
        supportedTypes: JSON.stringify(t.supportedTypes),
      },
    });
  }
  const count = await prisma.topic.count();
  console.log(`Seeded ${TOPICS.length} topics. Total in DB: ${count}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
