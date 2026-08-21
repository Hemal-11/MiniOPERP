import { z } from "zod";

export const createTransferSchema = z.object({
  sourceLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  itemId: z.string().uuid(),
  batch: z.string().min(1),
  quantity: z.number().int().positive(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
