import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const logos = [
  { name: "La Otra Aldeita", logoImageUrl: "/uploads/hotels/la-otra-aldeita-logo.png" },
  { name: "Nido Escondido", logoImageUrl: "/uploads/hotels/nido-escondido-logo.png" },
];

async function main() {
  for (const { name, logoImageUrl } of logos) {
    const existing = await prisma.hotel.findFirst({ where: { name } });
    if (!existing) {
      console.warn(`Hotel "${name}" not found, skipping`);
      continue;
    }

    const hotel = await prisma.hotel.update({
      where: { id: existing.id },
      data: { logoImageUrl },
      select: { name: true, logoImageUrl: true },
    });
    console.log(`✓ ${hotel.name}: ${hotel.logoImageUrl}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
