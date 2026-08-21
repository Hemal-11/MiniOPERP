import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { adjustInventorySchema, createInventorySchema } from "../validation/inventory";
import { adjustInventory, createInventoryRecord, listInventory } from "../services/inventoryService";

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);

inventoryRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await listInventory());
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post("/", requireRole(Role.ADMIN, Role.OPERATIONS), async (req, res, next) => {
  try {
    const input = createInventorySchema.parse(req.body);
    const record = await createInventoryRecord(input);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post(
  "/:id/adjust",
  requireRole(Role.ADMIN, Role.OPERATIONS),
  async (req, res, next) => {
    try {
      const input = adjustInventorySchema.parse(req.body);
      const record = await adjustInventory(req.params.id, input.delta, input.idempotencyKey);
      res.json(record);
    } catch (err) {
      next(err);
    }
  }
);
