# Magento no bot: cross-sell com catálogo ao vivo: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:executing-plans
> (inline, neste projeto não se implementa por subagente). Passos em checkbox
> (`- [ ]`) para acompanhar.

**Objetivo:** o bot do cliente que usa Magento consulta a loja dele durante a
conversa, diz preço e disponibilidade reais, recomenda o que o próprio lojista
marcou como "combina com", e manda o link do produto. Numa segunda fase, com
token de administrador, sabe a quantidade exata em estoque.

**Arquitetura:** a loja entra como uma **integração por cliente**
(`public.lojas_integradas`) atrás de um adaptador (`src/loja/`), no mesmo
desenho do `adaptador-do-canal.ts`. O bot ganha duas ferramentas novas de
leitura (`loja_buscar`, `loja_combina_com`) que, em vez de uma URL fixa, são
executadas no servidor pelo adaptador. Toda chamada de rede passa pelo
`chamarHttp` que já existe, e com ele vêm de graça a trava de endereço interno
(SSRF), o prazo e a reconferência de redirecionamento.

**Stack:** Next.js (App Router, ler `node_modules/next/dist/docs/` antes de
mexer em rota/página), Supabase (`public`), Vitest, Magento 2.4 GraphQL e REST.

**Base:** `docs/INTEGRACAO-MAGENTO-23-SET.md` (a pesquisa) e o item "Cross-sell"
de `docs/PLANO-23-SET-O-QUE-CONSTRUIR.md`.

---

## Decisões (tomadas, não reabrir sem motivo novo)

1. **Ao vivo, não sincronizado.** O bot pergunta à loja na hora. Copiar o
   catálogo para `public.produtos` criaria uma segunda verdade de preço e
   estoque (o argumento da 0079) e um processo de sincronização que precisa
   decidir o que apagar. Não apagar é regra deste plano, então não sincroniza.
2. **Só leitura, nas duas fases.** Nenhuma chamada deste plano cria, altera ou
   apaga nada na loja. Pedido, carrinho e reserva de estoque ficam fora. O bot
   manda o link e o cliente final fecha a compra na loja.
3. **Fase 1 sem credencial nenhuma.** A busca GraphQL do Magento é pública. O
   lojista só informa o endereço da loja.
4. **Fase 2 é opcional e desligável.** Token de administrador só serve para
   quantidade exata. Sem ele, ou com ele falhando, o bot continua respondendo
   com "tem / não tem" da fase 1. Nada depende do token para funcionar.
5. **A garantia de "só leitura" é o nosso código, não o escopo do token.** O
   controle de acesso do Magento (ACL) não separa leitura de escrita na maior
   parte dos recursos: quem dá acesso a "Produtos" dá os dois. Por isso o
   cliente de administrador (`src/loja/magento-admin.ts`) **não tem parâmetro de
   método**: só sabe fazer `GET`, e só para os caminhos de uma lista fixa. Um
   teste lê o próprio arquivo e falha se aparecer outro verbo.
6. **Token no cofre, pelo caminho que já existe.** Ele vira uma Conexão
   (`public.connections`, tipo `bearer`), e o valor mora no Vault. Desconectar
   apaga a Conexão, e o gatilho da 0006 apaga o segredo junto. Não há tabela
   nova de segredo.
7. **O termo de busca nunca entra no texto da query.** Vai como variável
   GraphQL (`$termo`). Montar a query por concatenação abriria injeção de
   GraphQL a partir do que o cliente final digita no WhatsApp.
8. **Migration aditiva, uma só.** Tabela nova, nenhuma coluna alterada em
   tabela existente, nenhum dado reescrito. As colunas da fase 2 nascem já na
   fase 1, anuláveis/desligadas, pelo motivo da 0066: mexer uma vez em produção
   em vez de duas.
9. **Nasce desligada.** `ativa = false` por padrão. Aplicar a migration ou fazer
   deploy não muda o comportamento de nenhuma conta. Quem liga é o dono, na
   tela, depois de um teste que deu certo.

## Restrições globais

- Banco: ler `docs/BANCO-COMPARTILHADO.md` antes da Task 2. Tudo em `public.`,
  qualificado. Nunca `supabase db push`/`db reset` contra produção. Aplicar em
  produção **só com autorização explícita do Gabriel**, pela Management API,
  depois do ensaio em transação.
- Número da migration: descobrir com `ls supabase/migrations | tail -1` na hora.
  Neste plano ela aparece como `0092` porque a última hoje é a `0091`.
- **Migration primeiro, deploy depois** (lição da 0071): o push na `main` é o
  deploy, e o código da Task 5 lê a tabela nova.
- Segredo (token do Magento) nunca em log, doc, commit, resposta de erro ou
  estado do navegador. Só o nome da Conexão aparece na tela.
- Sem travessão em nenhum arquivo. Vírgula, dois-pontos ou frase nova.
- Validação: `npm run typecheck` e o arquivo de teste da task
  (`npx vitest run --config vitest.unit.config.ts <arquivo>`). Não rodar a suíte
  inteira.
- Commit e push na `main` ao fim de cada task.

## Foco de revisão (o que os testes das tasks não cobrem sozinhos)

1. **Loja lenta ou fora do ar no meio da conversa**: o bot não pode travar nem
   inventar. Esperado: `nao_sei` com motivo legível e a conversa segue para
   pessoa, como qualquer ferramenta que falha. Teste na Task 5.
2. **Produto sem preço** (`final_price` ausente ou zero por configuração de
   grupo de cliente): nunca anunciar "R$ 0,00". Esperado: `preco` ausente, e a
   descrição da ferramenta manda o bot dizer que vai confirmar o valor. Teste na
   Task 3.
3. **Lojista troca o endereço para um IP interno ou `http://`**: recusado ao
   salvar e de novo em cada chamada (o `chamarHttp` reconfere). Teste na Task 3
   e na Task 6.
4. **Termo com aspas, chaves ou texto de "ignore as instruções"**: vai como
   variável, a query não muda. Teste na Task 3.
5. **Token revogado pelo lojista na fase 2**: o bot volta a "tem / não tem" sem
   erro visível para o cliente final, e a tela de integração mostra que o token
   parou de funcionar. Teste na Task 9.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0092_lojas_integradas.sql` | tabela da integração |
| `src/core/loja.ts` | regra pura: endereço, query, tradução da resposta, link |
| `src/loja/types.ts` | interface `Loja` e tipos neutros |
| `src/loja/magento.ts` | fase 1: GraphQL público |
| `src/loja/magento-admin.ts` | fase 2: REST, só `GET`, lista fixa |
| `src/loja/falsa.ts` | loja em memória para teste |
| `src/server/repos/lojas.ts` | ler/gravar `lojas_integradas` |
| `src/server/adaptador-da-loja.ts` | escolhe e monta o adaptador da conta |
| `src/core/ferramentas.ts` | `chamada` vira união; duas ferramentas novas |
| `src/server/ia/ferramentas-do-pedido.ts` | montar chamada só para `http` |
| `src/server/efeitos/resolver.ts` | executar ferramenta de loja; credencial só quando precisa |
| `src/server/acoes-loja.ts` | ações do servidor da tela (testar, salvar, ligar, token) |
| `src/app/clientes/[clienteId]/ajustes/integracoes/magento/page.tsx` | tela |
| `src/app/clientes/[clienteId]/ajustes/integracoes/page.tsx` | card do Magento |
| `src/components/editor/painel.tsx` | ferramentas agrupadas, aviso de loja desligada |
| `docs/GUIA-MAGENTO-LOJISTA.md` | o passo a passo que vai para o lojista (fase 2) |

---

# Fase 1: leitura pública

### Task 0: sondar a loja do cliente (portão, antes de qualquer código)

Sem esta resposta o resto do plano pode estar construindo para uma loja que
fechou o GraphQL. Leva cinco minutos.

> **Feita em 23/set/2026 na loja do cliente (PCYES, `https://www.pcyes.com.br`).**
> Resultado em `docs/INTEGRACAO-MAGENTO-23-SET.md`, seção "Sondagem". Resumo:
> GraphQL aberto, preço e estoque vêm, link sem sufixo, "combina com" quase
> vazio. Os passos abaixo ficam para a próxima loja.

