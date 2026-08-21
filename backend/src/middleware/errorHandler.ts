import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError } from "../lib/errors";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", details: err.flatten() });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Duplicate record", details: err.meta });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Record not found" });
    }
    if (err.code === "P2003") {
      return res.status(400).json({ error: "Invalid reference", details: err.meta });
    }
    return res.status(400).json({ error: "Database constraint violation", details: err.meta });
  }

  // CHECK constraint violations (Postgres code 23514) from non-raw queries don't map to
  // one of Prisma's known error codes above, so they land here as unknown request errors.
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    return res.status(400).json({ error: "Database constraint violation" });
  }

  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
