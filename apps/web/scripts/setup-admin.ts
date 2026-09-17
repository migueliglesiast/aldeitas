/**
 * Create an admin user and link them to hotel(s) via HotelManager.
 *
 * Usage:
 *   npm run admin:setup -- --email you@example.com --password "yourpassword" --hotel "La Arbolita"
 *   npm run admin:setup -- --email you@example.com --password "yourpassword" --all --confirm-all
 *
 * If the user already exists, only creates missing HotelManager links.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
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
  const password = readOption("--password");
  const username = readOption("--username") || email?.split("@")[0] || "admin";
  const hotelName = readOption("--hotel");
  const linkAll = readFlag("--all");

  if (!email) {
    throw new Error("Missing --email");
  }
  if (!password || password.length < 6) {
    throw new Error("Missing or invalid --password (min 6 characters)");
  }
  if (!linkAll && !hotelName) {
    throw new Error("Specify --hotel \"Hotel Name\" or --all --confirm-all");
  }
  if (linkAll && !readFlag("--confirm-all")) {
    throw new Error("Linking all hotels requires --confirm-all (use --hotel for a single hotel)");
  }

  let user = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        fullName: readOption("--name") || null,
        nickname: readOption("--nickname") || username,
      },
    });
    console.log(`Created user: ${user.email} (username: ${user.username})`);
  } else {
    console.log(`User already exists: ${user.email} (username: ${user.username})`);
  }

  const hotels = linkAll
    ? await prisma.hotel.findMany({ orderBy: { name: "asc" } })
    : await prisma.hotel.findMany({ where: { name: hotelName! } });

  if (hotels.length === 0) {
    throw new Error(linkAll ? "No hotels found in database" : `Hotel not found: ${hotelName}`);
  }

  for (const hotel of hotels) {
    await linkUserToHotel(prisma, user.id, hotel.id);
    console.log(`Linked ${user.email} → ${hotel.name}`);
  }

  console.log("\nSign in at /admin with your email or username and password.");
  console.log("Admin panel: /admin");
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