- [x] **Passo 1: pedir ao Gabriel a URL da loja** (a home, com `https://`).

- [ ] **Passo 2: configuração da loja**

```bash
LOJA=https://www.lojadocliente.com.br
curl -s -G "$LOJA/graphql" \
  --data-urlencode 'query={storeConfig{store_code base_currency_code product_url_suffix secure_base_link_url}}' \
  -w '\nHTTP %{http_code}\n'
```

- [ ] **Passo 3: busca de produto com preço, estoque e recomendação**

```bash
curl -s -G "$LOJA/graphql" \
  --data-urlencode 'query=query($t:String!){products(search:$t,pageSize:3){total_count items{sku name url_key stock_status price_range{minimum_price{regular_price{value currency} final_price{value currency}}} crosssell_products{sku name} related_products{sku name}}}}' \
  --data-urlencode 'variables={"t":"<uma palavra que a loja vende>"}' \
  -w '\nHTTP %{http_code}\n'
```

- [ ] **Passo 4: registrar o resultado** em `docs/INTEGRACAO-MAGENTO-23-SET.md`,
  seção nova "Sondagem da loja do cliente", com data, código HTTP e o que veio.
  Nada de URL de admin, e-mail ou token lá.

| Resultado | O que quer dizer | Seguir? |
|---|---|---|
| 200 com `items` preenchidos | caminho barato funciona | sim |
| 200, `crosssell_products` e `related_products` vazios em todos | lojista não cadastrou "combina com" | sim, mas avisar: `loja_combina_com` vai responder vazio até ele cadastrar |
| 404 em `/graphql` | GraphQL desligado ou loja atrás de outra vitrine | **parar**, conversar com o Gabriel |
| 403 / página do Cloudflare | firewall barra robô | **parar**: o lojista precisa liberar; nossas chamadas saem da Vercel |
| 200 com `errors` | versão antiga (< 2.4) ou campo inexistente | **parar**, anotar a versão, ajustar a query da Task 3 |
| `final_price.value` 0 em produto que tem preço | preço por grupo de cliente | seguir; o bot já trata 0 como "sem preço" (Task 3) |

- [ ] **Passo 5: commit** `docs(magento): sondagem da loja do cliente` e push.

---

### Task 1: regra pura em `src/core/loja.ts`

Tudo que dá para testar sem rede: validar endereço, montar a query, traduzir a
resposta do Magento para um formato neutro, montar o link.

**Arquivos:**
- Criar: `src/core/loja.ts`
- Teste: `src/core/loja.test.ts`

**Interfaces produzidas:**

```ts
export type ProdutoDaLoja = {
  produtoId: string        // o SKU. Termina em "Id" de propósito: idsVistos o captura
  nome: string
  preco?: number           // ausente = não informado. Nunca 0 inventado
  precoDe?: number         // só quando há promoção de verdade (regular > final)
  emEstoque: boolean
  quantidade?: number      // só fase 2
  link: string
}
export function normalizarEndereco(entrada: string): { ok: true; endereco: string } | { ok: false; motivo: string }
export function linkDoProduto(endereco: string, urlKey: string, sufixo: string): string
export function traduzirProdutos(json: unknown, endereco: string, sufixo: string): ProdutoDaLoja[]
export function traduzirRecomendacoes(json: unknown, endereco: string, sufixo: string): ProdutoDaLoja[]
export const QUERY_BUSCA: string
export const QUERY_RECOMENDACOES: string
export const QUERY_CONFIG: string
export const LIMITE_DE_PRODUTOS = 5
```

- [ ] **Passo 1: teste que falha**

```ts
import { describe, expect, it } from 'vitest'
import {
  QUERY_BUSCA,
  linkDoProduto,
  normalizarEndereco,
  traduzirProdutos,
  traduzirRecomendacoes,
} from './loja'

const item = (sobre: Record<string, unknown> = {}) => ({
  sku: 'TAP-01',
  name: 'Tapete de yoga',
  url_key: 'tapete-de-yoga',
  stock_status: 'IN_STOCK',
  price_range: {
    minimum_price: {
      regular_price: { value: 199.9, currency: 'BRL' },
      final_price: { value: 149.9, currency: 'BRL' },
    },
  },
  ...sobre,
})
const resposta = (items: unknown[]) => ({ data: { products: { items } } })

describe('normalizarEndereco', () => {
  it('aceita https e tira barra e caminho do fim', () => {
    expect(normalizarEndereco('https://loja.com.br/')).toEqual({ ok: true, endereco: 'https://loja.com.br' })
    expect(normalizarEndereco(' https://loja.com.br/pt/ ')).toEqual({ ok: true, endereco: 'https://loja.com.br/pt' })
  })
  it('recusa http, sem protocolo, credencial na URL e query', () => {
    expect(normalizarEndereco('http://loja.com.br').ok).toBe(false)
    expect(normalizarEndereco('loja.com.br').ok).toBe(false)
    expect(normalizarEndereco('https://a:b@loja.com.br').ok).toBe(false)
    expect(normalizarEndereco('https://loja.com.br/?x=1').ok).toBe(false)
  })
})

describe('traduzirProdutos', () => {
  it('traduz preço, promoção, estoque e link', () => {
    expect(traduzirProdutos(resposta([item()]), 'https://loja.com.br', '.html')).toEqual([
      {
        produtoId: 'TAP-01',
        nome: 'Tapete de yoga',
        preco: 149.9,
        precoDe: 199.9,
        emEstoque: true,
        link: 'https://loja.com.br/tapete-de-yoga.html',
      },
    ])
  })
  it('preço zero ou ausente vira sem preço, nunca R$ 0', () => {
    const zero = item({ price_range: { minimum_price: { regular_price: { value: 0 }, final_price: { value: 0 } } } })
    const [p] = traduzirProdutos(resposta([zero]), 'https://loja.com.br', '.html')
    expect(p.preco).toBeUndefined()
    expect(p.precoDe).toBeUndefined()
    const [q] = traduzirProdutos(resposta([item({ price_range: null })]), 'https://loja.com.br', '.html')
    expect(q.preco).toBeUndefined()
  })
  it('sem promoção não inventa precoDe', () => {
    const cheio = item({ price_range: { minimum_price: { regular_price: { value: 100 }, final_price: { value: 100 } } } })
    expect(traduzirProdutos(resposta([cheio]), 'https://loja.com.br', '.html')[0].precoDe).toBeUndefined()
  })
  it('descarta item sem sku, nome ou url_key e corta no limite', () => {
    const muitos = Array.from({ length: 9 }, (_, i) => item({ sku: `S${i}` }))
    expect(traduzirProdutos(resposta([item({ sku: '' }), ...muitos]), 'https://loja.com.br', '.html')).toHaveLength(5)
  })
  it('resposta com errors ou formato estranho vira lista vazia', () => {
    expect(traduzirProdutos({ errors: [{ message: 'x' }] }, 'https://loja.com.br', '.html')).toEqual([])
    expect(traduzirProdutos('lixo', 'https://loja.com.br', '.html')).toEqual([])
  })
})

describe('traduzirRecomendacoes', () => {
  it('junta crosssell e related, sem repetir, só o que tem estoque', () => {
    const json = resposta([
      item({
        crosssell_products: [item({ sku: 'A' }), item({ sku: 'B', stock_status: 'OUT_OF_STOCK' })],
        related_products: [item({ sku: 'A' }), item({ sku: 'C' })],
      }),
    ])
    expect(traduzirRecomendacoes(json, 'https://loja.com.br', '.html').map((p) => p.produtoId)).toEqual(['A', 'C'])
  })
})

describe('segurança da query', () => {
  it('o termo é variável, nunca texto da query', () => {
    expect(QUERY_BUSCA).toContain('$termo: String!')
    expect(QUERY_BUSCA).toContain('search: $termo')
  })
})

describe('linkDoProduto', () => {
  it('respeita sufixo vazio', () => {
    expect(linkDoProduto('https://loja.com.br', 'tapete', '')).toBe('https://loja.com.br/tapete')
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run --config vitest.unit.config.ts src/core/loja.test.ts`
Esperado: FAIL, módulo não existe.

