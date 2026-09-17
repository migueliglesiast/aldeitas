/**
 * Import room photos from Airbnb into the database.
 *
 * Usage:
 *   npm run images:import
 *   npm run images:import -- --hotel "La Arbolita"
 *   npm run images:import -- --mirror
 *   npm run images:import -- --dry-run
 *
 * Edit scripts/import-room-images.config.ts to add hotels/rooms.
 */
import { importRoomImages } from "../lib/import-room-images";
import { isCloudStorageEnabled } from "../lib/image-storage";
import { ROOM_IMAGE_IMPORT_CONFIG } from "./import-room-images.config";

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const hotelFilter = readOption("--hotel");
  const mirrorToCloud = readFlag("--mirror");
  const dryRun = readFlag("--dry-run");
  const replaceExisting = !readFlag("--append");

  console.log("Room image import");
  console.log(`  Cloud storage: ${isCloudStorageEnabled() ? "Cloudinary" : "local only"}`);
  console.log(`  Mirror to cloud: ${mirrorToCloud}`);
  console.log(`  Dry run: ${dryRun}`);
  if (hotelFilter) console.log(`  Hotel filter: ${hotelFilter}`);

  const results = await importRoomImages({
    configs: ROOM_IMAGE_IMPORT_CONFIG,
    hotelFilter,
    replaceExisting,
    mirrorToCloud,
    dryRun,
  });

  for (const result of results) {
    if (result.skipped) {
      console.warn(`⚠ ${result.hotelName} / ${result.roomTitle}: ${result.skipped}`);
      continue;
    }

    const storage = result.mirrored ? "cloud" : "remote URLs";
    console.log(
      `✓ ${result.hotelName} / ${result.roomTitle}: ${result.imageCount} images (${storage})`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
