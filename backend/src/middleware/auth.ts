import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { ApiError } from "../lib/errors";
import { JwtPayload, verifyToken } from "../lib/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing bearer token"));
  }

  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return next(ApiError.unauthorized("Invalid or expired token"));
  }
}

// Every protected route declares which roles may call it; authorization is always
// checked server-side and never inferred from anything the client sends.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires role: ${roles.join(" or ")}`));
    }
    return next();
  };
}
