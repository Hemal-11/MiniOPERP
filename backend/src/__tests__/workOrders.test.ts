import request from "supertest";
import { createApp } from "../app";
import { createInventoryRecord, createItem, createLocation, createUser } from "./factories";

const app = createApp();

describe("work order shortage calculation", () => {
  it("calculates shortage as required minus available at that location", async () => {
    const location = await createLocation();
    const item = await createItem();
    await createInventoryRecord({ itemId: item.id, locationId: location.id, physicalQuantity: 60 });
    const { token } = await createUser("ADMIN");
    const { user: assignee } = await createUser("OPERATIONS");

    const res = await request(app)
      .post("/api/work-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        locationId: location.id,
        itemId: item.id,
        requiredQuantity: 100,
        assignedUserId: assignee.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.shortageQuantity).toBe(40);
  });

  it("reports zero shortage when enough stock is available", async () => {
    const location = await createLocation();
    const item = await createItem();
    await createInventoryRecord({ itemId: item.id, locationId: location.id, physicalQuantity: 100 });
    const { token } = await createUser("ADMIN");
    const { user: assignee } = await createUser("OPERATIONS");

    const res = await request(app)
      .post("/api/work-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        locationId: location.id,
        itemId: item.id,
        requiredQuantity: 60,
        assignedUserId: assignee.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.shortageQuantity).toBe(0);
  });

  it("does not allow skipping a status (ASSIGNED -> COMPLETED directly)", async () => {
    const location = await createLocation();
    const item = await createItem();
    const { token } = await createUser("ADMIN");
    const { user: assignee } = await createUser("OPERATIONS");

    const createRes = await request(app)
      .post("/api/work-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        locationId: location.id,
        itemId: item.id,
        requiredQuantity: 10,
        assignedUserId: assignee.id,
      });

    const res = await request(app)
      .patch(`/api/work-orders/${createRes.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "COMPLETED" });

    expect(res.status).toBe(400);
  });
});