- [ ] **Passo 3: implementar**

```ts
/**
 * A loja do cliente, do jeito que o bot precisa dela.
 *
 * Regra pura: nada de rede, relógio ou banco. Quem fala com o Magento é
 * `src/loja/magento.ts`; este arquivo só sabe montar a pergunta e ler a
 * resposta. Ver docs/INTEGRACAO-MAGENTO-23-SET.md.
 *
 * Duas regras que custam caro se alguém "simplificar":
 *
 * - **Preço ausente não é zero.** Magento devolve 0 quando o preço depende do
 *   grupo do cliente ou não foi cadastrado. Anunciar "R$ 0,00" no WhatsApp é o
 *   pior erro possível desta integração, então 0 e ausente viram a mesma
 *   coisa: `preco` não existe, e o bot diz que vai confirmar o valor.
 * - **O termo é variável GraphQL.** Ele vem do que o cliente final digitou.
 *   Concatenar na query abriria injeção; como variável, a query é constante.
 */

export const LIMITE_DE_PRODUTOS = 5

const CAMPOS_DO_PRODUTO = `
  sku
  name
  url_key
  stock_status
  price_range { minimum_price { regular_price { value } final_price { value } } }
`

export const QUERY_BUSCA = `query Buscar($termo: String!) {
  products(search: $termo, pageSize: ${LIMITE_DE_PRODUTOS}) { items { ${CAMPOS_DO_PRODUTO} } }
}`

export const QUERY_RECOMENDACOES = `query Recomendar($sku: String!) {
  products(filter: { sku: { eq: $sku } }, pageSize: 1) {
    items {
      crosssell_products { ${CAMPOS_DO_PRODUTO} }
      related_products { ${CAMPOS_DO_PRODUTO} }
    }
  }
}`

export const QUERY_CONFIG = `{ storeConfig { store_code base_currency_code product_url_suffix } }`

export type ProdutoDaLoja = {
  produtoId: string
  nome: string
  preco?: number
  precoDe?: number
  emEstoque: boolean
  quantidade?: number
  link: string
}

export function normalizarEndereco(
  entrada: string,
): { ok: true; endereco: string } | { ok: false; motivo: string } {
  let url: URL
  try {
    url = new URL(entrada.trim())
  } catch {
    return { ok: false, motivo: 'escreva o endereço completo, começando com https://' }
  }
  if (url.protocol !== 'https:') return { ok: false, motivo: 'o endereço precisa começar com https://' }
  if (url.username || url.password) return { ok: false, motivo: 'o endereço não pode ter usuário ou senha' }
  if (url.search || url.hash) return { ok: false, motivo: 'use só o endereço da loja, sem ? ou # no fim' }
  const caminho = url.pathname.replace(/\/+$/, '')
  return { ok: true, endereco: `${url.origin}${caminho}` }
}

export function linkDoProduto(endereco: string, urlKey: string, sufixo: string): string {
  return `${endereco}/${encodeURIComponent(urlKey)}${sufixo}`
}

function valor(no: unknown): number | undefined {
  const v = (no as { value?: unknown } | null | undefined)?.value
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

function traduzirItem(bruto: unknown, endereco: string, sufixo: string): ProdutoDaLoja | null {
  if (bruto === null || typeof bruto !== 'object') return null
  const it = bruto as Record<string, unknown>
  const sku = typeof it.sku === 'string' ? it.sku.trim() : ''
  const nome = typeof it.name === 'string' ? it.name.trim() : ''
  const urlKey = typeof it.url_key === 'string' ? it.url_key.trim() : ''
  if (!sku || !nome || !urlKey) return null

  const minimo = (it.price_range as { minimum_price?: Record<string, unknown> } | null | undefined)?.minimum_price
  const final = valor(minimo?.final_price)
  const cheio = valor(minimo?.regular_price)

  return {
    produtoId: sku,
    nome,
    ...(final !== undefined ? { preco: final } : {}),
    ...(final !== undefined && cheio !== undefined && cheio > final ? { precoDe: cheio } : {}),
    emEstoque: it.stock_status === 'IN_STOCK',
    link: linkDoProduto(endereco, urlKey, sufixo),
  }
}

function itensDe(json: unknown): unknown[] {
  const items = (json as { data?: { products?: { items?: unknown } } } | null)?.data?.products?.items
  return Array.isArray(items) ? items : []
}

export function traduzirProdutos(json: unknown, endereco: string, sufixo: string): ProdutoDaLoja[] {
  return itensDe(json)
    .map((i) => traduzirItem(i, endereco, sufixo))
    .filter((p): p is ProdutoDaLoja => p !== null)
    .slice(0, LIMITE_DE_PRODUTOS)
}

/**
 * O que o lojista marcou como "combina com", sem repetir e só com estoque.
 *
 * Recomendar o que está esgotado é oferecer o que não dá para vender. Ao
 * contrário da busca, onde "acabou" é resposta útil, aqui é ruído.
 */
export function traduzirRecomendacoes(json: unknown, endereco: string, sufixo: string): ProdutoDaLoja[] {
  const [produto] = itensDe(json) as Record<string, unknown>[]
  if (!produto) return []
  const juntos = [
    ...(Array.isArray(produto.crosssell_products) ? produto.crosssell_products : []),
    ...(Array.isArray(produto.related_products) ? produto.related_products : []),
  ]
  const vistos = new Set<string>()
  const saida: ProdutoDaLoja[] = []
  for (const bruto of juntos) {
    const p = traduzirItem(bruto, endereco, sufixo)
    if (!p || !p.emEstoque || vistos.has(p.produtoId)) continue
    vistos.add(p.produtoId)
    saida.push(p)
  }
  return saida.slice(0, LIMITE_DE_PRODUTOS)
}
```

- [ ] **Passo 4: rodar e ver passar.** Mesmo comando. Esperado: PASS.

- [ ] **Passo 5: commit** `feat(loja): regra pura do catálogo Magento` e push.

---

### Task 2: migration `0092_lojas_integradas`

Antes: `ls supabase/migrations | tail -1` e reler o checklist do fim de
`docs/BANCO-COMPARTILHADO.md`.

**Arquivos:**
- Criar: `supabase/migrations/0092_lojas_integradas.sql`

- [ ] **Passo 1: escrever a migration**

