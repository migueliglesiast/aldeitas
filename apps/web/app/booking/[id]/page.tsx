import { Suspense } from "react";
import BookingStatusClient from "./BookingStatusClient";

export default function BookingStatusPage({ params }: { params: { id: string } }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl rounded border p-6 text-gray-600">
          Loading booking status...
        </div>
      }
    >
      <BookingStatusClient bookingId={params.id} />
    </Suspense>
  );
}
