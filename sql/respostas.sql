-- Dialeto: PostgreSQL


-- a) Faturamento por mês em 2026 (apenas pedidos Faturado)

SELECT
    DATE_TRUNC('month', p.data_emissao)::date AS mes,
    COUNT(DISTINCT p.id)                      AS quantidade_pedidos,
    SUM(i.qtd * i.valor_unit)                 AS valor_total
FROM pedidos p
JOIN itens_pedido i ON i.id_pedido = p.id
WHERE p.situacao = 'Faturado'
  AND p.data_emissao >= '2026-01-01'
  AND p.data_emissao <  '2027-01-01'
GROUP BY DATE_TRUNC('month', p.data_emissao)
ORDER BY mes;


-- b) Clientes com mais de 3 pedidos faturados em 2026 e ticket médio acima de R$ 1.500

WITH valor_pedido AS (
    SELECT p.id, p.id_cliente, SUM(i.qtd * i.valor_unit) AS valor
    FROM pedidos p
    JOIN itens_pedido i ON i.id_pedido = p.id
    WHERE p.situacao = 'Faturado'
      AND p.data_emissao >= '2026-01-01'
      AND p.data_emissao <  '2027-01-01'
    GROUP BY p.id, p.id_cliente
)
SELECT
    c.nome,
    COUNT(*)                AS quantidade_pedidos,
    ROUND(AVG(v.valor), 2)  AS ticket_medio
FROM valor_pedido v
JOIN clientes c ON c.id = v.id_cliente
GROUP BY c.id, c.nome
HAVING COUNT(*) > 3
   AND AVG(v.valor) > 1500;


-- c) Último pedido faturado de cada cliente

WITH ultimo AS (
    SELECT
        p.id,
        p.id_cliente,
        p.data_emissao,
        ROW_NUMBER() OVER (
            PARTITION BY p.id_cliente
            ORDER BY p.data_emissao DESC, p.id DESC
        ) AS posicao
    FROM pedidos p
    WHERE p.situacao = 'Faturado'
)
SELECT
    c.nome,
    u.id                      AS id_pedido,
    u.data_emissao,
    SUM(i.qtd * i.valor_unit) AS valor_pedido
FROM ultimo u
JOIN clientes c     ON c.id = u.id_cliente
JOIN itens_pedido i ON i.id_pedido = u.id
WHERE u.posicao = 1
GROUP BY c.nome, u.id, u.data_emissao
ORDER BY c.nome;


-- d) Índices para deixar a consulta (a) mais rápida
--
-- CREATE INDEX idx_pedidos_situacao_data ON pedidos (situacao, data_emissao);
--   A consulta filtra por situação e por um intervalo de datas. Com esse índice,
--   o banco vai direto aos pedidos "Faturado".
--
-- CREATE INDEX idx_itens_pedido_pedido ON itens_pedido (id_pedido);
--   O JOIN busca os itens de cada pedido. 
--
-- O que pode impedir o uso do índice:
--   Usar função na coluna, por exemplo WHERE EXTRACT(YEAR FROM data_emissao) = 2026.
--   O índice guarda a data, não o ano, então o banco precisa calcular a função
--   para todas as linhas. 