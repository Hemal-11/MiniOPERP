import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { ApiError } from "../lib/errors";
import { createWorkOrderSchema, updateWorkOrderStatusSchema } from "../validation/workOrders";
import { createWorkOrder, listWorkOrders, updateWorkOrderStatus } from "../services/workOrderService";
import { prisma } from "../lib/prisma";

export const workOrderRouter = Router();

workOrderRouter.use(requireAuth);

workOrderRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await listWorkOrders());
  } catch (err) {
    next(err);
  }
});

// Spec: "Admin can create Work Orders." Kept strictly to Admin.
workOrderRouter.post("/", requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const input = createWorkOrderSchema.parse(req.body);
    const workOrder = await createWorkOrder(input);
    res.status(201).json(workOrder);
  } catch (err) {
    next(err);
  }
});

// Status progress is operational day-to-day work: Admin or the assigned Operations
// user may advance it. Any other Operations user is blocked to keep ownership clear.
workOrderRouter.patch(
  "/:id/status",
  requireRole(Role.ADMIN, Role.OPERATIONS),
  async (req, res, next) => {
    try {
      const input = updateWorkOrderStatusSchema.parse(req.body);

      if (req.user!.role === Role.OPERATIONS) {
        const workOrder = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
        if (!workOrder) throw ApiError.notFound("Work order not found");
        if (workOrder.assignedUserId !== req.user!.sub) {
          throw ApiError.forbidden("Only the assigned user or an admin can update this work order");
        }
      }

      const workOrder = await updateWorkOrderStatus(req.params.id, input.status);
      res.json(workOrder);
    } catch (err) {
      next(err);
    }
  }
);