```sql
-- ---------------------------------------------------------------------------
-- 0092: a loja do cliente, para o bot consultar catálogo ao vivo
-- ---------------------------------------------------------------------------
--
-- Uma linha por conta e plataforma. Hoje só `magento`; o check existe para o
-- dia de Nuvemshop ou Tray entrar sem reinterpretar linha antiga.
--
-- Aditiva: tabela nova, nenhuma coluna de tabela existente alterada, nenhum
-- dado reescrito. Roda em `public`, qualificado, sem tocar `app_verandi`. Ver
-- docs/BANCO-COMPARTILHADO.md.
--
-- `ativa` nasce `false`: aplicar esta migration não muda o comportamento de
-- conta nenhuma. Quem liga é o dono, na tela, depois de um teste que deu certo.
--
-- As colunas da fase 2 (token de administrador) nascem aqui, desligadas, pelo
-- motivo da 0066: mexer uma vez em produção em vez de duas.
--
--   - `conexao_id` aponta para `public.connections`, que já guarda o valor no
--     Vault e apaga o segredo por gatilho (0006). `on delete set null`:
--     apagar a Conexão desliga o estoque exato, não apaga a loja.
--   - `estoque_exato` diz qual caminho da REST respondeu no teste: `msi`
--     (Inventory, 2.3+) ou `legado` (CatalogInventory). `desligado` é o padrão
--     e é o que o bot usa sempre que o token falha.
--
-- Nenhum segredo mora nesta tabela. Endereço de loja é público.

set search_path = public, extensions;

create table if not exists public.lojas_integradas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  plataforma text not null check (plataforma in ('magento')),
  endereco text not null check (endereco ~ '^https://' and length(endereco) <= 300),
  codigo_da_loja text check (codigo_da_loja is null or codigo_da_loja ~ '^[a-z0-9_]{1,64}$'),
  sufixo_da_url text not null default '.html' check (length(sufixo_da_url) <= 20),
  ativa boolean not null default false,
  conexao_id uuid references public.connections (id) on delete set null,
  estoque_exato text not null default 'desligado'
    check (estoque_exato in ('desligado', 'msi', 'legado')),
  estoque_id integer check (estoque_id is null or estoque_id > 0),
  verificada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (client_id, plataforma),
  -- Estoque exato ligado sem token é estado impossível; o banco recusa.
  constraint lojas_estoque_exige_token check (estoque_exato = 'desligado' or conexao_id is not null)
);

-- RLS ligada e zero políticas, o padrão da casa: só o servidor acessa.
-- Revoke com `public` na lista, ver docs/BANCO-COMPARTILHADO.md §6.
alter table public.lojas_integradas enable row level security;
revoke all on public.lojas_integradas from public, anon, authenticated;

notify pgrst, 'reload schema';
```

> Sobre `on delete set null` com o check: quando a Conexão é apagada, o
> Postgres põe `conexao_id` em nulo e o check recusaria se `estoque_exato`
> ainda fosse `msi`. Por isso o repositório (Task 4) **sempre** zera
> `estoque_exato` antes de apagar a Conexão, na mesma função. O ensaio do
> Passo 3 prova que a ordem inversa falha alto, e não em silêncio.

- [ ] **Passo 2: replay em Docker** (se o Docker estiver de pé nesta máquina)

```bash
npx supabase start && npx supabase db reset && npx supabase stop
```
Esperado: `0001`..`0092` sem erro.

- [ ] **Passo 3: ensaio em transação contra a produção**, pela Management API,
  com o ref literal `xxxynoshwirupkdzwxbj` (ver memória "cofre sem chaves"):
  `begin; <migration sem o notify>; <inserts de prova>; rollback;`. Provas:
  endereço `http://` recusado; `estoque_exato='msi'` sem `conexao_id` recusado;
  segunda linha `magento` na mesma conta recusada. Depois do rollback, a tabela
  não existe.

- [ ] **Passo 4: pedir autorização ao Gabriel** para aplicar. Sem "sim"
  explícito nesta sessão, parar aqui.

- [ ] **Passo 5: aplicar e conferir objeto a objeto**: tabela com as colunas,
  os três checks, RLS ligada, zero políticas, `anon`/`authenticated` sem
  privilégio. Medir antes e depois: `app_verandi.migrations_aplicadas` (linhas),
  tabelas de `app_verandi`, policies de `storage.objects`. Reload do PostgREST
  conferido nos dois produtos: `lojas_integradas` 200 para `service_role`, 401
  para `anon`, `app_verandi.conta` 200.

- [ ] **Passo 6: registrar em `docs/BANCO-COMPARTILHADO.md`** um parágrafo no
  padrão dos anteriores (o que é, por que `ativa` nasce falsa, números medidos).

- [ ] **Passo 7: commit** `feat(banco): 0092 lojas_integradas` e push.

---

### Task 3: adaptador `src/loja/` (Magento público e loja falsa)

**Arquivos:**
- Criar: `src/loja/types.ts`, `src/loja/magento.ts`, `src/loja/falsa.ts`
- Teste: `src/loja/magento.test.ts`

**Interfaces:**
- Consome: `QUERY_*`, `traduzirProdutos`, `traduzirRecomendacoes` (Task 1);
  `chamarHttp` de `src/server/efeitos/http.ts`.
- Produz:

```ts
// src/loja/types.ts
import type { ProdutoDaLoja } from '@/core/loja'
export type ResultadoDaLoja<T> = { ok: true; valor: T } | { ok: false; motivo: string }
export type ConfigDaLoja = { codigoDaLoja: string | null; moeda: string; sufixo: string }
export type Loja = {
  buscar(termo: string): Promise<ResultadoDaLoja<ProdutoDaLoja[]>>
  combinaCom(sku: string): Promise<ResultadoDaLoja<ProdutoDaLoja[]>>
  lerConfig(): Promise<ResultadoDaLoja<ConfigDaLoja>>
}
export type DadosDaLoja = { endereco: string; codigoDaLoja: string | null; sufixo: string }
```

`magento.ts` recebe `chamar` por injeção (default: `chamarHttp`), para o teste
não tocar rede:

```ts
import 'server-only'
import { QUERY_BUSCA, QUERY_CONFIG, QUERY_RECOMENDACOES, traduzirProdutos, traduzirRecomendacoes } from '@/core/loja'
import { chamarHttp } from '@/server/efeitos/http'
import type { DadosDaLoja, Loja, ResultadoDaLoja } from './types'

type Chamar = typeof chamarHttp

/**
 * Magento pelo GraphQL público, sem credencial.
 *
 * Usa GET e não POST: o Magento aceita query por GET, o cache de página da
 * loja (Varnish/Fastly) responde sem acordar o PHP, e o verbo deixa óbvio no
 * log que isto não escreve nada.
 *
 * Toda chamada passa por `chamarHttp`, que confere o endereço contra rede
 * interna a cada salto. O endereço vem do lojista; confiar nele uma vez, na
 * hora de salvar, deixaria a porta aberta para quem trocar o DNS depois.
 */
export function lojaMagento(dados: DadosDaLoja, chamar: Chamar = chamarHttp): Loja {
  async function graphql(query: string, variaveis: Record<string, string>): Promise<ResultadoDaLoja<unknown>> {
    const url = new URL(`${dados.endereco}/graphql`)
    url.searchParams.set('query', query)
    if (Object.keys(variaveis).length > 0) url.searchParams.set('variables', JSON.stringify(variaveis))
    const resposta = await chamar(
      {
        tipo: 'chamar_http',
        metodo: 'GET',
        url: url.toString(),
        cabecalhos: dados.codigoDaLoja ? [{ nome: 'Store', valor: dados.codigoDaLoja }] : [],
        corpo: '',
        mapear: [],
        aoFalhar: 'humano',
      },
      { deTeste: false, comJson: true },
    )
    if (!resposta.ok) return { ok: false, motivo: `a loja não respondeu: ${resposta.motivo}` }
    const erros = (resposta.json as { errors?: unknown[] } | null)?.errors
    if (Array.isArray(erros) && erros.length > 0) return { ok: false, motivo: 'a loja recusou a consulta' }
    return { ok: true, valor: resposta.json }
  }

  return {
    async buscar(termo) {
      const limpo = termo.trim().slice(0, 80)
      if (!limpo) return { ok: true, valor: [] }
      const r = await graphql(QUERY_BUSCA, { termo: limpo })
      return r.ok ? { ok: true, valor: traduzirProdutos(r.valor, dados.endereco, dados.sufixo) } : r
    },
    async combinaCom(sku) {
      const r = await graphql(QUERY_RECOMENDACOES, { sku })
      return r.ok ? { ok: true, valor: traduzirRecomendacoes(r.valor, dados.endereco, dados.sufixo) } : r
    },
    async lerConfig() {
      const r = await graphql(QUERY_CONFIG, {})
      if (!r.ok) return r
      const c = (r.valor as { data?: { storeConfig?: Record<string, unknown> } }).data?.storeConfig
      if (!c) return { ok: false, motivo: 'a loja respondeu, mas sem configuração; o GraphQL pode estar desligado' }
      return {
        ok: true,
        valor: {
          codigoDaLoja: typeof c.store_code === 'string' ? c.store_code : null,
          moeda: typeof c.base_currency_code === 'string' ? c.base_currency_code : 'BRL',
          // `null` quer dizer "sem sufixo", e não "use o padrão". A PCYES responde
          // null e o link certo é sem `.html` (sondagem de 23/set/2026).
          sufixo: typeof c.product_url_suffix === 'string' ? c.product_url_suffix : '',
        },
      }
    },
  }
}
```

