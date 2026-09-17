import { prisma } from "@/lib/prisma";
import { getEmailConfig } from "@/lib/email/config";

export async function resolveBookingNotifyEmails(hotelId: string) {
  const config = getEmailConfig();
  if (config?.notifyEmails.length) {
    return config.notifyEmails;
  }

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      owner: { select: { email: true } },
      managers: {
        select: {
          user: { select: { email: true } },
        },
      },
    },
  });

  if (!hotel) return [];

  const emails = new Set<string>();
  if (hotel.owner?.email) emails.add(hotel.owner.email);
  for (const manager of hotel.managers) {
    if (manager.user.email) emails.add(manager.user.email);
  }

  return [...emails];
}
