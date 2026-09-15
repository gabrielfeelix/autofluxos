# Plano: o CRM do AutoFluxos vira funil de verdade

> Decisão em `docs/MODELO-CRM.md`. Aqui é a ordem de execução — o que entra em
> cada camada, o que fica de fora, e onde é possível colidir com o agente que
> está no inbox.

## O que mudou na decisão depois da conversa

**Funil não é um. São vários, encadeados.** Cada empresa parte o processo onde
quiser: o SDR tem o quadro dele, termina, e a pessoa passa para o quadro do
vendedor; o vendedor fecha, e a pessoa passa para o quadro de pós-venda, onde se
oferece outro produto ou a renovação.

A peça que resolve isso é uma só: **`quadros.seguinte_id`** — "quando um cartão
é ganho aqui, ele abre um cartão lá, na primeira etapa". Sem tipo fixo de
quadro, sem "funil de SDR" codificado. Quem desenha a cadeia é o cliente:

```
Captação (SDR)  --ganho-->  Vendas  --ganho-->  Pós-venda  --ganho--> (fim)
```

Três motivos para ser `seguinte_id` e não um tipo com regra de negócio dentro:

1. quem só vende de um jeito não configura nada e nunca vê a palavra "SDR";
2. quem tem três times encadeia três quadros sem a gente prever a combinação;
3. a passagem é **o mesmo gesto que já existe** — ganhar. Não inventa botão.

O cartão antigo não some ao passar: ele fica `ganha` no quadro do SDR, que é
como o SDR vê o próprio resultado no fim do mês. O novo cartão nasce no quadro
seguinte com o mesmo contato e o mesmo responsável.

## Onde isto está (15/set/2026, fim da tarde)

**Pronto e verde.** As cinco camadas estão no `main`, a `0058` foi aplicada em
produção, e a suíte inteira passa (1635 testes).

Aplicar cedo pagou: dois defeitos só apareceram contra o banco de verdade, e
nenhum dos dois tem como aparecer em teste puro.

- `af_usuarios` tem a coluna **`name`**, não `nome` — é tabela do plugin de
  login, e o nome dela é em inglês. O cartão inteiro deixava de listar por
  causa disso (`column af_usuarios_1.nome does not exist`).
- semear os motivos com `upsert ... on conflict (client_id, nome)` falha em
  silêncio: o índice da tabela é sobre `lower(trim(nome))`, uma **expressão**, e
  `on conflict` não casa com índice de expressão. A lista abria vazia, que é
  exatamente o que a semeadura existe para impedir. Agora é `insert` tolerante
  a duplicata seguido de releitura.

## Ordem de execução

Cada camada é um commit e se sustenta sozinha.

### Camada 1 — banco (`supabase/migrations/0058_crm_funil.sql`)

Só o arquivo. **Nada aplicado em produção** — o projeto é dividido com a
Verandi e a aplicação exige autorização explícita.

- `contacts`: `estagio`, `estagio_mudou_em`, `ultima_mensagem_em`
- `quadros`: `seguinte_id` (auto-referência, `on delete set null`)
- `quadro_colunas`: `tipo` (`normal` · `ganho` · `perdido`), `limite_de_dias`
- `quadro_cartoes`: `titulo`, `valor`, `responsavel`, `situacao`, `motivo`,
  `fechado_em`
- `motivos_de_perda` — lista curta por conta, editável
- `eventos_do_contato` — a linha do tempo

### Camada 2 — `src/core/crm.ts`, puro e com teste

Estágios e transições permitidas; qual estágio um fato produz; conferência de
valor e de motivo; detecção de ciclo no encadeamento de quadros; soma por etapa;
LTV e recorrência a partir dos cartões ganhos; texto dos eventos.

### Camada 3 — repositórios

`repos/eventos.ts` (escrever e ler a linha do tempo), `repos/motivos-de-perda.ts`
e a extensão de `repos/quadros.ts`: fechar, reabrir, atribuir, editar título e
valor, encadear, e `listarCartoes` devolvendo os campos novos.

### Camada 4 — as regras automáticas

- mensagem recebida → `ultima_mensagem_em`, contato novo entra no quadro padrão,
  estágio `novo`;
- cartão ganho → contato vira `cliente`, evento gravado, cartão aberto no quadro
  seguinte quando ele existe;
- cartão perdido → estágio `perdido` se não sobrou cartão aberto;
- cliente sem conversa há 90 dias → `inativo` (cron que já existe).

### Camada 5 — a tela

Cartão com valor, responsável, última mensagem e alerta de parado; menu do
cartão com ganhar, perder, atribuir e mover; cabeçalho da coluna com soma dos
abertos; painel lateral do contato com a linha do tempo.

## Onde não encostar

O outro agente está no inbox. **Arquivos dele, proibidos aqui:**
`src/app/clientes/[clienteId]/inbox/**`, `src/app/clientes/[clienteId]/leads/**`,
`src/components/lead/**`, `src/app/api/webhook/whatsapp/route.ts`.

O painel do contato nasce em `src/components/quadros/`, não na página de lead —
é o que evita dois agentes editando o mesmo arquivo hoje.

## Fora do escopo, de novo

Catálogo de produto, proposta, contrato, assinatura com cobrança, tarefa humana.
Follow-up é mensagem agendada, que já existe na `0057`.
