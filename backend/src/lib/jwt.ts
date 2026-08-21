import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "./env";

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  locationId: string | null;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
