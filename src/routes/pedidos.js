import { Router } from "express";
import { pool } from "../db.js";
import { calcularConferencia } from "../conferencia.js";

export const pedidosRouter = Router();

// ---------- Funções de apoio ----------

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

async function buscarPedido(db, numero) {
  const { rows } = await db.query(
    "SELECT id, numero, situacao, criado, fechado FROM pedidos WHERE numero = $1",
    [numero],
  );
  return rows[0] ?? null;
}

async function carregarConferencia(db, pedidoId) {
  const { rows: itens } = await db.query(
    "SELECT sku, quantidade FROM item_pedido WHERE pedido_id = $1 ORDER BY id",
    [pedidoId],
  );
  const { rows: leituras } = await db.query(
    "SELECT sku FROM leituras WHERE pedido_id = $1 ORDER BY id",
    [pedidoId],
  );
  return calcularConferencia(
    itens,
    leituras.map((leitura) => leitura.sku),
  );
}

// ---------- Rotas ----------

// Criar pedido
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

// Consultar pedido
pedidosRouter.get("/:numero", async (req, res) => {
  const pedido = await buscarPedido(pool, req.params.numero);
  if (!pedido) {
    return res
      .status(404)
      .json({ erro: `Pedido ${req.params.numero} não encontrado.` });
  }

  const { rows: itens } = await pool.query(
    "SELECT sku, quantidade FROM item_pedido WHERE pedido_id = $1 ORDER BY id",
    [pedido.id],
  );

  res.json({
    numero: pedido.numero,
    situacao: pedido.situacao,
    criado: pedido.criado,
    fechado: pedido.fechado,
    itens,
  });
});

// Registrar leitura
pedidosRouter.post("/:numero/leituras", async (req, res) => {
  const skuRecebido = req.body?.sku;
  if (typeof skuRecebido !== "string" || skuRecebido.trim() === "") {
    return res.status(400).json({ erro: "Informe o SKU lido." });
  }
  const sku = normalizarSku(skuRecebido);
  const numero = req.params.numero;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT id, situacao FROM pedidos WHERE numero = $1 FOR UPDATE",
      [numero],
    );
    const pedido = rows[0];

    if (!pedido) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: `Pedido ${numero} não encontrado.` });
    }
    if (pedido.situacao === "CONFERIDO") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        erro: `Pedido ${numero} já foi conferido e não aceita novas leituras.`,
      });
    }

    await client.query(
      "INSERT INTO leituras (pedido_id, sku) VALUES ($1, $2)",
      [pedido.id, sku],
    );

    let situacao = pedido.situacao;
    if (situacao === "ABERTO") {
      await client.query(
        "UPDATE pedidos SET situacao = 'EM_CONFERENCIA' WHERE id = $1",
        [pedido.id],
      );
      situacao = "EM_CONFERENCIA";
    }

    await client.query("COMMIT");
    res.status(201).json({ numero, sku, situacao });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

// Consultar conferência
pedidosRouter.get("/:numero/conferencia", async (req, res) => {
  const pedido = await buscarPedido(pool, req.params.numero);
  if (!pedido) {
    return res
      .status(404)
      .json({ erro: `Pedido ${req.params.numero} não encontrado.` });
  }

  const conferencia = await carregarConferencia(pool, pedido.id);

  res.json({
    numero: pedido.numero,
    situacao: pedido.situacao,
    ...conferencia,
  });
});

// Fechar conferência
pedidosRouter.post("/:numero/fechamento", async (req, res) => {
  const numero = req.params.numero;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT id, situacao FROM pedidos WHERE numero = $1 FOR UPDATE",
      [numero],
    );
    const pedido = rows[0];

    if (!pedido) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: `Pedido ${numero} não encontrado.` });
    }
    if (pedido.situacao === "CONFERIDO") {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ erro: `Pedido ${numero} já foi conferido.` });
    }

    const conferencia = await carregarConferencia(client, pedido.id);

    if (!conferencia.podeFechar) {
      await client.query("ROLLBACK");
      return res.status(422).json({
        erro: "A conferência tem divergências e não pode ser fechada.",
        divergencias: {
          itens: conferencia.itens.filter((item) => item.status !== "OK"),
          estranhos: conferencia.estranhos,
        },
      });
    }

    await client.query(
      "UPDATE pedidos SET situacao = 'CONFERIDO', fechado = now() WHERE id = $1",
      [pedido.id],
    );
    await client.query("COMMIT");

    res.json({
      numero,
      situacao: "CONFERIDO",
      mensagem: "Conferência fechada com sucesso.",
    });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});
