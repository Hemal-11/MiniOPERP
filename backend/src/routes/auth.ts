import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";
import { loginSchema } from "../validation/auth";
import { signToken } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordOk) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      locationId: user.locationId,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        locationId: user.locationId,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      locationId: user.locationId,
    });
  } catch (err) {
    next(err);
  }
});
