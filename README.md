# API de Conferência de Pedidos

Desafio técnico
API que confere se os produtos bipados na expedição batem com o pedido.

**Stack:** Node.js · Express · PostgreSQL (Docker) · Vitest

## Como rodar

Pré-requisitos: Node.js 20.6+ e Docker.

```bash
npm install
cp .env.example .env
docker compose up -d
npm run migrate
npm run dev
```
crie o arquivo ".env.example" e cole=
DATABASE_URL=postgres://app:app@localhost:5433/conferencia
PORT=3000

A API sobe em `http://localhost:3000`.

## Como testar

Crie o banco de testes (só na primeira vez):

```bash
docker compose exec db createdb -U app conferencia_test
```

Rode os testes:

```bash
npm test
```

## Rotas

| Método | Rota                           | Descrição            |
| ------ | ------------------------------ | -------------------- |
| POST   | `/pedidos`                     | Cria pedido          |
| GET    | `/pedidos/:numero`             | Consulta pedido      |
| POST   | `/pedidos/:numero/leituras`    | Registra leitura     |
| GET    | `/pedidos/:numero/conferencia` | Consulta conferência |
| POST   | `/pedidos/:numero/fechamento`  | Fecha conferência    |

Exemplos de todas as requisições em [`requests.http`](requests.http).

```bash
curl -X POST http://localhost:3000/pedidos \
  -H "Content-Type: application/json" \
  -d '{"numero":"50231","itens":[{"sku":"SSD-1TB-KG","quantidade":2}]}'

curl -X POST http://localhost:3000/pedidos/50231/leituras \
  -H "Content-Type: application/json" \
  -d '{"sku":"ssd-1tb-kg"}'

curl http://localhost:3000/pedidos/50231/conferencia

curl -X POST http://localhost:3000/pedidos/50231/fechamento
```

## Cenário

**Conferência** (`GET /pedidos/50231/conferencia`):

```json
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 414
ETag: W/"19e-PUnur1OvGkDUYEoU2UgKpoEQXPg"
Date: Thu, 05 Nov 2026 17:58:27 GMT
Connection: close
{
  "numero": "50231",
  "situacao": "EM_CONFERENCIA",
  "itens": [
    {
      "sku": "SSD-1TB-KG",
      "esperada": 2,
      "lida": 2,
      "status": "OK"
    },
    {
      "sku": "MEM-16-DDR5",
      "esperada": 2,
      "lida": 1,
      "status": "FALTANDO 1"
    },
    {
      "sku": "FNT-650W",
      "esperada": 1,
      "lida": 2,
      "status": "SOBRANDO 1"
    },
    {
      "sku": "GAB-AIR-01",
      "esperada": 1,
      "lida": 0,
      "status": "FALTANDO 1"
    }
  ],
  "estranhos": [
    {
      "sku": "BRD-ADESIVO",
      "quantidade": 1
    },
    {
      "sku": "CBL-HDMI-2M",
      "quantidade": 1
    }
  ],
  "podeFechar": false
}
```

**Fechamento** (`POST /pedidos/50231/fechamento`) é recusado com **422**:

```json
HTTP/1.1 422 Unprocessable Entity
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 377
ETag: W/"179-DtbnTrphOo0O2lGHJ3/peyDrUMc"
Date: Thu, 05 Nov 2026 17:57:19 GMT
Connection: close

{
  "erro": "A conferência tem divergências e não pode ser fechada.",
  "divergencias": {
    "itens": [
      {
        "sku": "MEM-16-DDR5",
        "esperada": 2,
        "lida": 1,
        "status": "FALTANDO 1"
      },
      {
        "sku": "FNT-650W",
        "esperada": 1,
        "lida": 2,
        "status": "SOBRANDO 1"
      },
      {
        "sku": "GAB-AIR-01",
        "esperada": 1,
        "lida": 0,
        "status": "FALTANDO 1"
      }
    ],
    "estranhos": [
      {
        "sku": "BRD-ADESIVO",
        "quantidade": 1
      },
      {
        "sku": "CBL-HDMI-2M",
        "quantidade": 1
      }
    ]
  }
}
```

## Decisões

- SQL puro com `pg`, sem ORM.
- `numero` do pedido é texto e único no banco.
- SKU repetido no mesmo pedido é rejeitado.
- SKU é normalizado (`trim` + maiúsculas) na criação e na leitura.
- Leitura de SKU fora do pedido é aceita e aparece como estranha na conferência.
- A regra de conferência fica em uma função separada (`src/conferencia.js`)
- Status HTTP: 400 dados inválidos, 404 não encontrado, 409 situação não permite, 422 conferência com divergências.

## Com mais tempo eu faria

- Ferramenta de migrations .
- API também no Docker, subindo tudo com um comando.
- Estorno de leitura feita por engano.
- Registro de quem fez cada leitura e quem fechou.
- Uma tela simples para o digitar o SKU
