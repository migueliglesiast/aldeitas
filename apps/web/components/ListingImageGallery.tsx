"use client";

import ImageWithPlaceholder from "@/components/ImageWithPlaceholder";
import { useLocale } from "@/lib/i18n/locale-context";

type Image = {
  id: string;
  url: string;
};

type Props = {
  images: Image[];
  title: string;
};

export default function ListingImageGallery({ images, title }: Props) {
  const { t } = useLocale();

  if (images.length === 0) {
    return (
      <div className="col-span-2 rounded bg-gray-100 p-6 text-center text-gray-500">
        {t("imagesComingSoon")}
      </div>
    );
  }

  return (
    <>
      {images.map((img) => (
        <div key={img.id} className="relative h-64 w-full overflow-hidden rounded">
          <ImageWithPlaceholder
            src={img.url}
            alt={title}
            fill
            sizes="(max-width: 1024px) 100vw, 66vw"
            className="object-cover"
          />
        </div>
      ))}
    </>
  );
}
