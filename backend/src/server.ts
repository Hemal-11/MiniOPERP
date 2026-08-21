import { createApp } from "./app";
import { env } from "./lib/env";

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Mini Op ERP API listening on port ${env.port}`);
});
