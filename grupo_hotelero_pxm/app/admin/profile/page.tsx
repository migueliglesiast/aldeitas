"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type User = {
  id: string;
  email: string;
  username: string;
  nickname: string | null;
  fullName: string | null;
  phoneNumber: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nickname: "",
    fullName: "",
    phoneNumber: "",
  });

  useEffect(() => {
    fetch("/api/admin/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          setFormData({
            nickname: data.user.nickname || "",
            fullName: data.user.fullName || "",
            phoneNumber: data.user.phoneNumber || "",
          });
        } else {
          router.push("/sign-in");
        }
      })
      .catch(() => router.push("/sign-in"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }

      const data = await res.json();
      setUser(data.user);
      setMessage("Profile updated successfully!");
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          ← Back to Admin
        </Link>
        <h1 className="text-3xl font-semibold mt-4">Edit Profile</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <p className="text-gray-900 bg-gray-50 p-2 rounded border">{user.email}</p>
          <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Name (Nickname) *
          </label>
          <input
            type="text"
            value={formData.nickname}
            onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
            className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
            placeholder="Enter your display name"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            This name will appear in the welcome message
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
            placeholder="Enter your phone number"
          />
        </div>

        {message && (
          <div
            className={`p-3 rounded ${
              message.includes("success") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-[#00a19c] px-6 py-2 text-white hover:bg-[#008a86] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href="/admin"
            className="rounded border border-gray-300 px-6 py-2 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}


