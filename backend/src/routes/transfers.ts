import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { createTransferSchema } from "../validation/transfers";
import { createTransfer, dispatchTransfer, listTransfers, receiveTransfer } from "../services/transferService";

export const transferRouter = Router();

transferRouter.use(requireAuth);

transferRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await listTransfers());
  } catch (err) {
    next(err);
  }
});

// Operations User manages internal transfers per the role matrix; Admin retains access too.
transferRouter.post("/", requireRole(Role.ADMIN, Role.OPERATIONS), async (req, res, next) => {
  try {
    const input = createTransferSchema.parse(req.body);
    const transfer = await createTransfer(input, req.user!.sub);
    res.status(201).json(transfer);
  } catch (err) {
    next(err);
  }
});

transferRouter.post(
  "/:id/dispatch",
  requireRole(Role.ADMIN, Role.OPERATIONS),
  async (req, res, next) => {
    try {
      res.json(await dispatchTransfer(req.params.id));
    } catch (err) {
      next(err);
    }
  }
);

transferRouter.post(
  "/:id/receive",
  requireRole(Role.ADMIN, Role.OPERATIONS),
  async (req, res, next) => {
    try {
      res.json(await receiveTransfer(req.params.id));
    } catch (err) {
      next(err);
    }
  }
);
