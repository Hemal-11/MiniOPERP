import request from "supertest";
import { createApp } from "../app";
import { createLocation, createItem, createUser } from "./factories";

const app = createApp();

describe("authentication & authorization", () => {
  it("rejects requests with no token", async () => {
    const res = await request(app).get("/api/inventory");
    expect(res.status).toBe(401);
  });

  it("rejects requests with an invalid token", async () => {
    const res = await request(app)
      .get("/api/inventory")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  // Test 5 (mandatory): unauthorized user cannot perform a restricted operation.
  it("blocks a Sales User from creating a Work Order (Admin-only)", async () => {
    const location = await createLocation();
    const item = await createItem();
    const { token } = await createUser("SALES");
    const { user: assignee } = await createUser("OPERATIONS");

    const res = await request(app)
      .post("/api/work-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        locationId: location.id,
        itemId: item.id,
        requiredQuantity: 10,
        assignedUserId: assignee.id,
      });

    expect(res.status).toBe(403);
  });

  it("blocks a Sales User from creating an internal transfer (Operations/Admin-only)", async () => {
    const source = await createLocation();
    const destination = await createLocation();
    const item = await createItem();
    const { token } = await createUser("SALES");

    const res = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sourceLocationId: source.id,
        destinationLocationId: destination.id,
        itemId: item.id,
        batch: "B1",
        quantity: 10,
      });

    expect(res.status).toBe(403);
  });

  it("blocks an Operations User from creating a customer order (Sales/Admin-only)", async () => {
    const { token } = await createUser("OPERATIONS");

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerName: "Acme", inventoryRecordId: "00000000-0000-0000-0000-000000000000", quantity: 1 });

    expect(res.status).toBe(403);
  });

  it("allows Admin to create a Work Order", async () => {
    const location = await createLocation();
    const item = await createItem();
    const { token } = await createUser("ADMIN");
    const { user: assignee } = await createUser("OPERATIONS");

    const res = await request(app)
      .post("/api/work-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        locationId: location.id,
        itemId: item.id,
        requiredQuantity: 10,
        assignedUserId: assignee.id,
      });

    expect(res.status).toBe(201);
  });
});
