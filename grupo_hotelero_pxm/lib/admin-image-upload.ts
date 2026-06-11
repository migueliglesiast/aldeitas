export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export type AdminImage = {
  id: string;
  url: string;
  position: number;
};

export function sortImagesByPosition(images: AdminImage[]) {
  return [...images].sort((a, b) => a.position - b.position);
}

export function reorderImages(
  images: AdminImage[],
  draggedId: string,
  targetId: string
) {
  const sorted = sortImagesByPosition(images);
  const fromIndex = sorted.findIndex((image) => image.id === draggedId);
  const toIndex = sorted.findIndex((image) => image.id === targetId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return sorted;
  }

  const next = [...sorted];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  return next.map((image, index) => ({ ...image, position: index }));
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return `"${file.name}" is not an image file`;
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `"${file.name}" must be less than 10MB`;
  }
  return null;
}

export function partitionImageFiles(files: File[]) {
  const valid: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const error = validateImageFile(file);
    if (error) {
      errors.push(error);
    } else {
      valid.push(file);
    }
  }

  return { valid, errors };
}
