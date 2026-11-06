1.1 Qual foi o sistema ou projeto mais complexo em que você trabalhou (profissional, faculdade ou pessoal)? Qual era
a sua parte, especificamente? Conte uma decisão técnica que você tomou nele e o que faria diferente hoje.

O projeto mais complexo que fiz foi o TypeBattle um teste de digitação com ranking e batalhas multiplayer em tempo real, que desenvolvi sozinho, do front ao back. O front é em React com Vite e MUI, hospedado na Vercel, e o back é em Express com Socket.IO, Prisma e PostgreSQL, hospedado no Railway. Tem cadastro e login com JWT.

A parte mais difícil foi a batalha online com Socket.IO, que tem salas de 2 a 4 jogadores e partidas em melhor de 1, 3 ou 5. Uma decisão que tomei foi deixar o servidor gerar o texto e calcular a pontuação, em vez do navegador: assim todos recebem o mesmo texto e ninguém consegue trapacear enviando um resultado falso.

## Hoje eu quebraria as páginas do front em mais componentes. Algumas ficaram grandes, com muita lógica junta, o que dificulta a manutenção e o reaproveitamento.

1.2 Conte um bug difícil que você investigou. Como você chegou à causa (logs, debugger, hipóteses descartadas)?
Como confirmou que estava resolvido?

Tive um caso bem marcante no projeto Avaliae durante um code review. O revisor relatou que, ao tirar e confirmar uma foto, o app fechava e voltava para a splash screen. O maior desafio inicial é que o bug não acontecia no meu celular nem no emulador.
Comecei isolando o ambiente. Minha primeira hipótese foi a opção 'Não manter atividades' do Android estar ativada no aparelho dele, mas descartamos isso rápido. Em seguida, notei uma diferença de sistema operacional o dele era Android 11(Android 11 Xiaomi Mi9 SE) e o meu Android 15. Isso me deu a pista de que a gestão de recursos do sistema era diferente.
Fui investigar a fundo a biblioteca de captura. Notei que, ao confirmar, a foto era carregada inteira na RAM em resolução nativa antes da compressão. Em aparelhos com limite de RAM mais restrito no Android 11, o sistema operacional simplesmente matava o processo por Out of Memory. Ajustei a captura para aplicar a compressão e otimizar o uso da memória RAM logo na leitura. Pedimos para o revisor retestar no mesmo aparelho e o fluxo rodou liso, sem estourar a memória. Validamos em outros aparelhos antigos.

---

1.3 Na sua opinião, o que um sistema de gestão de empresas (ERP) deveria ter? Pense em funcionalidades, em quem
usa o sistema no dia a dia e no que separa um sistema bom de um sistema que as pessoas só toleram.

O sistema deveria ter essas funcionalidades

-Financeiro: controle de contas a pagar e receber, fluxo de caixa e emissão de notas fiscais.
-Estoque: controle de produtos, entradas, saídas e alertas de estoque baixo.
-Vendas: cadastro de clientes, pedidos e acompanhamento de vendas.
-Compras: controle de fornecedores, pedidos de compra.
-RH: cadastro de funcionários, controle de ponto e folha de pagamento.
-Relatórios: dashboards com gráficos e indicadores de desempenho.
-Gestão de usuários: controle de acesso e permissões por funcionário.

## Na minha opinião um bom sistema ERP deve centralizar as informações da empresa, integrando todos os setores. O sistema também deve ter uma interface intuitiva, ser rapido e segura.

Code review
a) Liste os problemas que você encontrou em ordem de gravidade (o que causaria mais prejuízo para a empresa
primeiro). Para cada um, diga em uma ou duas frases qual seria o efeito real em produção.

1-SQL injection. O id do pedido e o SKU são colados direto no SQL. Alguém pode mandar um id com um comando SQL e apagar ou vazar o banco inteiro.

2-Fatura sem ter estoque. Se o saldo não é suficiente, a função só pula a baixa, mas fatura o pedido mesmo assim. A empresa cobra o cliente por um produto que não tem para entregar.

3-Erro escondido. O catch responde ok: true mesmo quando algo falha, e não registra nada. Pedidos ficam pela metade e ninguém fica sabendo.

