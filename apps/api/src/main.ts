import { createServer } from "node:http";
const port = Number(process.env.PORT || 4000);
createServer((req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.url === "/health") { res.end(JSON.stringify({ ok: true, service: "novacard-api" })); return; }
  if (req.url === "/api/docs") { res.end(JSON.stringify({ openapi: "3.0.0", info: { title: "NovaCard API", version: "1.0.0" } })); return; }
  res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" }));
}).listen(port, "0.0.0.0", () => console.log(`NovaCard API listening on ${port}`));
