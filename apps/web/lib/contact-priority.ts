export const MAX_CONTACT_PRIORITY = 10;

const LEGACY_PRIORITY: Record<string, number> = { high: 1, medium: 2, low: 3 };

/** Contact priority is a rank: 1 is contacted first. Older rows stored high/medium/low. */
export function parseContactPriority(value: string | null | undefined): number | null {
  if (!value) return null;
  if (value in LEGACY_PRIORITY) return LEGACY_PRIORITY[value];
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_CONTACT_PRIORITY ? n : null;
}

/** Renumbers contacts 1..n by their chosen priority, keeping list order for ties. */
export function rankContacts<T extends { priority: number | null }>(contacts: T[]): T[] {
  const order = contacts
    .map((contact, index) => ({ index, rank: contact.priority ?? MAX_CONTACT_PRIORITY + index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index);
  const next = contacts.slice();
  order.forEach(({ index }, position) => {
    next[index] = { ...contacts[index], priority: position + 1 };
  });
  return next;
}
