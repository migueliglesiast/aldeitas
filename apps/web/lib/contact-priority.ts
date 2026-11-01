export const CONTACT_PRIORITIES = ["high", "medium", "low"] as const;
export type ContactPriority = (typeof CONTACT_PRIORITIES)[number];
