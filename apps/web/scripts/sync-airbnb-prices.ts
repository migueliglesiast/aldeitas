import {
  listHotelsForAirbnbPriceSync,
  syncHotelAirbnbPrices,
  syncNextHotelAirbnbPrices,
} from "../lib/sync-airbnb-prices";

async function main() {
  const arg = process.argv[2];

  if (!arg || arg === "next") {
    console.log("Syncing next (stalest) Airbnb-linked hotel…");
    const result = await syncNextHotelAirbnbPrices({
      months: 3,
      sampleEvery: 3,
    });
    console.log(result.message);
    if (result.synced) {
      for (const room of result.synced.rooms) {
        console.log(
          JSON.stringify({
            title: room.title,
            days: room.updatedDays,
            basePesos:
              room.basePriceCents != null
                ? Math.round(room.basePriceCents / 100)
                : null,
            errors: room.errors,
            skip: room.skippedReason,
          })
        );
      }
    }
    return;
  }

  if (arg === "list") {
    const hotels = await listHotelsForAirbnbPriceSync();
    for (const hotel of hotels) {
      console.log(
        JSON.stringify({
          id: hotel.id,
          name: hotel.name,
          linkedRooms: hotel.linkedRooms,
          lastSyncedAt: hotel.lastSyncedAt,
        })
      );
    }
    return;
  }

  console.log(`Syncing Airbnb prices for hotel ${arg}…`);
  const result = await syncHotelAirbnbPrices(arg, {
    months: 3,
    sampleEvery: 3,
  });

  for (const room of result.rooms) {
    console.log(
      JSON.stringify({
        title: room.title,
        airbnbId: room.airbnbListingId,
        days: room.updatedDays,
        basePesos:
          room.basePriceCents != null
            ? Math.round(room.basePriceCents / 100)
            : null,
        samples: room.samples,
        errors: room.errors,
        skip: room.skippedReason,
      })
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
