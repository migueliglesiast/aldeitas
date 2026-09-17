"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NicknameEditor() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setMessage("Please enter a nickname");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          fullName: null,
          phoneNumber: null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save nickname");
      }

      // Refresh the page to show the updated nickname
      router.refresh();
    } catch (error: any) {
      setMessage(error.message || "Failed to save nickname");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <form onSubmit={handleSave} className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Set your display name (nickname)
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your nickname"
            className="flex-1 rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-[#00a19c] px-6 py-2 text-white hover:bg-[#008a86] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
        {message && (
          <div
            className={`text-sm ${
              message.includes("Failed") ? "text-red-600" : "text-green-600"
            }`}
          >
            {message}
          </div>
        )}
      </form>
    </div>
  );
}


