import { notFound, redirect } from "next/navigation";
import { getHotelCalendarShareByToken } from "@/lib/calendar-share";

export const dynamic = "force-dynamic";

export default async function LegacySharedHotelCalendarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await getHotelCalendarShareByToken(token);
  if (!share?.slug) notFound();
  redirect(`/${share.slug}/admincalendar`);
}
