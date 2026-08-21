import { z } from "zod";

export const createInventorySchema = z.object({
  itemId: z.string().uuid(),
  locationId: z.string().uuid(),
  batch: z.string().min(1),
  physicalQuantity: z.number().int().positive(),
  idempotencyKey: z.string().min(1),
});

export const adjustInventorySchema = z.object({
  // Positive to add stock (e.g. found stock, correction), negative to remove
  // (e.g. damage, write-off). The resulting physicalQuantity must stay >= reservedQuantity.
  delta: z.number().int().refine((v) => v !== 0, "delta must not be zero"),
  idempotencyKey: z.string().min(1),
});

export type CreateInventoryInput = z.infer<typeof createInventorySchema>;
export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;
