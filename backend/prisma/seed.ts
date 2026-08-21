import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const [warehouse, storeA, storeB] = await Promise.all([
    prisma.location.upsert({
      where: { code: "WH1" },
      update: {},
      create: { name: "Main Warehouse", code: "WH1" },
    }),
    prisma.location.upsert({
      where: { code: "ST1" },
      update: {},
      create: { name: "Store A", code: "ST1" },
    }),
    prisma.location.upsert({
      where: { code: "ST2" },
      update: {},
      create: { name: "Store B", code: "ST2" },
    }),
  ]);

  const category = await prisma.category.upsert({
    where: { name: "Hardware" },
    update: {},
    create: { name: "Hardware" },
  });

  const [boltItem, panelItem] = await Promise.all([
    prisma.item.upsert({
      where: { sku: "BOLT-001" },
      update: {},
      create: { sku: "BOLT-001", name: "M8 Bolt", categoryId: category.id },
    }),
    prisma.item.upsert({
      where: { sku: "PANEL-001" },
      update: {},
      create: { sku: "PANEL-001", name: "Steel Panel", categoryId: category.id },
    }),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: "admin@erp.test" },
    update: {},
    create: { email: "admin@erp.test", name: "Ada Admin", role: "ADMIN", passwordHash },
  });

  const opsUser = await prisma.user.upsert({
    where: { email: "ops@erp.test" },
    update: {},
    create: {
      email: "ops@erp.test",
      name: "Oscar Operations",
      role: "OPERATIONS",
      passwordHash,
      locationId: warehouse.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "sales@erp.test" },
    update: {},
    create: {
      email: "sales@erp.test",
      name: "Sasha Sales",
      role: "SALES",
      passwordHash,
      locationId: storeA.id,
    },
  });

  await prisma.inventoryRecord.upsert({
    where: {
      itemId_locationId_batch: { itemId: boltItem.id, locationId: warehouse.id, batch: "B1" },
    },
    update: {},
    create: {
      itemId: boltItem.id,
      locationId: warehouse.id,
      batch: "B1",
      physicalQuantity: 100,
      reservedQuantity: 0,
    },
  });

  await prisma.inventoryRecord.upsert({
    where: {
      itemId_locationId_batch: { itemId: panelItem.id, locationId: warehouse.id, batch: "B1" },
    },
    update: {},
    create: {
      itemId: panelItem.id,
      locationId: warehouse.id,
      batch: "B1",
      physicalQuantity: 60,
      reservedQuantity: 0,
    },
  });

  await prisma.inventoryRecord.upsert({
    where: {
      itemId_locationId_batch: { itemId: boltItem.id, locationId: storeA.id, batch: "B1" },
    },
    update: {},
    create: {
      itemId: boltItem.id,
      locationId: storeA.id,
      batch: "B1",
      physicalQuantity: 20,
      reservedQuantity: 0,
    },
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete:", {
    admin: admin.email,
    opsUser: opsUser.email,
    locations: [warehouse.code, storeA.code, storeB.code],
  });
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
