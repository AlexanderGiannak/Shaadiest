import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./lib/api.js";
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 5186;
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*splat}", (req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true, hmr: { port: 5187 } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.listen(port, "127.0.0.1", () =>
  console.log(`Shaadiest Path → http://localhost:${port}`),
);
