import { PrismaClient } from "@prisma/client";

// Single shared client so we don't exhaust Postgres connections across hot reloads/tests.
export const prisma = new PrismaClient();
