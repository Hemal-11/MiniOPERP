import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";

// Every factory generates its own unique identifiers (sku, code, email) so tests can
// run concurrently against a shared database without colliding on unique constraints.
const unique = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

export async function createLocation() {
  return prisma.location.create({
    data: { name: unique("Location"), code: unique("LOC") },
  });
}

export async function createCategory() {
  return prisma.category.create({ data: { name: unique("Category") } });
}

export async function createItem(categoryId?: string) {
  const category = categoryId ? { id: categoryId } : await createCategory();
  return prisma.item.create({
    data: { sku: unique("SKU"), name: unique("Item"), categoryId: category.id },
  });
}

export async function createUser(role: Role, locationId?: string) {
  const passwordHash = await bcrypt.hash("password123", 4);
  const user = await prisma.user.create({
    data: {
      email: `${unique("user")}@erp.test`,
      name: unique("User"),
      role,
      passwordHash,
      locationId,
    },
  });
  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    locationId: user.locationId,
  });
  return { user, token };
}

export async function createInventoryRecord(params: {
  itemId: string;
  locationId: string;
  physicalQuantity: number;
  reservedQuantity?: number;
  batch?: string;
}) {
  return prisma.inventoryRecord.create({
    data: {
      itemId: params.itemId,
      locationId: params.locationId,
      batch: params.batch ?? unique("BATCH"),
      physicalQuantity: params.physicalQuantity,
      reservedQuantity: params.reservedQuantity ?? 0,
    },
  });
}
