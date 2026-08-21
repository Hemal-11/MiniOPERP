import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { createCategorySchema, createItemSchema, createLocationSchema } from "../validation/reference";

export const referenceRouter = Router();

referenceRouter.use(requireAuth);

// Read access: any authenticated role, since every screen needs these for dropdowns.
referenceRouter.get("/locations", async (_req, res, next) => {
  try {
    const locations = await prisma.location.findMany({ orderBy: { name: "asc" } });
    res.json(locations);
  } catch (err) {
    next(err);
  }
});

referenceRouter.post("/locations", requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const input = createLocationSchema.parse(req.body);
    const location = await prisma.location.create({ data: input });
    res.status(201).json(location);
  } catch (err) {
    next(err);
  }
});

referenceRouter.get("/categories", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

referenceRouter.post("/categories", requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const input = createCategorySchema.parse(req.body);
    const category = await prisma.category.create({ data: input });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

referenceRouter.get("/items", async (_req, res, next) => {
  try {
    const items = await prisma.item.findMany({
      orderBy: { name: "asc" },
      include: { category: true },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

referenceRouter.post("/items", requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const input = createItemSchema.parse(req.body);
    const item = await prisma.item.create({ data: input });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

referenceRouter.get("/users", requireRole(Role.ADMIN), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, locationId: true },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});