> Conferir no passo 3 os nomes exatos de `Cabecalho` em `src/core/flow/schema.ts`
> (`nome`/`valor` ou outro) e ajustar; o tipo é o que manda.

`falsa.ts`: implementa `Loja` com um array em memória e um interruptor
`falhar: boolean`, para a Task 5 testar o resolvedor sem rede.

- [ ] **Passo 1: teste que falha** (`src/loja/magento.test.ts`), com `chamar`
  falso que grava o pedido recebido:

```ts
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { lojaMagento } from './magento'

const dados = { endereco: 'https://loja.com.br', codigoDaLoja: null, sufixo: '.html' }
const ok = (json: unknown) => vi.fn().mockResolvedValue({ ok: true, valores: {}, json })

describe('lojaMagento', () => {
  it('busca por GET, com o termo só em variables', async () => {
    const chamar = ok({ data: { products: { items: [] } } })
    await lojaMagento(dados, chamar).buscar('tapete"} ignore tudo {')
    const pedido = chamar.mock.calls[0][0]
    expect(pedido.metodo).toBe('GET')
    const url = new URL(pedido.url)
    expect(url.origin + url.pathname).toBe('https://loja.com.br/graphql')
    expect(url.searchParams.get('query')).not.toContain('ignore tudo')
    expect(JSON.parse(url.searchParams.get('variables')!)).toEqual({ termo: 'tapete"} ignore tudo {' })
  })
  it('termo vazio não chama a loja', async () => {
    const chamar = ok({})
    expect(await lojaMagento(dados, chamar).buscar('   ')).toEqual({ ok: true, valor: [] })
    expect(chamar).not.toHaveBeenCalled()
  })
  it('falha de rede vira motivo legível', async () => {
    const chamar = vi.fn().mockResolvedValue({ ok: false, motivo: 'prazo esgotado' })
    const r = await lojaMagento(dados, chamar).buscar('tapete')
    expect(r).toEqual({ ok: false, motivo: 'a loja não respondeu: prazo esgotado' })
  })
  it('errors do GraphQL não vira lista vazia silenciosa', async () => {
    const r = await lojaMagento(dados, ok({ errors: [{ message: 'x' }] })).buscar('tapete')
    expect(r.ok).toBe(false)
  })
  it('manda o cabeçalho Store quando há código de loja', async () => {
    const chamar = ok({ data: { products: { items: [] } } })
    await lojaMagento({ ...dados, codigoDaLoja: 'pt_br' }, chamar).buscar('x')
    expect(JSON.stringify(chamar.mock.calls[0][0].cabecalhos)).toContain('pt_br')
  })
})
```

- [ ] **Passo 2: rodar e ver falhar.**
  `npx vitest run --config vitest.unit.config.ts src/loja/magento.test.ts`
- [ ] **Passo 3: implementar** `types.ts`, `magento.ts`, `falsa.ts`.
- [ ] **Passo 4: rodar e ver passar**, e `npm run typecheck`.
- [ ] **Passo 5: commit** `feat(loja): adaptador Magento público` e push.

---

### Task 4: repositório e adaptador da conta

**Arquivos:**
- Criar: `src/server/repos/lojas.ts`, `src/server/adaptador-da-loja.ts`
- Teste: `src/server/repos/lojas.test.ts` (`describe.skipIf` por credencial,
  padrão do repositório; fora da lista de exclusão do `vitest.unit.config.ts`)

**Interfaces produzidas:**

```ts
// repos/lojas.ts
export type LojaIntegrada = {
  id: string
  clienteId: string
  plataforma: 'magento'
  endereco: string
  codigoDaLoja: string | null
  sufixo: string
  ativa: boolean
  conexaoId: string | null
  estoqueExato: 'desligado' | 'msi' | 'legado'
  estoqueId: number | null
  verificadaEm: string | null
}
export async function lojaDaConta(clienteId: string): Promise<LojaIntegrada | null>
export async function salvarLoja(clienteId: string, dados: {
  endereco: string; codigoDaLoja: string | null; sufixo: string
}): Promise<LojaIntegrada>          // upsert por (client_id, 'magento'); grava verificada_em = now()
export async function ligarLoja(clienteId: string, ativa: boolean): Promise<void>
export async function ligarEstoqueExato(clienteId: string, dados: {
  conexaoId: string; via: 'msi' | 'legado'; estoqueId: number | null
}): Promise<void>
export async function desligarEstoqueExato(clienteId: string): Promise<{ conexaoId: string | null }>
  // zera estoque_exato/estoque_id ANTES de devolver o conexao_id para quem vai apagar a Conexão

// adaptador-da-loja.ts
export async function lojaAtivaDaConta(clienteId: string): Promise<Loja | null>
  // null quando não há linha ou ativa = false
```

Regras que o teste cobra:
- toda leitura e escrita filtra por `client_id` (o id nunca vem do modelo);
- `ligarLoja(id, true)` recusa se `verificada_em` for nulo (loja nunca testada);
- `desligarEstoqueExato` deixa `estoque_exato = 'desligado'` e **não** apaga a
  Conexão (quem apaga é a ação, Task 8, depois);
- nada neste arquivo apaga linha de `lojas_integradas`. "Desconectar a loja" é
  `ativa = false`, e o endereço fica para religar.

- [ ] Passo 1: teste que falha · Passo 2: ver falhar · Passo 3: implementar no
  padrão de `repos/produtos.ts` (colunas explícitas, `ehIdInvalido`) · Passo 4:
  passar + `npm run typecheck` · Passo 5: commit `feat(loja): repositório e
  adaptador da conta` e push.

---

### Task 5: as duas ferramentas e o resolvedor

A mudança de fundo que o PLANO-23-SET apontou: `integracao` está fixo em
`'verandi'` e toda ferramenta é uma URL fixa com credencial obrigatória.

**Arquivos:**
- Modificar: `src/core/ferramentas.ts` (tipo `Ferramenta`, as 5 existentes, 2 novas)
- Modificar: `src/server/ia/ferramentas-do-pedido.ts:140-155` (montar URL só para `http`)
- Modificar: `src/server/efeitos/resolver.ts:663-683` (credencial) e `:937-1012` (despacho)
- Teste: `src/core/ferramentas.test.ts`, `src/server/efeitos/resolver-loja.test.ts`

**Mudança de tipo:**

