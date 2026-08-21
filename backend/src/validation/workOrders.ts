import { z } from "zod";
import { WorkOrderStatus } from "@prisma/client";

export const createWorkOrderSchema = z.object({
  locationId: z.string().uuid(),
  itemId: z.string().uuid(),
  requiredQuantity: z.number().int().positive(),
  assignedUserId: z.string().uuid(),
});

export const updateWorkOrderStatusSchema = z.object({
  status: z.nativeEnum(WorkOrderStatus),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