4-Sem transação. Se der erro no meio do loop, alguns itens já tiveram o estoque baixado, mas o pedido não foi faturado. Ao tentar de novo, esses itens são baixados duas vezes.

5-Faturamentos ao mesmo tempo. A função lê o saldo, calcula no código e grava o resultado. Se dois pedidos do mesmo produto forem faturados juntos, um sobrescreve o outro e uma baixa se perde, então o estoque fica maior que o real.

6-Não confere a situação do pedido. Nada impede faturar um pedido já faturado ou cancelado. Um clique duplo baixa o estoque duas vezes.

b) Reescreva a função (na linguagem que preferir, pode ser pseudocódigo) corrigindo os problemas que você
considera bloqueantes para o merge.

async function faturarPedido(req, res) {
const pedidoId = Number(req.params.id);
if (!Number.isInteger(pedidoId)) {
return res.status(400).json({ ok: false, erro: 'ID de pedido inválido.' });
}

const client = await pool.connect();
try {
await client.query('BEGIN');

    const { rows: pedidos } = await client.query(
      'SELECT situacao FROM pedidos WHERE id = $1 FOR UPDATE',
      [pedidoId]
    );
    if (pedidos.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, erro: 'Pedido não encontrado.' });
    }
    if (pedidos[0].situacao !== 'Aberto') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        ok: false,
        erro: `Pedido está ${pedidos[0].situacao} e não pode ser faturado.`,
      });
    }

    const { rows: itens } = await client.query(
      'SELECT sku, qtd FROM itens_pedido WHERE id_pedido = $1 ORDER BY sku',
      [pedidoId]
    );
    if (itens.length === 0) {
      await client.query('ROLLBACK');
      return res.status(422).json({ ok: false, erro: 'Pedido sem itens.' });
    }

    for (const item of itens) {
      const resultado = await client.query(
        'UPDATE estoque SET saldo = saldo - $1 WHERE sku = $2 AND saldo >= $1',
        [item.qtd, item.sku]
      );
      if (resultado.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(422).json({
          ok: false,
          erro: `Estoque insuficiente para o SKU ${item.sku}.`,
        });
      }
    }

    const { rows } = await client.query(
      'SELECT SUM(qtd * valor_unit) AS total FROM itens_pedido WHERE id_pedido = $1',
      [pedidoId]
    );
    const total = rows[0].total;

    await client.query(
      "UPDATE pedidos SET situacao = 'Faturado', total = $1 WHERE id = $2",
      [total, pedidoId]
    );

    await client.query('COMMIT');
    res.json({ ok: true, total });

} catch (e) {
await client.query('ROLLBACK');
console.error(`Erro ao faturar pedido ${pedidoId}:`, e);
res.status(500).json({ ok: false, erro: 'Erro ao faturar o pedido.' });
} finally {
client.release();
}
}

Fechamento
Copie e responda no final do
RESPOSTAS.md:
5.1 Quanto tempo de trabalho, aproximadamente, você levou em cada parte?
Parte 1 = 30 min
Parte 2 = 3:30 hrs
Parte 3 = 40 min
Parte 4 = 1 hr
5.2 O que você deixou de fora ou faria diferente com mais tempo?
eu faria uma tela simples para o separador bipar os produtos e ver a conferência atualizando na hora tambem
uma forma de estornar uma leitura feita por engano, porque hoje um bipe errado não tem como ser desfeito e
o registro de quem fez cada leitura e quem fechou a conferência.
5.3 Qual foi a parte mais difícil? Onde você travou?
A parte mais difícil foi a Parte 2, a API.
5.4 Que sites/materiais você consultou?
documentação do Express
documentação do node-postgres
documentação do PostgreSQL
documentação do Vitest e do Supertest
documentação do Docker e a página de releases do WSL no GitHub
documentação do Railway, para o deploy
https://venda.amazon.com.br/sellerblog/o-que-e-sku-do-produto-e-qual-a-importancia-de-utilizar-esse-codigo (para ver oq erra sku)
5.5 Declaro que NÃO usei ferramentas de IA neste desafio: (X) Concordo Nome:Gustavo Frazzon
