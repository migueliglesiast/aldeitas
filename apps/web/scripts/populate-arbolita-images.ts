// Populate La Arbolita room images from Airbnb listing pages.
// Prefer: npm run images:import -- --hotel "La Arbolita" --mirror

import { importRoomImages } from "../lib/import-room-images";
import { ROOM_IMAGE_IMPORT_CONFIG } from "./import-room-images.config";

async function main() {
  const results = await importRoomImages({
    configs: ROOM_IMAGE_IMPORT_CONFIG,
    hotelFilter: "La Arbolita",
    replaceExisting: true,
    mirrorToCloud: process.argv.includes("--mirror"),
  });

  for (const result of results) {
    if (result.skipped) {
      console.warn(`⚠ ${result.roomTitle}: ${result.skipped}`);
    } else {
      console.log(`✓ ${result.roomTitle}: ${result.imageCount} images`);
    }
  }
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
