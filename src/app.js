import express from "express";
import { pool } from "./db.js";

export const app = express();

app.use(express.json());

app.get("/health", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok" });
});
