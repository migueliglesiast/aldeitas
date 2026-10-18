import { prisma } from "@/lib/prisma";
import { resolveListingAirbnbId } from "@/lib/airbnb-listing-id";
import { fetchAirbnbRatingSummary, fetchAirbnbReviews } from "@/lib/airbnb-reviews";

export type SyncAirbnbReviewsResult = {
  listings: number;
  reviews: number;
  errors: Array<{ listingId: string; error: string }>;
};

/** Pulls the latest public Airbnb reviews and category ratings for every Airbnb-linked room. */
export async function syncAirbnbReviews(options: { hotelId?: string } = {}): Promise<SyncAirbnbReviewsResult> {
  const listings = await prisma.listing.findMany({
    where: options.hotelId ? { hotelId: options.hotelId } : undefined,
    select: { id: true, airbnbId: true, airbnbUrl: true, icalUrl: true, calendarSources: { select: { icalUrl: true } } },
  });
  const result: SyncAirbnbReviewsResult = { listings: 0, reviews: 0, errors: [] };

  for (const listing of listings) {
    const airbnbId = resolveListingAirbnbId(listing);
    if (!airbnbId) continue;
    result.listings += 1;
    try {
      const [reviews, summary] = await Promise.all([
        fetchAirbnbReviews(airbnbId),
        fetchAirbnbRatingSummary(airbnbId),
      ]);
      for (const review of reviews) {
        await prisma.listingReview.upsert({
          where: { listingId_externalId: { listingId: listing.id, externalId: review.externalId } },
          create: { listingId: listing.id, source: "airbnb", ...review },
          update: { rating: review.rating, comments: review.comments, language: review.language, reviewerName: review.reviewerName },
        });
      }
      result.reviews += reviews.length;
      if (summary.overall != null || summary.reviewCount != null) {
        await prisma.listingRatingSummary.upsert({
          where: { listingId: listing.id },
          create: { listingId: listing.id, source: "airbnb", ...summary },
          update: summary,
        });
      }
    } catch (error) {
      result.errors.push({ listingId: listing.id, error: error instanceof Error ? error.message : String(error) });
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return result;
}
