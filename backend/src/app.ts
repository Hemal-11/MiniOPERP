import express from "express";
import cors from "cors";
import path from "path";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { authRouter } from "./routes/auth";
import { referenceRouter } from "./routes/reference";
import { inventoryRouter } from "./routes/inventory";
import { workOrderRouter } from "./routes/workOrders";
import { transferRouter } from "./routes/transfers";
import { orderRouter } from "./routes/orders";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  try {
    const openapiDocument = YAML.load(path.join(__dirname, "..", "..", "docs", "openapi.yaml"));
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));
  } catch {
    // Docs are optional at runtime; missing file must never take the API down.
  }

  app.use("/api/auth", authRouter);
  app.use("/api", referenceRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/work-orders", workOrderRouter);
  app.use("/api/transfers", transferRouter);
  app.use("/api/orders", orderRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
