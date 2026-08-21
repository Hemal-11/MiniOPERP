export type Role = "ADMIN" | "OPERATIONS" | "SALES";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  locationId: string | null;
}

export interface Location {
  id: string;
  name: string;
  code: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  category?: Category;
}

export interface InventoryRecord {
  id: string;
  itemId: string;
  locationId: string;
  batch: string;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  item: Item;
  location: Location;
}

export type WorkOrderStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

export interface WorkOrder {
  id: string;
  code: string;
  locationId: string;
  itemId: string;
  requiredQuantity: number;
  assignedUserId: string;
  status: WorkOrderStatus;
  shortageQuantity: number;
  location: Location;
  item: Item;
  assignedUser: User;
}

export type TransferStatus = "REQUESTED" | "DISPATCHED" | "RECEIVED";

export interface Transfer {
  id: string;
  code: string;
  sourceLocationId: string;
  destinationLocationId: string;
  itemId: string;
  batch: string;
  quantity: number;
  status: TransferStatus;
  sourceLocation: Location;
  destinationLocation: Location;
  item: Item;
}

export type OrderLineStatus = "RESERVED" | "FULFILLED" | "CANCELLED";

export interface OrderLine {
  id: string;
  quantity: number;
  status: OrderLineStatus;
  inventoryRecord: InventoryRecord;
}

export interface CustomerOrder {
  id: string;
  code: string;
  customerName: string;
  status: string;
  salesUser: User;
  orderLines: OrderLine[];
}
