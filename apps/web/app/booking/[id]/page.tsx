import { Suspense } from "react";
import BookingStatusClient from "./BookingStatusClient";

export default async function BookingStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl rounded border p-6 text-gray-600">
          Loading booking status...
        </div>
      }
    >
      <BookingStatusClient bookingId={id} />
    </Suspense>
  );
}
