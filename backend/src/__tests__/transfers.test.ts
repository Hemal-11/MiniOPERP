import request from "supertest";
import { createApp } from "../app";
import { createInventoryRecord, createItem, createLocation, createUser } from "./factories";

const app = createApp();

async function setupTransferFixture(physicalAtSource = 100, batch?: string) {
  const source = await createLocation();
  const destination = await createLocation();
  const item = await createItem();
  const inventory = await createInventoryRecord({
    itemId: item.id,
    locationId: source.id,
    physicalQuantity: physicalAtSource,
    batch,
  });
  const { token } = await createUser("OPERATIONS");
  return { source, destination, item, inventory, token };
}

describe("internal stock transfer", () => {
  // Test 2 (mandatory): cannot transfer more than available inventory.
  it("rejects a transfer that exceeds available quantity at the source", async () => {
    const { source, destination, item, inventory, token } = await setupTransferFixture(30);

    const createRes = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sourceLocationId: source.id,
        destinationLocationId: destination.id,
        itemId: item.id,
        batch: inventory.batch,
        quantity: 31,
      });
    expect(createRes.status).toBe(201);

    const dispatchRes = await request(app)
      .post(`/api/transfers/${createRes.body.id}/dispatch`)
      .set("Authorization", `Bearer ${token}`);

    expect(dispatchRes.status).toBe(409);
    expect(dispatchRes.body.error).toMatch(/insufficient available inventory/i);
  });

  // Test 3 (mandatory): destination stock increases only after receipt, not on dispatch.
  it("only credits destination inventory on receipt, not on dispatch", async () => {
    const { source, destination, item, inventory, token } = await setupTransferFixture(100);

    const createRes = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sourceLocationId: source.id,
        destinationLocationId: destination.id,
        itemId: item.id,
        batch: inventory.batch,
        quantity: 40,
      });
    const transferId = createRes.body.id;

    const dispatchRes = await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set("Authorization", `Bearer ${token}`);
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.status).toBe("DISPATCHED");

    const inventoryAfterDispatch = await request(app)
      .get("/api/inventory")
      .set("Authorization", `Bearer ${token}`);
    const sourceRecord = inventoryAfterDispatch.body.find(
      (r: { id: string }) => r.id === inventory.id
    );
    expect(sourceRecord.physicalQuantity).toBe(60); // reduced immediately on dispatch

    const destRecordBeforeReceipt = inventoryAfterDispatch.body.find(
      (r: { locationId: string; itemId: string }) =>
        r.locationId === destination.id && r.itemId === item.id
    );
    expect(destRecordBeforeReceipt).toBeUndefined(); // must NOT exist/increase before receipt

    const receiveRes = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set("Authorization", `Bearer ${token}`);
    expect(receiveRes.status).toBe(200);
    expect(receiveRes.body.status).toBe("RECEIVED");

    const inventoryAfterReceipt = await request(app)
      .get("/api/inventory")
      .set("Authorization", `Bearer ${token}`);
    const destRecordAfterReceipt = inventoryAfterReceipt.body.find(
      (r: { locationId: string; itemId: string }) =>
        r.locationId === destination.id && r.itemId === item.id
    );
    expect(destRecordAfterReceipt.physicalQuantity).toBe(40);
  });

  // Test 4 (mandatory): the same transfer cannot be received twice.
  it("rejects a second receive attempt on an already-received transfer", async () => {
    const { source, destination, item, inventory, token } = await setupTransferFixture(100);

    const createRes = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sourceLocationId: source.id,
        destinationLocationId: destination.id,
        itemId: item.id,
        batch: inventory.batch,
        quantity: 25,
      });
    const transferId = createRes.body.id;

    await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set("Authorization", `Bearer ${token}`);

    const firstReceive = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set("Authorization", `Bearer ${token}`);
    expect(firstReceive.status).toBe(200);

    const secondReceive = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set("Authorization", `Bearer ${token}`);
    expect(secondReceive.status).toBe(409);

    const inventoryFinal = await request(app)
      .get("/api/inventory")
      .set("Authorization", `Bearer ${token}`);
    const destRecord = inventoryFinal.body.find(
      (r: { locationId: string; itemId: string }) =>
        r.locationId === destination.id && r.itemId === item.id
    );
    expect(destRecord.physicalQuantity).toBe(25); // not double-credited
  });

  it("rejects two concurrent receive attempts on the same transfer, crediting only once", async () => {
    const { source, destination, item, inventory, token } = await setupTransferFixture(100);

    const createRes = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sourceLocationId: source.id,
        destinationLocationId: destination.id,
        itemId: item.id,
        batch: inventory.batch,
        quantity: 25,
      });
    const transferId = createRes.body.id;

    await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set("Authorization", `Bearer ${token}`);

    const [first, second] = await Promise.all([
      request(app).post(`/api/transfers/${transferId}/receive`).set("Authorization", `Bearer ${token}`),
      request(app).post(`/api/transfers/${transferId}/receive`).set("Authorization", `Bearer ${token}`),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const inventoryFinal = await request(app)
      .get("/api/inventory")
      .set("Authorization", `Bearer ${token}`);
    const destRecord = inventoryFinal.body.find(
      (r: { locationId: string; itemId: string }) =>
        r.locationId === destination.id && r.itemId === item.id
    );
    expect(destRecord.physicalQuantity).toBe(25);
  });
});
