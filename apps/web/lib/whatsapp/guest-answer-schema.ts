import { z } from "zod";

export const guestAnswerSchema = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(2000),
  listingId: z.string().nullable().optional(),
  verifiedOnly: z.boolean().optional(),
});
