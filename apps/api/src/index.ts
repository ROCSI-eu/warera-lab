import { serve } from "@hono/node-server";

import { app } from "./app.js";

const port = Number(process.env.PORT ?? "3220");
const hostname = process.env.HOST ?? "127.0.0.1";

serve({
  fetch: app.fetch,
  hostname,
  port,
});
