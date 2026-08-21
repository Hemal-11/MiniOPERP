import "dotenv/config";
import { prisma } from "../lib/prisma";

afterAll(async () => {
  await prisma.$disconnect();
});
