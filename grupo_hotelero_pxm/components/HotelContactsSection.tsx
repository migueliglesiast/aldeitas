"use client";
import { useState } from "react";

type Contact = {
  id: string;
  type: string;
  name: string;
  phone: string;
};

type Props = {
  hotelId: string;
  initialContacts: Contact[];
};

export default function HotelContactsSection({ hotelId, initialContacts }: Props) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [originalContactValues, setOriginalContactValues] = useState<Record<string, Contact>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const contactTypes = [
    { value: "MAIN_MAINTENANCE", label: "Main Maintenance Contact" },
    { value: "CLEANER", label: "Cleaner" },
    { value: "PLUMBER_ELECTRICIAN", label: "Plumber/Electrician" },
    { value: "INTERNET_TECH", label: "Internet Technician" },
    { value: "AC_TECH", label: "AC Technician" },
  ] as const;

  const getContactsByType = (type: Contact["type"]) => {
    return contacts.filter((c) => c.type === type);
  };

  const handleAddContact = (type: Contact["type"]) => {
    setContacts([
      ...contacts,
      {
        id: `temp-${Date.now()}`,
        type,
        name: "",
        phone: "",
      },
    ]);
  };

  const handleUpdateContact = (id: string, field: "name" | "phone", value: string) => {
    setContacts(
      contacts.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleDeleteContact = async (id: string) => {
    if (id.startsWith("temp-")) {
      setContacts(contacts.filter((c) => c.id !== id));
      return;
    }

    try {
      const res = await fetch(`/api/admin/hotel/${hotelId}/contact/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete contact");

      setContacts(contacts.filter((c) => c.id !== id));
    } catch (error: any) {
      setMessage(error.message || "Failed to delete contact");
    }
  };

  const handleSaveContact = async (contact: Contact) => {
    if (!contact.name.trim() || !contact.phone.trim()) {
      setMessage("Name and phone are required");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const isNew = contact.id.startsWith("temp-");
      const url = isNew
        ? `/api/admin/hotel/${hotelId}/contact`
        : `/api/admin/hotel/${hotelId}/contact/${contact.id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: contact.type,
          name: contact.name,
          phone: contact.phone,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save contact");
      }

      const data = await res.json();
      setContacts(contacts.map((c) => (c.id === contact.id ? data.contact : c)));
      setEditingContactId(null); // Exit edit mode after saving
      // Clear original values for this contact
      const { [contact.id]: _, ...rest } = originalContactValues;
      setOriginalContactValues(rest);
      setMessage("Contact saved successfully!");
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage(error.message || "Failed to save contact");
    } finally {
      setSaving(false);
    }
  };

  const isContactSaved = (contactId: string) => {
    return !contactId.startsWith("temp-");
  };

  const isEditing = (contactId: string) => {
    return editingContactId === contactId;
  };

  return (
    <div className="bg-white rounded-lg border p-6 space-y-6">
      <h2 className="text-xl font-semibold">Contact Information</h2>

      {message && (
        <div
          className={`p-3 rounded ${
            message.includes("success") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      {contactTypes.map(({ value, label }) => {
        const typeContacts = getContactsByType(value);
        return (
          <div key={value} className="space-y-3">
            <h3 className="font-medium text-gray-900">{label}</h3>
            {typeContacts.map((contact) => {
              const isSaved = isContactSaved(contact.id);
              const isEditingThis = isEditing(contact.id);
              const isEditable = !isSaved || isEditingThis;

              return (
                <div key={contact.id} className="flex gap-3 items-start p-3 border rounded-lg">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    {isEditable ? (
                      <>
                        <input
                          type="text"
                          value={contact.name}
                          onChange={(e) => handleUpdateContact(contact.id, "name", e.target.value)}
                          placeholder="Name"
                          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
                        />
                        <input
                          type="tel"
                          value={contact.phone}
                          onChange={(e) => handleUpdateContact(contact.id, "phone", e.target.value)}
                          placeholder="Phone"
                          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
                        />
                      </>
                    ) : (
                      <>
                        <div className="px-3 py-2 text-sm text-gray-900 bg-gray-50 rounded border border-gray-200">
                          {contact.name}
                        </div>
                        <div className="px-3 py-2 text-sm text-gray-900 bg-gray-50 rounded border border-gray-200">
                          {contact.phone}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    {isSaved && !isEditingThis && (
                      <button
                        onClick={() => {
                          // Save current values before editing
                          setOriginalContactValues({
                            ...originalContactValues,
                            [contact.id]: { ...contact },
                          });
                          setEditingContactId(contact.id);
                        }}
                        className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-1"
                        title="Edit contact"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    )}
                    {isEditable && (
                      <button
                        onClick={() => handleSaveContact(contact)}
                        disabled={saving}
                        className="rounded bg-[#00a19c] px-3 py-2 text-white text-sm hover:bg-[#008a86] disabled:opacity-50"
                      >
                        Save
                      </button>
                    )}
                    {isEditingThis && (
                      <button
                        onClick={() => {
                          // Restore original values
                          const original = originalContactValues[contact.id];
                          if (original) {
                            setContacts(
                              contacts.map((c) =>
                                c.id === contact.id ? { ...original } : c
                              )
                            );
                          }
                          setEditingContactId(null);
                        }}
                        className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteContact(contact.id)}
                      className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => handleAddContact(value)}
              className="flex items-center gap-2 text-[#00a19c] hover:text-[#008a86] text-sm font-medium"
            >
              <span className="text-lg">+</span>
              Add {label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

