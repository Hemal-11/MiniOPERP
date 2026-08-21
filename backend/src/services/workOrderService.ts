import { WorkOrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";
import { CreateWorkOrderInput } from "../validation/workOrders";
import { getAvailableAtLocation } from "./inventoryService";

let sequence = 0;
function generateCode() {
  sequence += 1;
  return `WO-${Date.now().toString(36).toUpperCase()}-${sequence}`;
}

export async function listWorkOrders() {
  return prisma.workOrder.findMany({
    include: { location: true, item: true, assignedUser: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createWorkOrder(input: CreateWorkOrderInput) {
  const available = await getAvailableAtLocation(input.itemId, input.locationId);
  const shortageQuantity = Math.max(0, input.requiredQuantity - available);

  return prisma.workOrder.create({
    data: {
      code: generateCode(),
      locationId: input.locationId,
      itemId: input.itemId,
      requiredQuantity: input.requiredQuantity,
      assignedUserId: input.assignedUserId,
      shortageQuantity,
    },
    include: { location: true, item: true, assignedUser: true },
  });
}

const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
};

export async function updateWorkOrderStatus(id: string, nextStatus: WorkOrderStatus) {
  const workOrder = await prisma.workOrder.findUnique({ where: { id } });
  if (!workOrder) {
    throw ApiError.notFound("Work order not found");
  }

  if (!ALLOWED_TRANSITIONS[workOrder.status].includes(nextStatus)) {
    throw ApiError.badRequest(
      `Cannot move work order from ${workOrder.status} to ${nextStatus}`
    );
  }

  return prisma.workOrder.update({
    where: { id },
    data: { status: nextStatus },
    include: { location: true, item: true, assignedUser: true },
  });
}
