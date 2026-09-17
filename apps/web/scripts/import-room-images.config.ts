import type { HotelImportConfig } from "../lib/import-room-images";

/**
 * Add Airbnb listing URLs per room title.
 * Run: npm run images:import
 *      npm run images:import -- --hotel "La Arbolita"
 *      npm run images:import -- --mirror
 */
export const ROOM_IMAGE_IMPORT_CONFIG: HotelImportConfig[] = [
  {
    hotelName: "La Arbolita",
    rooms: [
      { roomTitle: "Forest Studio 1", airbnbUrl: "https://www.airbnb.com/h/arbolita4" },
      { roomTitle: "Forest Studio 2", airbnbUrl: "https://www.airbnb.com/h/arbolita4" },
      { roomTitle: "Forest Studio 3", airbnbUrl: "https://www.airbnb.com/h/arbolita4" },
      { roomTitle: "Forest Studio 4", airbnbUrl: "https://www.airbnb.com/h/arbolita4" },
      { roomTitle: "Treehouse 1", airbnbUrl: "https://www.airbnb.com/h/arbolita6" },
      { roomTitle: "Treehouse 2", airbnbUrl: "https://www.airbnb.com/h/arbolita6" },
      { roomTitle: "Treehouse 3", airbnbUrl: "https://www.airbnb.com/h/arbolita7" },
    ],
  },
  // Add more hotels below. Room titles must match listing titles in the database.
  // {
  //   hotelName: "Casa Yahua",
  //   rooms: [
  //     { roomTitle: "Room 1", airbnbUrl: "https://www.airbnb.com/h/your-listing" },
  //   ],
  // },
];
