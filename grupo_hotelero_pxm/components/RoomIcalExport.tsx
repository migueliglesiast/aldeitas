"use client";

import { useState } from "react";

type Props = {
  exportUrl: string;
};

export default function RoomIcalExport({ exportUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const isLocalhost =
    exportUrl.includes("localhost") || exportUrl.includes("127.0.0.1");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-medium text-gray-800">Block dates on Airbnb</h3>
        <p className="text-sm text-gray-500 mt-1">
          Paste this link in Airbnb under{" "}
          <span className="font-medium text-gray-700">
            Availability → Connect calendars → Import calendar
          </span>
          . It ends in <span className="font-mono text-xs">.ics</span> as Airbnb
          requires. The URL must be public (your live domain or ngrok — not localhost).
        </p>
      </div>

      {isLocalhost ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Airbnb cannot use this URL yet</p>
          <p className="mt-1 text-amber-900">
            <span className="font-mono">localhost</span> only works on your computer.
            Airbnb&apos;s servers must reach your site over the internet. Use ngrok while
            developing, or your live domain in production — then paste that public{" "}
            <span className="font-mono">.ics</span> link in Airbnb.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          readOnly
          value={exportUrl}
          className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          onFocus={(event) => event.target.select()}
        />
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
        >
          {copied ? "Copied!" : "Copy URL"}
        </button>
      </div>
    </div>
  );
}
