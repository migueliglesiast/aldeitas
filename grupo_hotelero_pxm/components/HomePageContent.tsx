"use client";

import Link from "next/link";
import SearchForm from "@/components/SearchForm";
import HotelGrid from "@/components/HotelGrid";
import { useLocale } from "@/lib/i18n/locale-context";

type Hotel = Parameters<typeof HotelGrid>[0]["hotels"][number];

type Props = {
  hotels: Hotel[];
};

export default function HomePageContent({ hotels }: Props) {
  const { t } = useLocale();

  return (
    <div className="space-y-8">
      <div className="w-full">
        <SearchForm />
      </div>

      <HotelGrid hotels={hotels} />
      <div className="text-sm text-gray-600">
        {t("newHere")}{" "}
        <Link className="text-black underline" href="/sign-up">
          {t("createAccount")}
        </Link>
      </div>
    </div>
  );
}
