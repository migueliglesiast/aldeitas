#!/usr/bin/env node
// Adds the default add-on catalog to a hotel, skipping names it already has.
// Usage: node scripts/seed-hotel-addons.js <hotelId>   (PRISMA_CLIENT_PATH overrides @prisma/client)
const path = require("path");
const catalog = require(path.join(__dirname, "..", "prisma", "addon-catalog.json"));
const { PrismaClient } = require(process.env.PRISMA_CLIENT_PATH || "@prisma/client");

async function main() {
  const hotelId = process.argv[2];
  if (!hotelId) throw new Error("Usage: seed-hotel-addons.js <hotelId>");
  const prisma = new PrismaClient();
  try {
    const existing = new Set(
      (await prisma.hotelAddon.findMany({ where: { hotelId }, select: { name: true } })).map((a) => a.name)
    );
    let created = 0;
    for (const [index, item] of catalog.entries()) {
      if (existing.has(item.name)) continue;
      const options = item.options ? JSON.stringify(item.options) : null;
      await prisma.hotelAddon.create({ data: { ...item, options, hotelId, sortOrder: index } });
      created += 1;
    }
    console.log(`Created ${created} add-ons (${catalog.length - created} already present)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
