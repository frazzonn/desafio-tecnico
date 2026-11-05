export function calcularConferencia(itens, leituras) {
  const lidos = new Map();
  for (const sku of leituras) {
    lidos.set(sku, (lidos.get(sku) ?? 0) + 1);
  }

  const resultadoItens = itens.map((item) => {
    const lida = lidos.get(item.sku) ?? 0;
    const diferenca = lida - item.quantidade;

    let status;
    if (diferenca === 0) {
      status = "OK";
    } else if (diferenca < 0) {
      status = `FALTANDO ${-diferenca}`;
    } else {
      status = `SOBRANDO ${diferenca}`;
    }

    return {
      sku: item.sku,
      esperada: item.quantidade,
      lida,
      status,
    };
  });

  const skusDoPedido = new Set(itens.map((item) => item.sku));
  const estranhos = [];
  for (const [sku, quantidade] of lidos) {
    if (!skusDoPedido.has(sku)) {
      estranhos.push({ sku, quantidade });
    }
  }

  const todosOk = resultadoItens.every((item) => item.status === "OK");
  const podeFechar = todosOk && estranhos.length === 0;

  return { itens: resultadoItens, estranhos, podeFechar };
}
