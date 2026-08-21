# Database Schema

PostgreSQL, managed with Prisma migrations (`backend/prisma/schema.prisma` +
`backend/prisma/migrations/`). The migration SQL additionally carries a handful of
`CHECK` constraints that Prisma's schema language cannot express natively — see the
note at the bottom.

## ER Diagram

```mermaid
erDiagram
    User ||--o{ WorkOrder : "assigned to"
    User ||--o{ Transfer : "created by"
    User ||--o{ CustomerOrder : "sales user"
    Location ||--o{ User : "assigned location (optional)"
    Location ||--o{ InventoryRecord : "stocked at"
    Location ||--o{ WorkOrder : "located at"
    Location ||--o{ Transfer : "source"
    Location ||--o{ Transfer : "destination"
    Category ||--o{ Item : "categorizes"
    Item ||--o{ InventoryRecord : "stocked as"
    Item ||--o{ WorkOrder : "required material"
    Item ||--o{ Transfer : "transferred"
    InventoryRecord ||--o{ InventoryTransaction : "movement ledger"
    InventoryRecord ||--o{ OrderLine : "reserved against"
    CustomerOrder ||--o{ OrderLine : "contains"

    User {
        uuid id PK
        string email UK
        string passwordHash
        string name
        enum role "ADMIN | OPERATIONS | SALES"
        uuid locationId FK "nullable"
    }

    Location {
        uuid id PK
        string name UK
        string code UK
    }

    Category {
        uuid id PK
        string name UK
    }

    Item {
        uuid id PK
        string sku UK
        string name
        uuid categoryId FK
    }

    InventoryRecord {
        uuid id PK
        uuid itemId FK
        uuid locationId FK
        string batch
        int physicalQuantity
        int reservedQuantity
        "unique(itemId, locationId, batch)"
    }

    InventoryTransaction {
        uuid id PK
        uuid inventoryRecordId FK
        enum type "RECEIPT | ADJUSTMENT | TRANSFER_OUT | TRANSFER_IN | RESERVATION | RELEASE"
        int quantity
        string idempotencyKey UK
    }

    WorkOrder {
        uuid id PK
        string code UK
        uuid locationId FK
        uuid itemId FK
        int requiredQuantity
        uuid assignedUserId FK
        enum status "ASSIGNED | IN_PROGRESS | COMPLETED"
        int shortageQuantity
    }

    Transfer {
        uuid id PK
        string code UK
        uuid sourceLocationId FK
        uuid destinationLocationId FK
        uuid itemId FK
        string batch
        int quantity
        enum status "REQUESTED | DISPATCHED | RECEIVED"
        uuid createdById FK
    }

    CustomerOrder {
        uuid id PK
        string code UK
        string customerName
        uuid salesUserId FK
        string status "OPEN | CANCELLED"
    }

    OrderLine {
        uuid id PK
        uuid orderId FK
        uuid inventoryRecordId FK
        int quantity
        enum status "RESERVED | FULFILLED | CANCELLED"
    }
```

## Key design decisions

- **`InventoryRecord` is the unit of stock**: one row per (item, location, batch),
  enforced by a unique constraint. `availableQuantity` is never stored — it is always
  computed as `physicalQuantity - reservedQuantity`, so it cannot drift out of sync.
- **`InventoryTransaction` is an append-only ledger** of every stock movement
  (receipt, adjustment, transfer out/in, reservation, release), each carrying a unique
  `idempotencyKey`. This is what "prevent duplicate inventory transaction" is built on:
  a retried request with the same key is rejected by the unique constraint.
- **A `CustomerOrder` reserves against one specific `InventoryRecord`** (a specific
  item + location + batch), not against an item in the abstract. See the README
  "Judgment calls" section for why.
- **CHECK constraints as a second line of defense.** Prisma's schema language has no
  native `@@check` attribute, so these are hand-added to the generated migration SQL
  (`backend/prisma/migrations/20260821110611_init/migration.sql`):
  - `InventoryRecord.physicalQuantity >= 0`
  - `InventoryRecord.reservedQuantity >= 0`
  - `InventoryRecord.reservedQuantity <= physicalQuantity`
  - `Transfer.quantity > 0`, `OrderLine.quantity > 0`, `WorkOrder.requiredQuantity > 0`

  These exist behind the application-level atomic conditional updates (see README
  "Concurrency & correctness") as a backstop, not as the primary mechanism.