```ts
export type ChamadaDeFerramenta =
  | {
      tipo: 'http'
      metodo: Metodo
      url: string
      cabecalhos: Cabecalho[]
      corpo: string
    }
  | {
      /**
       * Executada no servidor pelo adaptador da loja da conta.
       *
       * Não tem URL porque o endereço é de cada cliente, e não tem credencial
       * porque a conta é injetada pelo servidor, nunca escrita pelo modelo:
       * é a regra de `injetados` levada ao extremo, o modelo não tem nem como
       * nomear a loja que consulta.
       */
      tipo: 'loja'
      operacao: 'buscar' | 'combina_com'
    }

// em Ferramenta:
  chamada: ChamadaDeFerramenta
  integracao: 'verandi' | 'loja'
```

As 5 ferramentas existentes ganham `tipo: 'http'` dentro de `chamada`. Nada mais
muda nelas.

**As duas novas** (fim de `FERRAMENTAS`):

```ts
  {
    nome: 'loja_buscar',
    rotulo: 'Buscar produto na loja',
    escreve: false,
    descricao:
      'Procura produtos na loja on-line da empresa e devolve nome, preço, se tem em estoque e o link. ' +
      'Use quando a pessoa perguntar se tem um produto, quanto custa, ou pedir uma indicação. ' +
      'Busque pelo tipo de produto em poucas palavras ("tapete yoga"), não pela frase inteira. ' +
      'Se um produto vier sem preço, diga que vai confirmar o valor e nunca invente. ' +
      'Sempre mande o link para a pessoa comprar; você não fecha pedido. ' +
      'Não use para horário de aula ou agenda.',
    argumentos: [
      { nome: 'termo', tipo: 'texto', descricao: 'O que procurar, em até 5 palavras.', obrigatorio: true },
    ],
    injetados: [],
    chamada: { tipo: 'loja', operacao: 'buscar' },
    projecao: [
      { caminho: 'produtos', campos: ['produtoId', 'nome', 'preco', 'precoDe', 'emEstoque', 'quantidade', 'link'], limite: 5 },
    ],
    credencial: 'nenhuma',
    integracao: 'loja',
  },
  {
    nome: 'loja_combina_com',
    rotulo: 'Sugerir o que combina',
    escreve: false,
    descricao:
      'Devolve os produtos que a própria loja marcou como complemento de um produto, só os que têm estoque. ' +
      'Use depois de a pessoa demonstrar interesse num produto, para sugerir um complemento, uma vez só. ' +
      'Não use antes de `loja_buscar`: o produtoId precisa ter vindo de lá. ' +
      'Se voltar vazio, não sugira nada por conta própria.',
    argumentos: [
      {
        nome: 'produtoId',
        tipo: 'id',
        descricao: 'O produtoId de um item que veio de `loja_buscar`.',
        obrigatorio: true,
        soDeResultadoAnterior: true,
      },
    ],
    injetados: [],
    chamada: { tipo: 'loja', operacao: 'combina_com' },
    projecao: [
      { caminho: 'produtos', campos: ['produtoId', 'nome', 'preco', 'precoDe', 'emEstoque', 'quantidade', 'link'], limite: 5 },
    ],
    credencial: 'nenhuma',
    integracao: 'loja',
  },
```

**Resolvedor:**

1. `responderComFerramentas`: a credencial do nó só é obrigatória se alguma
   permitida for `chamada.tipo === 'http' && credencial !== 'nenhuma'`. Hoje o
   `if (!credencial) return nao_sei` barra tudo; troque por:

```ts
const precisaDeCredencial = permitidas.some(
  (f) => f.chamada.tipo === 'http' && f.credencial !== 'nenhuma',
)
if (precisaDeCredencial && !credencial) {
  return { tipo: 'nao_sei', motivo: 'a credencial das consultas não pôde ser lida' }
}
```

2. `dispararFerramenta`: logo depois de `conferirPedido` dar ok, desviar as de
   loja antes da leitura de credencial:

```ts
if (ferramenta.chamada.tipo === 'loja') {
  const r = await executarNaLoja(ferramenta.chamada.operacao, conferida.chamada.valores, opcoes)
  await logar({ opcoes, ferramenta, argumentos: conferida.chamada.valores, decididoPor, ok: r.ok, ...(r.ok ? {} : { detalhe: r.motivo }), resumo })
  return r
}
```

```ts
async function executarNaLoja(
  operacao: 'buscar' | 'combina_com',
  valores: Record<string, string>,
  opcoes: OpcoesDeEfeitos,
): Promise<{ ok: true; json: unknown } | { ok: false; motivo: string }> {
  if (!opcoes.clienteId) return { ok: false, motivo: 'a consulta à loja só funciona numa conta' }
  const loja = await lojaAtivaDaConta(opcoes.clienteId)
  if (!loja) return { ok: false, motivo: 'a loja desta conta não está ligada' }
  const r = operacao === 'buscar' ? await loja.buscar(valores.termo ?? '') : await loja.combinaCom(valores.produtoId ?? '')
  return r.ok ? { ok: true, json: { produtos: r.valor } } : r
}
```

3. `ferramentas-do-pedido.ts`: montar `url`/`corpo` só quando
   `ferramenta.chamada.tipo === 'http'`; para `loja`, `url: ''` e `corpo: ''`
   (o `valores` já carrega os argumentos conferidos).

4. `presets-de-integracao`, `painel.tsx` e qualquer outro leitor de
   `ferramenta.chamada.url`: `npm run typecheck` aponta todos. Cada um passa a
   checar `chamada.tipo === 'http'` antes.

- [ ] **Passo 1: testes que falham**

`ferramentas.test.ts` (acrescentar):
```ts
it('ferramenta de loja não escreve, não pede credencial e não tem injetado', () => {
  for (const nome of ['loja_buscar', 'loja_combina_com']) {
    const f = acharFerramenta(nome)!
    expect(f.escreve).toBe(false)
    expect(f.credencial).toBe('nenhuma')
    expect(f.chamada.tipo).toBe('loja')
  }
})
it('produtoId de loja_combina_com só vale se já apareceu', () => {
  const arg = acharFerramenta('loja_combina_com')!.argumentos[0]
  expect(arg.soDeResultadoAnterior).toBe(true)
  expect(idsVistos(projetar({ produtos: [{ produtoId: 'TAP-01', nome: 'x' }] }, acharFerramenta('loja_buscar')!.projecao)).has('TAP-01')).toBe(true)
})
```

`resolver-loja.test.ts` (com `vi.mock('@/server/adaptador-da-loja')` devolvendo
a loja falsa, e o modelo falso que o resolvedor já usa nos testes dele; procurar
o existente com `grep -rln "responderComFerramentas\|modeloFalso" src`):
- nó com só `loja_buscar` e **sem** `conexaoId` responde com os produtos (prova
  que a credencial deixou de ser obrigatória para loja);
- nó com `agenda_horarios` e sem credencial continua em `nao_sei` (não afrouxou
  a Verandi);
- loja falsa com `falhar = true` vira `nao_sei` com motivo que começa com
  `a consulta loja_buscar falhou`;
- conta com loja desligada vira `nao_sei` "a loja desta conta não está ligada";
- modelo chamando `loja_combina_com` com um SKU que não veio de `loja_buscar` é
  recusado pela trava, e a loja falsa não é chamada.

- [ ] **Passo 2: ver falhar.** Rodar os dois arquivos.
- [ ] **Passo 3: implementar** a união, as duas ferramentas, o resolvedor.
- [ ] **Passo 4: ver passar**, rodar também `src/server/ia/ferramentas-do-pedido.test.ts`
  e `src/core/ferramentas.test.ts` inteiros (tocam no que mudou) e `npm run typecheck`.
- [ ] **Passo 5: commit** `feat(ia): ferramentas de loja executadas no servidor` e push.
  **Só depois de a 0092 estar aplicada** (Task 2, Passo 5).

---

### Task 6: tela da integração Magento

