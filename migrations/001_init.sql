CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    numero TEXT NOT NULL UNIQUE,
    situacao TEXT NOT NULL DEFAULT 'ABERTO'
        CHECK (situacao IN ('ABERTO', 'EM_CONFERENCIA', 'CONFERIDO')),
    criado TIMESTAMPTZ NOT NULL DEFAULT now(),
    fechado TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS item_pedido  (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
    sku Text NOT NULL CHECK (sku <> ''),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    UNIQUE (pedido_id, sku)
);
CREATE TABLE IF NOT EXISTS  leituras (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
    sku Text NOT NULL CHECK (sku <> ''),
    lido TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leituras_pedido_id ON leituras(pedido_id);