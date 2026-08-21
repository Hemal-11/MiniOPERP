import { InventoryRecord, Transfer } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";
import { CreateTransferInput } from "../validation/transfers";

let sequence = 0;
function generateCode() {
  sequence += 1;
  return `TRF-${Date.now().toString(36).toUpperCase()}-${sequence}`;
}

export async function listTransfers() {
  return prisma.transfer.findMany({
    include: { sourceLocation: true, destinationLocation: true, item: true, createdBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createTransfer(input: CreateTransferInput, createdById: string) {
  if (input.sourceLocationId === input.destinationLocationId) {
    throw ApiError.badRequest("Source and destination location must differ");
  }

  return prisma.transfer.create({
    data: {
      code: generateCode(),
      sourceLocationId: input.sourceLocationId,
      destinationLocationId: input.destinationLocationId,
      itemId: input.itemId,
      batch: input.batch,
      quantity: input.quantity,
      createdById,
    },
    include: { sourceLocation: true, destinationLocation: true, item: true, createdBy: true },
  });
}

// Dispatch: source inventory is reduced immediately, in the same transaction as the
// REQUESTED -> DISPATCHED status flip. The status flip is itself an atomic conditional
// UPDATE (WHERE status = 'REQUESTED') so a transfer can only ever be dispatched once,
// the same idempotency pattern used for receipt below.
export async function dispatchTransfer(id: string) {
  return prisma.$transaction(async (tx) => {
    const statusRows = await tx.$queryRaw<Transfer[]>`
      UPDATE "Transfer"
      SET status = 'DISPATCHED', "dispatchedAt" = now(), "updatedAt" = now()
      WHERE id = ${id} AND status = 'REQUESTED'
      RETURNING *;
    `;

    if (statusRows.length === 0) {
      const existing = await tx.transfer.findUnique({ where: { id } });
      if (!existing) throw ApiError.notFound("Transfer not found");
      throw ApiError.conflict(`Transfer must be REQUESTED to dispatch (currently ${existing.status})`);
    }

    const transfer = statusRows[0];

    // "Available inventory" for a transfer is physical - reserved, same definition used
    // everywhere else, so stock already reserved for a customer order can't be shipped out.
    const inventoryRows = await tx.$queryRaw<InventoryRecord[]>`
      UPDATE "InventoryRecord"
      SET "physicalQuantity" = "physicalQuantity" - ${transfer.quantity}, "updatedAt" = now()
      WHERE "itemId" = ${transfer.itemId}
        AND "locationId" = ${transfer.sourceLocationId}
        AND batch = ${transfer.batch}
        AND "physicalQuantity" - "reservedQuantity" >= ${transfer.quantity}
      RETURNING *;
    `;

    if (inventoryRows.length === 0) {
      // Rolling back the status flip too: throwing inside $transaction aborts the whole tx.
      throw ApiError.conflict("Insufficient available inventory at source location for this transfer");
    }

    await tx.inventoryTransaction.create({
      data: {
        inventoryRecordId: inventoryRows[0].id,
        type: "TRANSFER_OUT",
        quantity: -transfer.quantity,
        idempotencyKey: `transfer-dispatch-${transfer.id}`,
        referenceType: "Transfer",
        referenceId: transfer.id,
      },
    });

    return tx.transfer.findUniqueOrThrow({
      where: { id },
      include: { sourceLocation: true, destinationLocation: true, item: true, createdBy: true },
    });
  });
}

// Receipt: guarded by the same atomic-conditional-UPDATE-on-status pattern as dispatch.
// WHERE status = 'DISPATCHED' means a second concurrent receive request for the same
// transfer finds zero rows and fails cleanly instead of double-crediting the destination.
export async function receiveTransfer(id: string) {
  return prisma.$transaction(async (tx) => {
    const statusRows = await tx.$queryRaw<Transfer[]>`
      UPDATE "Transfer"
      SET status = 'RECEIVED', "receivedAt" = now(), "updatedAt" = now()
      WHERE id = ${id} AND status = 'DISPATCHED'
      RETURNING *;
    `;

    if (statusRows.length === 0) {
      const existing = await tx.transfer.findUnique({ where: { id } });
      if (!existing) throw ApiError.notFound("Transfer not found");
      throw ApiError.conflict(
        `Transfer must be DISPATCHED to receive (currently ${existing.status}) - it may already have been received`
      );
    }

    const transfer = statusRows[0];

    const destination = await tx.inventoryRecord.upsert({
      where: {
        itemId_locationId_batch: {
          itemId: transfer.itemId,
          locationId: transfer.destinationLocationId,
          batch: transfer.batch,
        },
      },
      update: { physicalQuantity: { increment: transfer.quantity } },
      create: {
        itemId: transfer.itemId,
        locationId: transfer.destinationLocationId,
        batch: transfer.batch,
        physicalQuantity: transfer.quantity,
        reservedQuantity: 0,
      },
    });

    await tx.inventoryTransaction.create({
      data: {
        inventoryRecordId: destination.id,
        type: "TRANSFER_IN",
        quantity: transfer.quantity,
        idempotencyKey: `transfer-receive-${transfer.id}`,
        referenceType: "Transfer",
        referenceId: transfer.id,
      },
    });

    return tx.transfer.findUniqueOrThrow({
      where: { id },
      include: { sourceLocation: true, destinationLocation: true, item: true, createdBy: true },
    });
  });
}
