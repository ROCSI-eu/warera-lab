import { Hono } from "hono";

export function createApp() {
  const app = new Hono();

  app.use("/api/*", async (context, next) => {
    await next();
    context.header("Cache-Control", "no-store");
  });

  app.get("/api/health", (context) =>
    context.json({
      status: "ok",
      service: "warera-lab-api",
    }),
  );

  return app;
}

export const app = createApp();