Ler `node_modules/next/dist/docs/` sobre Server Actions e páginas dinâmicas
antes. Seguir `ajustes/produtos/page.tsx` e `ajustes/instagram` como molde
(`AjustesShell`, `force-dynamic`, ações em `src/server/acoes-*.ts`).

**Arquivos:**
- Criar: `src/server/acoes-loja.ts`, `src/app/clientes/[clienteId]/ajustes/integracoes/magento/page.tsx`
  (+ componente cliente do formulário, se o molde fizer assim)
- Modificar: `src/app/clientes/[clienteId]/ajustes/integracoes/page.tsx` (card "Magento")
- Teste: `src/server/acoes-loja.test.ts`

**Ações do servidor:**

```ts
export async function testarLoja(clienteId: string, enderecoDigitado: string): Promise<
  | { ok: true; endereco: string; codigoDaLoja: string | null; moeda: string; sufixo: string; amostra: ProdutoDaLoja[] }
  | { ok: false; motivo: string }
>
// 1. normalizarEndereco  2. lojaMagento(...).lerConfig()  3. buscar('a') para amostra
// Não grava nada. Moeda diferente de BRL volta ok, com aviso na tela.

export async function salvarEAtivarLoja(clienteId: string, enderecoDigitado: string): Promise<{ ok: true } | { ok: false; motivo: string }>
// Roda testarLoja de novo no servidor (nunca confia no resultado que veio do navegador),
// salvarLoja com o que o teste descobriu, ligarLoja(true).

export async function desligarLoja(clienteId: string): Promise<void>  // ligarLoja(false). Não apaga nada.
```

Todas conferem a sessão do painel como as outras `acoes-*.ts` fazem.

**A tela (estados):**

| Estado | O que aparece |
|---|---|
| Sem loja | campo "Endereço da loja" (placeholder `https://www.sualoja.com.br`), botão **Testar conexão** |
| Testado com sucesso | até 3 produtos da amostra (nome, preço, "em estoque"/"esgotado"), botão **Ligar no bot**. Se `crosssell`/`related` vierem vazios, aviso: "Sua loja ainda não tem produtos marcados como complemento. O bot vai buscar e mostrar produtos, mas não vai sugerir complementos até você cadastrar em Catálogo > Produtos > Produtos relacionados." |
| Teste falhou | a frase do `motivo`, sem código técnico, e o que fazer (tabela da Task 0 em linguagem de lojista) |
| Ligada | endereço, "verificada em", botões **Testar de novo** e **Desligar**, e um lembrete: "Para o bot usar a loja, marque *Buscar produto na loja* no bloco de IA do fluxo." com link para os fluxos |
| Ligada, fase 2 | seção "Estoque exato (opcional)", Task 9 |

Card em `integracoes/page.tsx`: "Magento", estado Ligada / Desligada / Não
configurada, link para a página nova. Usar o ícone de loja genérico que o
catálogo já tenha; não criar logo de marca.

- [ ] Passo 1: teste das ações (`testarLoja` com endereço `http://` recusa sem
  chamar rede; `salvarEAtivarLoja` com teste falhando não grava; `desligarLoja`
  não apaga a linha) · Passo 2: ver falhar · Passo 3: implementar ações e tela ·
  Passo 4: passar + `npm run typecheck` + `npm run build` · Passo 5: abrir no
  navegador (skill `run`) e passar pelos quatro estados com a loja do cliente ·
  Passo 6: commit `feat(loja): tela da integração Magento` e push.

---

### Task 7: editor de fluxo

**Arquivo:** `src/components/editor/painel.tsx` (onde `FERRAMENTAS` vira caixinhas)

- Agrupar as caixinhas por `integracao`: "Agenda (Verandi)" e "Loja".
- Se a conta não tem loja ativa, o grupo "Loja" aparece com as caixinhas
  desabilitadas e a frase "Ligue a loja em Integrações" com link. O painel
  recebe `lojaAtiva: boolean` de quem o monta (seguir de onde vêm os outros
  dados da conta no editor).
- O seletor de Conexão do nó continua existindo, mas deixa de ser obrigatório
  quando só ferramentas de loja estão marcadas.

- [ ] Passo 1: implementar · Passo 2: `npm run typecheck` e `npm run build` ·
  Passo 3: conferir no navegador, conta sem loja e conta com loja · Passo 4:
  commit `feat(editor): ferramentas de loja no bloco de IA` e push.

---

### Task 8: pôr no ar e provar com a loja real

- [ ] 0092 aplicada (Task 2) antes do push das Tasks 5 a 7.
- [ ] Na conta do cliente: Integrações > Magento > testar > ligar.
- [ ] No fluxo dele: marcar `Buscar produto na loja` e `Sugerir o que combina`
  no bloco de IA; publicar.
- [ ] No simulador: "vocês têm X?", "quanto custa?", "o que combina com ele?",
  e uma pergunta de produto que a loja não vende. Conferir: preço bate com o
  site, link abre o produto certo, produto inexistente não vira invenção.
- [ ] Conferir no log de chamadas da IA (`repos/ia-chamadas.ts`) que as
  chamadas de loja aparecem com `ok` e sem nada sensível.
- [ ] Anotar o resultado em `docs/INTEGRACAO-MAGENTO-23-SET.md` (seção
  "Em produção"), com data e o que diferiu da documentação da Adobe.

---

# Fase 2: token de administrador, só para estoque exato

Só começa depois de a fase 1 estar em uso na conta do cliente. O ganho é o bot
dizer "restam 3" em vez de "tem". Se o cliente não sentir falta, esta fase não
precisa existir.

## Por que ela é "muito bem pensada", em uma lista

- **O que o token pode fazer não é o que nós fazemos com ele.** A ACL do
  Magento não separa ler de escrever. A trava é o código: cliente só `GET`,
  lista fixa de caminhos, teste que lê o arquivo.
- **O token é do lojista e ele desliga quando quiser**, em Sistema >
  Integrações, sem falar com a gente. Nós também: um botão apaga a Conexão e o
  segredo do Vault.
- **Falhou, cai para a fase 1.** Token revogado, expirado, loja fora: o bot
  responde "tem / não tem" e a tela avisa o dono. Nunca erro para o cliente
  final.
- **Nada é gravado do lado de lá.** Nem pedido, nem reserva, nem produto,
  nem "log de integração" do Magento que dependa de escrita nossa.
- **Nada é apagado do nosso lado a não ser o que é nosso**: a Conexão e o
  segredo dela. A linha da loja fica, o histórico de chamadas fica.

### Task 9: cliente de administrador `src/loja/magento-admin.ts`

**Arquivos:**
- Criar: `src/loja/magento-admin.ts`
- Teste: `src/loja/magento-admin.test.ts`

**Interfaces produzidas:**

```ts
export type ViaDeEstoque = 'msi' | 'legado'
export function estoqueAdmin(
  dados: { endereco: string; credencial: CredencialDaChamada },
  chamar?: typeof chamarHttp,
): {
  /** Descobre qual caminho a loja tem. Usado só no teste da tela. */
  descobrir(sku: string): Promise<ResultadoDaLoja<{ via: ViaDeEstoque; estoqueId: number | null }>>
  quantidade(sku: string, via: ViaDeEstoque, estoqueId: number | null): Promise<ResultadoDaLoja<number>>
}
```

A lista fixa, e a única coisa que este arquivo sabe pedir:

