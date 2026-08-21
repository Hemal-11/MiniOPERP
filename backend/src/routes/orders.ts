import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { createOrderSchema } from "../validation/orders";
import { cancelOrder, createOrderWithReservation, listOrders } from "../services/orderService";

export const orderRouter = Router();

orderRouter.use(requireAuth);

orderRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await listOrders());
  } catch (err) {
    next(err);
  }
});

orderRouter.post("/", requireRole(Role.SALES, Role.ADMIN), async (req, res, next) => {
  try {
    const input = createOrderSchema.parse(req.body);
    const order = await createOrderWithReservation(input, req.user!.sub);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

orderRouter.post("/:id/cancel", requireRole(Role.SALES, Role.ADMIN), async (req, res, next) => {
  try {
    res.json(await cancelOrder(req.params.id));
  } catch (err) {
    next(err);
  }
});
