import { type AdminImage } from "@/lib/admin-image-upload";

export type ImageCopyDestination = {
  type: "hotel" | "room";
  id: string;
  label: string;
};

export function buildCopyDestinations(
  hotelId: string,
  hotelName: string,
  rooms: Array<{ id: string; title: string }>,
  sourceType: "hotel" | "room",
  sourceId: string
): ImageCopyDestination[] {
  const destinations: ImageCopyDestination[] = [
    { type: "hotel", id: hotelId, label: `${hotelName} (Hotel images)` },
    ...rooms.map((room, index) => ({
      type: "room" as const,
      id: room.id,
      label: room.title || `Room ${index + 1}`,
    })),
  ];

  return destinations.filter(
    (destination) => !(destination.type === sourceType && destination.id === sourceId)
  );
}

export function destinationKey(destination: ImageCopyDestination) {
  return `${destination.type}:${destination.id}`;
}

export async function downloadAdminImages(images: AdminImage[]) {
  for (const [index, image] of images.entries()) {
    const response = await fetch(image.url);
    if (!response.ok) {
      throw new Error(`Failed to download ${image.url}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = image.url.split("/").pop() || `image-${index + 1}.jpg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);

    if (index < images.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}
