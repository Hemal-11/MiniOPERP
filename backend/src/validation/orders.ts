import { z } from "zod";

export const createOrderSchema = z.object({
  customerName: z.string().min(1),
  inventoryRecordId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
