import express from "express";
import { pool } from "./db.js";
import { pedidosRouter } from "./routes/pedidos.js";

export const app = express();

app.use(express.json());

app.get("/health", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok" });
});

app.use("/pedidos", pedidosRouter);

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ erro: "JSON inválido no corpo da requisição." });
  }
  console.error(err);
  res.status(500).json({ erro: "Erro interno no servidor." });
});
