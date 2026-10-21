import { z } from "zod";
import { ADDON_KINDS, ADDON_UNITS, addonOptionsSchema } from "@/lib/addon-units";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((value) => (value === "" ? null : value));

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
  options: addonOptionsSchema
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value && value.length > 0 ? JSON.stringify(value) : null)),
  depositCents: z.number().int().min(0).max(100_000_00).nullable().optional(),
  note: optionalText(300),
  providerName: optionalText(80),
  providerPhone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{8,20}$/)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});

export const addonPatchSchema = addonInputSchema.partial();
