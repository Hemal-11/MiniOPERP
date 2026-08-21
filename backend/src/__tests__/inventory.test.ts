import request from "supertest";
import { randomUUID } from "crypto";
import { createApp } from "../app";
import { createInventoryRecord, createItem, createLocation, createUser } from "./factories";

const app = createApp();

describe("inventory constraints", () => {
  it("computes availableQuantity as physical minus reserved", async () => {
    const location = await createLocation();
    const item = await createItem();
    const inventory = await createInventoryRecord({
      itemId: item.id,
      locationId: location.id,
      physicalQuantity: 100,
      reservedQuantity: 30,
    });
    const { token } = await createUser("OPERATIONS");

    const res = await request(app).get("/api/inventory").set("Authorization", `Bearer ${token}`);
    const record = res.body.find((r: { id: string }) => r.id === inventory.id);
    expect(record.availableQuantity).toBe(70);
  });

  it("rejects an adjustment that would drive physical quantity negative", async () => {
    const location = await createLocation();
    const item = await createItem();
    const inventory = await createInventoryRecord({
      itemId: item.id,
      locationId: location.id,
      physicalQuantity: 10,
    });
    const { token } = await createUser("OPERATIONS");

    const res = await request(app)
      .post(`/api/inventory/${inventory.id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: -20, idempotencyKey: randomUUID() });

    expect(res.status).toBe(409);
  });

  it("rejects a duplicate inventory transaction using the same idempotency key", async () => {
    const location = await createLocation();
    const item = await createItem();
    const inventory = await createInventoryRecord({
      itemId: item.id,
      locationId: location.id,
      physicalQuantity: 10,
    });
    const { token } = await createUser("OPERATIONS");
    const idempotencyKey = randomUUID();

    const first = await request(app)
      .post(`/api/inventory/${inventory.id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: 5, idempotencyKey });
    expect(first.status).toBe(200);
    expect(first.body.physicalQuantity).toBe(15);

    const second = await request(app)
      .post(`/api/inventory/${inventory.id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: 5, idempotencyKey });
    expect(second.status).toBe(409);

    const res = await request(app).get("/api/inventory").set("Authorization", `Bearer ${token}`);
    const record = res.body.find((r: { id: string }) => r.id === inventory.id);
    expect(record.physicalQuantity).toBe(15); // second call must not have applied
  });

  it("rejects creating a duplicate inventory record for the same item/location/batch", async () => {
    const location = await createLocation();
    const item = await createItem();
    const { token } = await createUser("OPERATIONS");
    const batch = `BATCH-${randomUUID().slice(0, 8)}`;

    const first = await request(app)
      .post("/api/inventory")
      .set("Authorization", `Bearer ${token}`)
      .send({
        itemId: item.id,
        locationId: location.id,
        batch,
        physicalQuantity: 10,
        idempotencyKey: randomUUID(),
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/inventory")
      .set("Authorization", `Bearer ${token}`)
      .send({
        itemId: item.id,
        locationId: location.id,
        batch,
        physicalQuantity: 5,
        idempotencyKey: randomUUID(),
      });
    expect(second.status).toBe(409);
  });
});
