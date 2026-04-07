import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.json({ message: "storefront-builder-eta" }));

export default app;
