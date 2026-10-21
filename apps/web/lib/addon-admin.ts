import { z } from "zod";
import { ADDON_KINDS, ADDON_UNITS } from "@/lib/addon-units";

export const addonInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  emoji: z.string().trim().max(8).nullable().optional(),
  priceCents: z.number().int().min(0).max(100_000_00),
  unit: z.enum(ADDON_UNITS),
  kind: z.enum(ADDON_KINDS).optional(),
  nightPercent: z.number().int().min(1).max(100).nullable().optional(),
  maxQuantity: z.number().int().min(1).max(50),
  stock: z.number().int().min(0).max(500).nullable().optional(),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const addonPatchSchema = addonInputSchema.partial();
