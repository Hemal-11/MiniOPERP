import { InventoryRecord } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";
import { CreateOrderInput } from "../validation/orders";

let sequence = 0;
function generateCode() {
  sequence += 1;
  return `SO-${Date.now().toString(36).toUpperCase()}-${sequence}`;
}

export async function listOrders() {
  return prisma.customerOrder.findMany({
    include: {
      salesUser: true,
      orderLines: { include: { inventoryRecord: { include: { item: true, location: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// This is the operation the case study's concurrency test targets: two requests
// reserving against the same inventory row must never both succeed if their combined
// quantity exceeds what's available.
//
// The reservation is a single atomic UPDATE whose WHERE clause re-checks
// "physicalQuantity - reservedQuantity >= quantity" as part of the same statement that
// increments reservedQuantity. Postgres takes a row lock to evaluate and apply that
// UPDATE, so a second concurrent transaction targeting the same row blocks until the
// first commits, then re-evaluates the WHERE clause against the now-updated row and
// correctly fails if the stock is gone. This is safe under Postgres's default READ
// COMMITTED isolation - no SELECT ... FOR UPDATE or SERIALIZABLE isolation is needed
// because there's no separate read-then-write in application code for the check itself.
export async function createOrderWithReservation(input: CreateOrderInput, salesUserId: string) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<InventoryRecord[]>`
      UPDATE "InventoryRecord"
      SET "reservedQuantity" = "reservedQuantity" + ${input.quantity}, "updatedAt" = now()
      WHERE id = ${input.inventoryRecordId}
        AND "physicalQuantity" - "reservedQuantity" >= ${input.quantity}
      RETURNING *;
    `;

    if (rows.length === 0) {
      const existing = await tx.inventoryRecord.findUnique({
        where: { id: input.inventoryRecordId },
      });
      if (!existing) throw ApiError.notFound("Inventory record not found");
      throw ApiError.conflict(
        "Cannot reserve more than available inventory",
        {
          available: existing.physicalQuantity - existing.reservedQuantity,
          requested: input.quantity,
        }
      );
    }

    const inventoryRecord = rows[0];

    const order = await tx.customerOrder.create({
      data: {
        code: generateCode(),
        customerName: input.customerName,
        salesUserId,
        orderLines: {
          create: {
            inventoryRecordId: inventoryRecord.id,
            quantity: input.quantity,
          },
        },
      },
      include: {
        salesUser: true,
        orderLines: { include: { inventoryRecord: { include: { item: true, location: true } } } },
      },
    });

    await tx.inventoryTransaction.create({
      data: {
        inventoryRecordId: inventoryRecord.id,
        type: "RESERVATION",
        quantity: input.quantity,
        idempotencyKey: `order-reserve-${order.orderLines[0].id}`,
        referenceType: "CustomerOrder",
        referenceId: order.id,
      },
    });

    return order;
  });
}

// Judgment call (not in the mandatory spec, but named as an example "Live Verification"
// change): cancelling an order releases its reserved quantity back to available stock.
// Guarded the same way - status flip is part of the atomic condition - so a
// double-cancel can't release the same reservation twice.
export async function cancelOrder(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.customerOrder.findUnique({
      where: { id: orderId },
      include: { orderLines: true },
    });
    if (!order) throw ApiError.notFound("Order not found");
    if (order.status === "CANCELLED") {
      throw ApiError.conflict("Order is already cancelled");
    }

    for (const line of order.orderLines) {
      if (line.status !== "RESERVED") continue;

      const updatedLines = await tx.$executeRaw`
        UPDATE "OrderLine" SET status = 'CANCELLED' WHERE id = ${line.id} AND status = 'RESERVED';
      `;
      if (updatedLines === 0) continue;

      await tx.$executeRaw`
        UPDATE "InventoryRecord"
        SET "reservedQuantity" = "reservedQuantity" - ${line.quantity}, "updatedAt" = now()
        WHERE id = ${line.inventoryRecordId};
      `;

      await tx.inventoryTransaction.create({
        data: {
          inventoryRecordId: line.inventoryRecordId,
          type: "RELEASE",
          quantity: line.quantity,
          idempotencyKey: `order-cancel-${line.id}`,
          referenceType: "CustomerOrder",
          referenceId: order.id,
        },
      });
    }

    return tx.customerOrder.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
      include: {
        salesUser: true,
        orderLines: { include: { inventoryRecord: { include: { item: true, location: true } } } },
      },
    });
  });
}
