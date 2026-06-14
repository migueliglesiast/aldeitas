import type { PrismaClient } from "@prisma/client";

type DbClient = Pick<PrismaClient, "hotelManager">;

/** Link a user as manager of exactly one hotel. Idempotent. */
export async function linkUserToHotel(
  db: DbClient,
  userId: string,
  hotelId: string
): Promise<void> {
  await db.hotelManager.upsert({
    where: {
      userId_hotelId: { userId, hotelId },
    },
    create: { userId, hotelId },
    update: {},
  });
}
