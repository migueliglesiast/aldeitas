/**
 * Link an existing user to hotel(s). No password needed.
 *
 * Usage:
 *   npm run admin:link -- --email you@example.com --hotel "La Arbolita"
 *   npm run admin:link -- --email you@example.com --all
 */
import { PrismaClient } from "@prisma/client";
import { linkUserToHotel } from "../lib/hotel-manager-access";

const prisma = new PrismaClient();

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const email = readOption("--email");
  const hotelName = readOption("--hotel");
  const linkAll = readFlag("--all");

  if (!email) throw new Error("Missing --email");
  if (!linkAll && !hotelName) throw new Error("Specify --hotel \"Hotel Name\" or --all --confirm-all");
  if (linkAll && !readFlag("--confirm-all")) {
    throw new Error("Linking all hotels requires --confirm-all (use --hotel for a single hotel)");
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    throw new Error(`No user with email ${email}. Sign up first or run admin:setup with --password.`);
  }

  const hotels = linkAll
    ? await prisma.hotel.findMany({ orderBy: { name: "asc" } })
    : await prisma.hotel.findMany({ where: { name: hotelName! } });

  if (hotels.length === 0) {
    throw new Error(linkAll ? "No hotels found" : `Hotel not found: ${hotelName}`);
  }

  for (const hotel of hotels) {
    await linkUserToHotel(prisma, user.id, hotel.id);
    console.log(`Linked ${user.email} → ${hotel.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
