import { describe, it, expect } from "vitest";
import { calcularConferencia } from "../src/conferencia.js";

const itensDoEnunciado = [
  { sku: "SSD-1TB-KG", quantidade: 2 },
  { sku: "MEM-16-DDR5", quantidade: 2 },
  { sku: "FNT-650W", quantidade: 1 },
  { sku: "GAB-AIR-01", quantidade: 1 },
];

describe("calcularConferencia", () => {
  it("calcula o cenário do enunciado", () => {
    const leituras = [
      "SSD-1TB-KG",
      "MEM-16-DDR5",
      "SSD-1TB-KG",
      "FNT-650W",
      "BRD-ADESIVO",
      "FNT-650W",
      "CBL-HDMI-2M",
    ];

    const resultado = calcularConferencia(itensDoEnunciado, leituras);

    expect(resultado.itens).toEqual([
      { sku: "SSD-1TB-KG", esperada: 2, lida: 2, status: "OK" },
      { sku: "MEM-16-DDR5", esperada: 2, lida: 1, status: "FALTANDO 1" },
      { sku: "FNT-650W", esperada: 1, lida: 2, status: "SOBRANDO 1" },
      { sku: "GAB-AIR-01", esperada: 1, lida: 0, status: "FALTANDO 1" },
    ]);
    expect(resultado.estranhos).toEqual([
      { sku: "BRD-ADESIVO", quantidade: 1 },
      { sku: "CBL-HDMI-2M", quantidade: 1 },
    ]);
    expect(resultado.podeFechar).toBe(false);
  });

  it("permite fechar quando tudo bate", () => {
    const leituras = [
      "SSD-1TB-KG",
      "SSD-1TB-KG",
      "MEM-16-DDR5",
      "MEM-16-DDR5",
      "FNT-650W",
      "GAB-AIR-01",
    ];

    const resultado = calcularConferencia(itensDoEnunciado, leituras);

    expect(resultado.itens.every((item) => item.status === "OK")).toBe(true);
    expect(resultado.estranhos).toEqual([]);
    expect(resultado.podeFechar).toBe(true);
  });

  it("marca tudo como FALTANDO quando não há leituras", () => {
    const resultado = calcularConferencia(itensDoEnunciado, []);

    expect(resultado.itens.map((item) => item.status)).toEqual([
      "FALTANDO 2",
      "FALTANDO 2",
      "FALTANDO 1",
      "FALTANDO 1",
    ]);
    expect(resultado.podeFechar).toBe(false);
  });

  it("não permite fechar se houver SKU estranho, mesmo com os itens OK", () => {
    const leituras = [
      "SSD-1TB-KG",
      "SSD-1TB-KG",
      "MEM-16-DDR5",
      "MEM-16-DDR5",
      "FNT-650W",
      "GAB-AIR-01",
      "CBL-HDMI-2M",
    ];

    const resultado = calcularConferencia(itensDoEnunciado, leituras);

    expect(resultado.itens.every((item) => item.status === "OK")).toBe(true);
    expect(resultado.estranhos).toEqual([
      { sku: "CBL-HDMI-2M", quantidade: 1 },
    ]);
    expect(resultado.podeFechar).toBe(false);
  });
});