```ts
/**
 * Os únicos caminhos que o token do lojista pode alcançar a partir daqui.
 *
 * Não há parâmetro de método em lugar nenhum deste arquivo, e é de propósito:
 * o token que o lojista cria pode, pela ACL do Magento, alterar produto. O que
 * impede isso é este arquivo não saber pedir outra coisa. O teste lê o fonte e
 * falha se aparecer POST, PUT, PATCH ou DELETE.
 */
const CAMINHOS = {
  // MSI (2.3+): o que sobra para vender, já descontadas as reservas.
  vendavel: (sku: string, estoqueId: number) =>
    `/rest/V1/inventory/get-product-salable-quantity/${encodeURIComponent(sku)}/${estoqueId}`,
  // Qual estoque atende o site padrão.
  estoqueDoSite: () => `/rest/V1/inventory/stock-resolver/website/base`,
  // Loja sem MSI.
  legado: (sku: string) => `/rest/V1/stockItems/${encodeURIComponent(sku)}`,
} as const
```

Cada chamada: `chamarHttp` com `metodo: 'GET'` escrito literalmente,
`credencial` bearer, prazo curto. `quantidade` devolve número inteiro >= 0;
qualquer outra coisa é falha.

- [ ] **Passo 1: testes que falham**

```ts
import { readFileSync } from 'node:fs'
it('o arquivo não sabe escrever', () => {
  const fonte = readFileSync('src/loja/magento-admin.ts', 'utf8')
  expect(fonte).not.toMatch(/['"](POST|PUT|PATCH|DELETE)['"]/)
  expect(fonte).not.toMatch(/metodo:\s*[a-z]/) // método nunca vem de variável
})
it('só chama caminhos da lista', async () => { /* chamar falso grava URLs; conferir que todas começam com /rest/V1/inventory/ ou /rest/V1/stockItems/ */ })
it('sku com barra não escapa do caminho', async () => { /* 'A/../../V1/customers' vira %2F */ })
it('401 vira falha com motivo "o token foi recusado pela loja"', async () => {})
it('msi responde 404, legado responde: descobrir devolve legado', async () => {})
it('quantidade negativa ou texto vira falha, não zero', async () => {})
```

(Escrever cada um completo, no estilo da Task 3, com `chamar` falso.)

- [ ] Passo 2: ver falhar · Passo 3: implementar · Passo 4: passar +
  `npm run typecheck` · Passo 5: commit `feat(loja): leitura de estoque com
  token, só GET` e push.

### Task 10: estoque exato no resultado do bot

**Arquivos:**
- Modificar: `src/server/adaptador-da-loja.ts`
- Teste: `src/server/adaptador-da-loja.test.ts`

Se a loja tem `estoque_exato != 'desligado'` e a Conexão lê do cofre, o
adaptador embrulha `buscar` e `combinaCom`: para cada produto **em estoque** do
resultado (no máximo 5), pede `quantidade` em paralelo, com teto total de 3
segundos. O que responder entra em `quantidade`; o que falhar fica sem, e
`emEstoque` continua o da fase 1.

Se **todas** falharem com "token recusado": registra alerta com `alertar(...)`
(sem o token) uma vez por conta por dia, e a tela da Task 11 mostra "o token
parou de funcionar". Não desliga sozinho: quem desliga é o dono.

A descrição de `loja_buscar` ganha uma frase: "Quando vier `quantidade`, pode
dizer quantas restam se forem 5 ou menos; acima disso, só diga que tem."

- [ ] Testes: token ok acrescenta `quantidade`; token 401 devolve o resultado da
  fase 1 intacto; loja lenta no admin não atrasa a resposta além de 3 s;
  produto esgotado não gasta chamada. · Implementar · passar + typecheck ·
  commit `feat(loja): quantidade exata quando há token` e push.

### Task 11: tela, seção "Estoque exato (opcional)"

**Arquivos:**
- Modificar: `src/server/acoes-loja.ts`, a página da Task 6
- Criar: `docs/GUIA-MAGENTO-LOJISTA.md`

**Ações:**

```ts
export async function conectarToken(clienteId: string, token: string, skuDeTeste: string): Promise<{ ok: true; via: ViaDeEstoque } | { ok: false; motivo: string }>
// 1. estoqueAdmin(...).descobrir(skuDeTeste) com o token em memória
// 2. só se ok: criarConexao({ nome: 'Magento (somente leitura)', tipo: 'bearer', valor: token })
// 3. ligarEstoqueExato(...)
// Falhou em 1: nada é gravado, o token não toca o cofre.

export async function desconectarToken(clienteId: string): Promise<void>
// 1. desligarEstoqueExato (zera o estado, devolve conexaoId)
// 2. apagarConexao(conexaoId) (gatilho da 0006 apaga o segredo)
// Nessa ordem: a inversa esbarra no check lojas_estoque_exige_token.
```

**Tela:** campo de token tipo senha, SKU de teste já preenchido com o primeiro
produto da amostra, botão **Testar e salvar**. Depois de salvo, o token nunca
volta para a tela; aparece "Conectado em <data>" e **Desconectar**. Texto fixo
na seção: "Este acesso é usado só para ler a quantidade em estoque. O AutoFluxos
não cria, altera nem apaga nada na sua loja. Você pode revogar a qualquer
momento em Sistema > Integrações no painel do Magento."

**`docs/GUIA-MAGENTO-LOJISTA.md`** (vai para o lojista; linguagem de lojista):
1. Sistema > Extensões > Integrações > Adicionar nova integração. Nome:
   "AutoFluxos (somente leitura)". Não preencher URL de callback.
2. Aba "API": Acesso a recursos "Personalizado". Marcar **só** o que a loja
   mostrar para estoque: em lojas com MSI, "Lojas > Inventário > Estoques" e
   "Catálogo > Inventário > Produtos"; sem MSI, só "Catálogo > Inventário >
   Produtos". (Conferir os nomes exatos na loja do cliente na Task 12 e
   corrigir este guia com o que a tela dele mostra.)
3. Salvar, "Ativar", "Permitir". Copiar o **Token de acesso** (não o Consumer
   Key).
4. Em versões 2.4.4 ou mais novas: Lojas > Configuração > Serviços > OAuth >
   Consumer Settings > "Allow OAuth Access Tokens to be used as standalone
   Bearer tokens" = Sim.
5. Colar o token no AutoFluxos, em Integrações > Magento > Estoque exato.
6. Para revogar: Sistema > Integrações > "AutoFluxos (somente leitura)" >
   Excluir. O bot volta sozinho a dizer só "tem / não tem".

Com link oficial de cada passo (os da pesquisa).

- [ ] Testes das ações: token que falha no teste não cria Conexão;
  desconectar apaga a Conexão depois de zerar o estado; token nunca aparece no
  retorno de nenhuma ação (`JSON.stringify(retorno)` não contém o token). ·
  Implementar · passar + typecheck + build · commit `feat(loja): estoque exato
  opcional na tela` e push.

### Task 12: ligar a fase 2 na loja real

- [ ] Mandar o guia ao lojista pelo Gabriel; lojista cria a integração.
- [ ] Conectar o token na tela; conferir `quantidade` de 2 produtos contra o
  painel do Magento dele (salable quantity, não a quantidade física).
- [ ] Revogar um teste: Desconectar na tela e conferir que o segredo sumiu do
  Vault (`select count(*) from vault.secrets where id = <ref>` = 0) e que o
  bot voltou a "tem / não tem".
- [ ] Reconectar e registrar em `docs/INTEGRACAO-MAGENTO-23-SET.md`: versão do
  Magento, MSI ou legado, nomes reais da ACL, o que diferiu da doc.

---

## Fora deste plano, de propósito

- Criar pedido, carrinho ou reservar estoque no Magento.
- Copiar o catálogo da loja para `public.produtos`. Se um dia valer (preço
  sugerido na cobrança, relatório por produto), é plano próprio, aditivo, e
  nunca apaga produto cadastrado à mão.
- Aviso de mudança de catálogo (webhook): não existe no Magento Open Source.
- Nuvemshop, Tray, Bling, Tiny: o `src/loja/types.ts` está pronto para eles,
  mas cada um é um plano quando aparecer cliente.
