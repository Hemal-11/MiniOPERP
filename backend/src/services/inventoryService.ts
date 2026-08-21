import { Prisma, InventoryRecord } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";
import { CreateInventoryInput } from "../validation/inventory";

export function withAvailable<T extends { physicalQuantity: number; reservedQuantity: number }>(
  record: T
) {
  return { ...record, availableQuantity: record.physicalQuantity - record.reservedQuantity };
}

export async function listInventory() {
  const records = await prisma.inventoryRecord.findMany({
    include: { item: { include: { category: true } }, location: true },
    orderBy: [{ location: { name: "asc" } }, { item: { name: "asc" } }],
  });
  return records.map(withAvailable);
}

export async function createInventoryRecord(input: CreateInventoryInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const record = await tx.inventoryRecord.create({
        data: {
          itemId: input.itemId,
          locationId: input.locationId,
          batch: input.batch,
          physicalQuantity: input.physicalQuantity,
          reservedQuantity: 0,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryRecordId: record.id,
          type: "RECEIPT",
          quantity: input.physicalQuantity,
          idempotencyKey: input.idempotencyKey,
          referenceType: "InventoryRecord",
          referenceId: record.id,
        },
      });

      return withAvailable(record);
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined) ?? [];
      if (target.includes("idempotencyKey")) {
        throw ApiError.conflict("Duplicate inventory transaction (idempotency key already used)");
      }
      throw ApiError.conflict(
        "An inventory record already exists for this item, location and batch"
      );
    }
    throw err;
  }
}

// Adjusts physical quantity by `delta` (positive or negative) using a single atomic
// conditional UPDATE. The WHERE clause re-checks the invariant (result >= 0 and
// result >= reservedQuantity) as part of the same statement that performs the write,
// so a concurrent adjustment can never observe a stale read and push stock negative —
// Postgres serializes concurrent UPDATEs to the same row via its row lock.
export async function adjustInventory(
  inventoryRecordId: string,
  delta: number,
  idempotencyKey: string
) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<InventoryRecord[]>`
      UPDATE "InventoryRecord"
      SET "physicalQuantity" = "physicalQuantity" + ${delta}, "updatedAt" = now()
      WHERE id = ${inventoryRecordId}
        AND "physicalQuantity" + ${delta} >= 0
        AND "physicalQuantity" + ${delta} >= "reservedQuantity"
      RETURNING *;
    `;

    if (rows.length === 0) {
      const existing = await tx.inventoryRecord.findUnique({ where: { id: inventoryRecordId } });
      if (!existing) {
        throw ApiError.notFound("Inventory record not found");
      }
      throw ApiError.conflict(
        "Adjustment would result in negative or invalid physical quantity"
      );
    }

    try {
      await tx.inventoryTransaction.create({
        data: {
          inventoryRecordId,
          type: "ADJUSTMENT",
          quantity: delta,
          idempotencyKey,
          referenceType: "InventoryRecord",
          referenceId: inventoryRecordId,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw ApiError.conflict("Duplicate inventory transaction (idempotency key already used)");
      }
      throw err;
    }

    return withAvailable(rows[0]);
  });
}

// Sum of available quantity (physical - reserved) across all batches of an item at a
// location. Used for work-order shortage calculation.
export async function getAvailableAtLocation(itemId: string, locationId: string) {
  const records = await prisma.inventoryRecord.findMany({ where: { itemId, locationId } });
  return records.reduce((sum, r) => sum + (r.physicalQuantity - r.reservedQuantity), 0);
}
