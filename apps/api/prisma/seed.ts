import { existsSync } from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, Category } from "../src/generated/prisma/client.js";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const SEED_USER_ID = "user-1";

const products: ReadonlyArray<{
  id: string;
  name: string;
  priceCents: number;
  category: Category;
}> = [
  { id: "prod-dry-salmon", name: "Salmon Adult Dry Dog Food 3kg", priceCents: 4999, category: Category.dry_food },
  { id: "prod-dry-chicken", name: "Chicken & Rice Dry Cat Food 2kg", priceCents: 3499, category: Category.dry_food },
  { id: "prod-wet-beef", name: "Beef Casserole Wet Dog Food 400g x12", priceCents: 2899, category: Category.wet_food },
  { id: "prod-wet-tuna", name: "Tuna Pate Wet Cat Food 85g x24", priceCents: 3199, category: Category.wet_food },
  { id: "prod-treat-dental", name: "Dental Sticks 7-pack", priceCents: 899, category: Category.treats },
  { id: "prod-treat-jerky", name: "Chicken Jerky Treats 250g", priceCents: 1499, category: Category.treats },
  { id: "prod-toy-rope", name: "Tug Rope Dog Toy", priceCents: 1299, category: Category.toys },
  { id: "prod-health-flea", name: "Flea & Tick Spot-On 3-month", priceCents: 4599, category: Category.healthcare },
];

async function main() {
  await prisma.user.upsert({
    where: { id: SEED_USER_ID },
    update: { name: "Demo User", email: "demo@petcircle.test" },
    create: { id: SEED_USER_ID, name: "Demo User", email: "demo@petcircle.test" },
  });

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: { name: p.name, priceCents: p.priceCents, category: p.category },
      create: p,
    });
  }

  const [users, count] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
  ]);
  console.log(`seed complete: ${users} user(s), ${count} product(s)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
