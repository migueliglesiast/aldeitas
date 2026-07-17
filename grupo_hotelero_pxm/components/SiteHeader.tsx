"use client";

import Link from "next/link";
import Image from "next/image";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLocale } from "@/lib/i18n/locale-context";
import { Comfortaa, Dancing_Script } from "next/font/google";

const comfortaa = Comfortaa({ subsets: ["latin"], weight: ["700"] });
const dancingScript = Dancing_Script({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export default function SiteHeader() {
  const { t } = useLocale();

  return (
    <div className="mx-auto max-w-7xl px-4 mt-[4vh] md:mt-[6vh]">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-2">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/aldeitas_logo.png"
            alt="Las Aldeitas logo"
            width={48}
            height={48}
            priority
            className="h-10 w-10 md:h-12 md:w-12 object-contain"
          />
          <span className={`${comfortaa.className} text-3xl md:text-5xl leading-tight font-bold text-[#00a19c]`}>
            Aldeitas
          </span>
        </Link>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <LanguageSwitcher />
        </div>
      </div>
      <p className={`${dancingScript.className} text-2xl md:text-3xl text-gray-600 md:ml-[60px]`}>
        {t("tagline")}
      </p>
    </div>
  );
}
