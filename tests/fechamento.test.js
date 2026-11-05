import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import request from "supertest";
import { app } from "../src/app.js";
import { pool } from "../src/db.js";

// ---------- Preparação ----------

beforeAll(async () => {
  const sql = fs.readFileSync("migrations/001_init.sql", "utf8");
  await pool.query(sql);
});

beforeEach(async () => {
  await pool.query("TRUNCATE leituras, item_pedido, pedidos RESTART IDENTITY");
});

afterAll(async () => {
  await pool.end();
});

// ---------- Funções de apoio ----------

function criarPedido(numero, itens) {
  return request(app).post("/pedidos").send({ numero, itens });
}

function registrarLeitura(numero, sku) {
  return request(app).post(`/pedidos/${numero}/leituras`).send({ sku });
}

function fechar(numero) {
  return request(app).post(`/pedidos/${numero}/fechamento`);
}

const itensDoEnunciado = [
  { sku: "SSD-1TB-KG", quantidade: 2 },
  { sku: "MEM-16-DDR5", quantidade: 2 },
  { sku: "FNT-650W", quantidade: 1 },
  { sku: "GAB-AIR-01", quantidade: 1 },
];

// ---------- Testes ----------

describe("Fechamento da conferência", () => {
  it("recusa fechar o cenário do enunciado e informa as divergências", async () => {
    await criarPedido("50231", itensDoEnunciado);
    const leituras = [
      "SSD-1TB-KG",
      "mem-16-ddr5",
      "SSD-1TB-KG ",
      "FNT-650W",
      "BRD-ADESIVO",
      "FNT-650W",
      "CBL-HDMI-2M",
    ];
    for (const sku of leituras) {
      await registrarLeitura("50231", sku);
    }

    const resposta = await fechar("50231");

    expect(resposta.status).toBe(422);
    expect(resposta.body.divergencias.itens).toEqual([
      { sku: "MEM-16-DDR5", esperada: 2, lida: 1, status: "FALTANDO 1" },
      { sku: "FNT-650W", esperada: 1, lida: 2, status: "SOBRANDO 1" },
      { sku: "GAB-AIR-01", esperada: 1, lida: 0, status: "FALTANDO 1" },
    ]);
    expect(resposta.body.divergencias.estranhos).toEqual([
      { sku: "BRD-ADESIVO", quantidade: 1 },
      { sku: "CBL-HDMI-2M", quantidade: 1 },
    ]);

    const pedido = await request(app).get("/pedidos/50231");
    expect(pedido.body.situacao).toBe("EM_CONFERENCIA");
  });

  it("fecha quando tudo bate e muda a situação para CONFERIDO", async () => {
    await criarPedido("100", [{ sku: "SSD-1TB-KG", quantidade: 2 }]);
    await registrarLeitura("100", " ssd-1tb-kg");
    await registrarLeitura("100", "SSD-1TB-KG ");

    const resposta = await fechar("100");

    expect(resposta.status).toBe(200);
    expect(resposta.body.situacao).toBe("CONFERIDO");

    const pedido = await request(app).get("/pedidos/100");
    expect(pedido.body.situacao).toBe("CONFERIDO");
    expect(pedido.body.fechado).not.toBeNull();
  });

  it("não aceita leitura depois de fechado", async () => {
    await criarPedido("101", [{ sku: "SSD-1TB-KG", quantidade: 1 }]);
    await registrarLeitura("101", "SSD-1TB-KG");
    await fechar("101");

    const resposta = await registrarLeitura("101", "SSD-1TB-KG");

    expect(resposta.status).toBe(409);
  });

  it("não fecha o mesmo pedido duas vezes", async () => {
    await criarPedido("102", [{ sku: "SSD-1TB-KG", quantidade: 1 }]);
    await registrarLeitura("102", "SSD-1TB-KG");
    await fechar("102");

    const resposta = await fechar("102");

    expect(resposta.status).toBe(409);
  });

  it("recusa fechar pedido sem nenhuma leitura", async () => {
    await criarPedido("103", [{ sku: "SSD-1TB-KG", quantidade: 1 }]);

    const resposta = await fechar("103");

    expect(resposta.status).toBe(422);
    expect(resposta.body.divergencias.itens[0].status).toBe("FALTANDO 1");
  });

  it("retorna 404 ao fechar pedido inexistente", async () => {
    const resposta = await fechar("999");

    expect(resposta.status).toBe(404);
  });
});

describe("Situação do pedido", () => {
  it("vai de ABERTO para EM_CONFERENCIA na primeira leitura", async () => {
    const criado = await criarPedido("200", [
      { sku: "SSD-1TB-KG", quantidade: 1 },
    ]);
    expect(criado.body.situacao).toBe("ABERTO");

    const leitura = await registrarLeitura("200", "SSD-1TB-KG");
    expect(leitura.body.situacao).toBe("EM_CONFERENCIA");
  });
});
