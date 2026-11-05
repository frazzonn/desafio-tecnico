import { Router } from "express";
import { pool } from "../db.js";

export const pedidosRouter = Router();

function normalizarSku(sku) {
  return sku.trim().toUpperCase();
}

function validarPedido(body) {
  const numero = body?.numero;
  const itens = body?.itens;

  if (typeof numero !== "string" || numero.trim() === "") {
    return "Informe o número do pedido.";
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return "O pedido precisa ter pelo menos um item.";
  }

  const skusVistos = new Set();
  for (const item of itens) {
    if (typeof item?.sku !== "string" || item.sku.trim() === "") {
      return "Todo item precisa ter um SKU.";
    }
    if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) {
      return `Quantidade inválida para o SKU ${item.sku}: deve ser um número inteiro maior que zero.`;
    }
    const sku = normalizarSku(item.sku);
    if (skusVistos.has(sku)) {
      return `SKU repetido no pedido: ${sku}.`;
    }
    skusVistos.add(sku);
  }

  return null;
}

pedidosRouter.post("/", async (req, res) => {
  const erro = validarPedido(req.body);
  if (erro) {
    return res.status(400).json({ erro });
  }

  const numero = req.body.numero.trim();
  const itens = req.body.itens.map((item) => ({
    sku: normalizarSku(item.sku),
    quantidade: item.quantidade,
  }));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "INSERT INTO pedidos (numero) VALUES ($1) RETURNING id, numero, situacao",
      [numero],
    );
    const pedido = rows[0];

    for (const item of itens) {
      await client.query(
        "INSERT INTO item_pedido (pedido_id, sku, quantidade) VALUES ($1, $2, $3)",
        [pedido.id, item.sku, item.quantidade],
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      numero: pedido.numero,
      situacao: pedido.situacao,
      itens,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.code === "23505") {
      return res
        .status(409)
        .json({ erro: `Já existe um pedido com o número ${numero}.` });
    }
    throw e;
  } finally {
    client.release();
  }
});
