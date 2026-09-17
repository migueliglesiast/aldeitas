// Populate English/Spanish description fields for bilingual content.
// Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-description-translations.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LA_ARBOLITA_HOTEL_ES =
  "La Arbolita es un pequeño proyecto hotelero cuidadosamente diseñado en la selva costera de Puerto Escondido, Oaxaca. Concebido como una alternativa tranquila al turismo masivo, combina arquitectura contemporánea, materiales locales y vegetación exuberante. La propiedad ofrece una mezcla de estudios y unidades más grandes alrededor de albercas y espacios compartidos, equilibrando privacidad y comunidad. Totalmente equipado para estancias cortas o largas, La Arbolita enfatiza la sostenibilidad, la caminabilidad y el respeto por su vecindario.";

const FOREST_STUDIO_EN =
  "A little corner among the trees, two minutes from Zicatela beach. This studio is designed for those who come to enjoy Puerto without complications: air conditioning, a private kitchen and bathroom, Starlink internet, and access to two hidden pools on the property. A quiet space to rest, work, or simply go with the rhythm of the place.";

const TREEHOUSE_EN =
  "Our towers are the essence of La Arbolita: a small house raised among the trees, designed to feel Puerto from above. With several levels, ocean views, a private kitchen and bathroom, air conditioning and Starlink, it is a space to wake up with the breeze, work if needed, and end the day watching the sunset from the heights. A quiet corner, just a two-minute walk from Zicatela, where nature and architecture meet.";

async function main() {
  const arbolita = await prisma.hotel.findFirst({ where: { name: "La Arbolita" } });
  if (arbolita) {
    await prisma.hotel.update({
      where: { id: arbolita.id },
      data: {
        descriptionEn: arbolita.description,
        descriptionEs: LA_ARBOLITA_HOTEL_ES,
      },
    });
    console.log("✓ La Arbolita hotel descriptions");
  }

  const forestTitles = [
    "Forest Studio 1",
    "Forest Studio 2",
    "Forest Studio 3",
    "Forest Studio 4",
  ];
  for (const title of forestTitles) {
    const listing = await prisma.listing.findFirst({
      where: { title, hotel: { name: "La Arbolita" } },
    });
    if (!listing?.description) continue;

    await prisma.listing.update({
      where: { id: listing.id },
      data: {
        descriptionEs: listing.description,
        descriptionEn: FOREST_STUDIO_EN,
      },
    });
    console.log(`✓ ${title} descriptions`);
  }

  const treehouseTitles = ["Treehouse 1", "Treehouse 2", "Treehouse 3"];
  for (const title of treehouseTitles) {
    const listing = await prisma.listing.findFirst({
      where: { title, hotel: { name: "La Arbolita" } },
    });
    if (!listing?.description) continue;

    await prisma.listing.update({
      where: { id: listing.id },
      data: {
        descriptionEs: listing.description,
        descriptionEn: TREEHOUSE_EN,
      },
    });
    console.log(`✓ ${title} descriptions`);
  }

  const hotels = await prisma.hotel.findMany({
    where: { name: { not: "La Arbolita" } },
    select: { id: true, name: true, description: true, descriptionEn: true },
  });

  for (const hotel of hotels) {
    if (hotel.descriptionEn) continue;
    await prisma.hotel.update({
      where: { id: hotel.id },
      data: { descriptionEn: hotel.description },
    });
    console.log(`✓ ${hotel.name}: descriptionEn set from primary description`);
  }
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
