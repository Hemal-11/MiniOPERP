import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../lib/prisma";
import { createInventoryRecord, createItem, createLocation, createUser } from "./factories";

const app = createApp();

describe("customer order reservation", () => {
  // Test 1 (mandatory): cannot reserve more than available inventory.
  it("rejects a reservation that exceeds available quantity", async () => {
    const location = await createLocation();
    const item = await createItem();
    const inventory = await createInventoryRecord({
      itemId: item.id,
      locationId: location.id,
      physicalQuantity: 50,
    });
    const { token } = await createUser("SALES");

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerName: "Acme Co", inventoryRecordId: inventory.id, quantity: 51 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/available inventory/i);
  });

  it("allows a reservation within available quantity and reduces available quantity", async () => {
    const location = await createLocation();
    const item = await createItem();
    const inventory = await createInventoryRecord({
      itemId: item.id,
      locationId: location.id,
      physicalQuantity: 100,
    });
    const { token } = await createUser("SALES");

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerName: "Acme Co", inventoryRecordId: inventory.id, quantity: 60 });

    expect(res.status).toBe(201);

    const invRes = await request(app)
      .get("/api/inventory")
      .set("Authorization", `Bearer ${token}`);
    const updated = invRes.body.find((r: { id: string }) => r.id === inventory.id);
    expect(updated.physicalQuantity).toBe(100);
    expect(updated.reservedQuantity).toBe(60);
    expect(updated.availableQuantity).toBe(40);
  });

  // Concurrency: two overlapping reservation requests against the same inventory row,
  // where their combined quantity exceeds what's available, must not both succeed.
  it("only allows one of two concurrent over-committing reservations to succeed", async () => {
    const location = await createLocation();
    const item = await createItem();
    const inventory = await createInventoryRecord({
      itemId: item.id,
      locationId: location.id,
      physicalQuantity: 100,
    });
    const { token: tokenA } = await createUser("SALES");
    const { token: tokenB } = await createUser("SALES");

    const [resA, resB] = await Promise.all([
      request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ customerName: "Customer A", inventoryRecordId: inventory.id, quantity: 80 }),
      request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ customerName: "Customer B", inventoryRecordId: inventory.id, quantity: 50 }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    // Exactly one request should have applied - whichever the DB serialized first.
    const winningQuantity = resA.status === 201 ? 80 : 50;

    const final = await prisma.inventoryRecord.findUniqueOrThrow({ where: { id: inventory.id } });
    expect(final.reservedQuantity).toBeLessThanOrEqual(final.physicalQuantity);
    expect(final.reservedQuantity).toBe(winningQuantity);
  });
});
