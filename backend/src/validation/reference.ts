import { z } from "zod";

export const createLocationSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});

export const createCategorySchema = z.object({
  name: z.string().min(1),
});

export const createItemSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  categoryId: z.string().uuid(),
});
