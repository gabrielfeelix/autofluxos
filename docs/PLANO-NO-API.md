# Plano de implementação — o nó `API`

> **CONCLUÍDO em 12/ago/2026.** As caixas vazias abaixo preservam o roteiro
> histórico e não representam backlog atual. O estado implementado está em
> [NO-API.md](NO-API.md), [CONEXOES.md](CONEXOES.md) e
> [ESTADO.md](ESTADO.md). Para trabalho restante, use
> [PLANO-MESTRE.md](PLANO-MESTRE.md).

> **Para quem executa (humano ou agente):** use a skill
> `superpowers:subagent-driven-development` (recomendada) ou
> `superpowers:executing-plans` para tocar tarefa por tarefa. Os passos usam
> `- [ ]` para marcação.

**Objetivo:** dar ao AutoFluxos um sétimo bloco que chama uma API HTTP durante a
conversa, mapeia a resposta em variáveis e segue o fluxo — cobrindo Sheets (via
Apps Script), webhooks, n8n/Make/Zapier e consulta a sistemas do cliente.

**Arquitetura:** o motor continua puro. O nó `http` **descreve** a chamada
(`chamar_http`) e para em `aguardando_http`, exatamente como o nó de IA já faz;
quem executa é um resolvedor no servidor, que reentra no motor com
`http_respondeu`. O laço que hoje mora em `server/ia/conduzir.ts` vira
`server/efeitos/resolver.ts` e passa a atender IA e HTTP.

**Stack:** TypeScript, Zod, Vitest, Next 16 (rota Node), React Flow (`@xyflow/react`).

**Spec:** [docs/NO-API.md](NO-API.md). Onde plano e spec divergirem, o spec manda.

## Restrições globais

- **`src/core/` não faz rede, não importa Next, WhatsApp ou banco.** Vale para
  todas as tarefas. Se uma tarefa parecer exigir quebrar isso, ela está errada.
- **O motor nunca vê segredo.** `executar()` interpola só variáveis de sessão.
  `{{segredo.x}}` atravessa intacto porque o regex de `interpolar()` é
  `[a-zA-Z][a-zA-Z0-9_]*` e ponto não casa. Não mexa nesse regex.
- **Sem dependência nova.** Tudo com o que já está no `package.json` e as APIs
  nativas do Node.
- **Repositório público.** Nenhum valor de segredo, token ou URL de cliente
  entra em código, teste ou doc.
- Comandos: `npm test`, `npm run typecheck`. Ambos precisam passar antes de
  cada commit.
- Português no domínio; inglês só onde o React Flow impõe (`nodes`, `edges`,
  `type`, `data`, `position`, `sourceHandle`).
- Mensagens de commit no padrão do repo: `feat:`/`fix:`/`refactor:` + assunto
  curto em português, e terminando com a linha `Co-Authored-By`.

---

## Estrutura de arquivos

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `src/server/efeitos/rede.ts` | dizer se uma URL pode ser chamada (SSRF). Nada além disso |
| `src/server/efeitos/rede.test.ts` | cada faixa recusada, DNS dublado |
| `src/server/efeitos/http.ts` | emitir a requisição, aplicar timeout, extrair os valores |
| `src/server/efeitos/http.test.ts` | sucesso, erro, timeout, extração, cabeçalho de teste |
| `src/server/efeitos/resolver.ts` | o laço que atende `chamar_ia` e `chamar_http` |
| `src/server/efeitos/resolver.test.ts` | vem de `ia/conduzir.test.ts`, mais os casos de HTTP |

**Modificar:**

| Arquivo | O quê |
|---|---|
| `src/core/flow/schema.ts` | `noHttpSchema` + entrada na união |
| `src/core/engine/types.ts` | status `aguardando_http`, entrada `http_respondeu`, ação `chamar_http` |
| `src/core/engine/executar.ts` | emitir a ação no `avancar()`, tratar a reentrada |
| `src/core/flow/validar.ts` | impedimentos do nó, variáveis que ele define e cita |
| `src/server/receber-mensagem.ts` | trocar o import, passar `origem`, consertar comentário velho |
| `src/app/api/simular/route.ts` | trocar o import, passar `origem: 'simulador'` |
| `src/components/editor/nos.tsx` | o visual do bloco |
| `src/components/editor/editor.tsx` | catálogo e dados iniciais |
| `src/components/editor/painel.tsx` | o formulário |
| `src/components/conversa.tsx` | o evento na aba Testar e o aviso |

**Apagar:** `src/server/ia/conduzir.ts` e `src/server/ia/conduzir.test.ts`
(viram `efeitos/resolver.*` na Tarefa 6).

---

## Tarefa 1 — O schema do nó

**Arquivos:**
- Modifica: `src/core/flow/schema.ts`
- Testa: `src/core/flow/validar.test.ts` (arquivo já existe; o teste de schema entra nele)

**Interfaces:**
- Consome: nada
- Produz: `noHttpSchema`, `NoHttp`, `METODOS`, `Metodo`, `AO_FALHAR`, `AoFalhar`,
  `cabecalhoSchema`, `Cabecalho`, `mapeamentoSchema`, `Mapeamento`. `TipoNo`
  passa a incluir `'http'`.

- [ ] **Passo 1: escrever o teste que falha**

No fim de `src/core/flow/validar.test.ts`:

```ts
describe('schema do nó http', () => {
  it('nasce com os padrões certos quando só a URL é informada', () => {
    const no = noHttpSchema.parse({
      id: 'n1',
      position: { x: 0, y: 0 },
      type: 'http',
      data: { url: 'https://exemplo.com/x' },
    })

    expect(no.data.metodo).toBe('GET')
    expect(no.data.cabecalhos).toEqual([])
    expect(no.data.corpo).toBe('')
    expect(no.data.mapear).toEqual([])
    // Falhar fechado: quem esquecer de escolher não deixa ninguém pendurado.
    expect(no.data.aoFalhar).toBe('humano')
  })

  it('entra na união de nós, então um fluxo com ele é um fluxo válido', () => {
    const fluxo = fluxoSchema.parse({
      inicio: 'a',
      nodes: [
        { id: 'a', type: 'http', position: { x: 0, y: 0 }, data: { url: 'https://e.com' } },
      ],
      edges: [],
    })

    expect(fluxo.nodes[0]?.type).toBe('http')
  })
})
```

E no topo do arquivo, acrescente `noHttpSchema` ao import que já existe de
`./schema`.

- [ ] **Passo 2: rodar e ver falhar**

Roda: `npx vitest run src/core/flow/validar.test.ts`
Espera: FALHA com `noHttpSchema is not exported` ou `is not defined`.

- [ ] **Passo 3: implementar**

Em `src/core/flow/schema.ts`, depois de `noHandoffSchema` (linha ~104):

```ts
/** Verbos que o nó de API aceita. `GET` consulta, `POST` grava. */
export const METODOS = ['GET', 'POST'] as const
export type Metodo = (typeof METODOS)[number]

/**
 * O que fazer quando a chamada falha.
 *
 * O padrão é `humano` por decisão de produto (§9): quem garante a saída é o
 * sistema. `seguir` existe para enriquecimento opcional — o CEP não respondeu e
 * a conversa não deveria morrer por isso.
 */
export const AO_FALHAR = ['humano', 'seguir'] as const
export type AoFalhar = (typeof AO_FALHAR)[number]

export const cabecalhoSchema = z.object({
  chave: z.string(),
  valor: z.string(),
})

export const mapeamentoSchema = z.object({
  /** A variável que recebe o valor extraído. */
  variavel: nomeVariavel,
  /**
   * Caminho no JSON da resposta, com ponto e índice: `pedido.status`,
   * `resultados.0.nome`. Não é JSONPath: quase todo caso é campo raso, e o que
   * não for o cliente achata do lado dele. JSONPath seria uma linguagem
   * inteira para manter, testar e explicar.
   */
  caminho: z.string(),
})

export const noHttpSchema = z.object({
  ...base,
  type: z.literal('http'),
  data: z.object({
    metodo: z.enum(METODOS).default('GET'),
    /** Aceita `{{variavel}}` e, no futuro, `{{segredo.nome}}`. */
    url: z.string().default(''),
    cabecalhos: z.array(cabecalhoSchema).default([]),
    /** JSON escrito como texto. Aceita interpolação. */
    corpo: z.string().default(''),
    mapear: z.array(mapeamentoSchema).default([]),
    aoFalhar: z.enum(AO_FALHAR).default('humano'),
  }),
})
```

Acrescente `noHttpSchema` à união (linha ~106):

```ts
export const noSchema = z.discriminatedUnion('type', [
  noMensagemSchema,
  noPerguntaSchema,
  noCondicaoSchema,
  noSalvarCampoSchema,
  noIaSchema,
  noHandoffSchema,
  noHttpSchema,
])
```

E os tipos, junto dos outros no fim do arquivo:

```ts
export type Cabecalho = z.infer<typeof cabecalhoSchema>
export type Mapeamento = z.infer<typeof mapeamentoSchema>
export type NoHttp = z.infer<typeof noHttpSchema>
```

- [ ] **Passo 4: rodar e ver passar**

Roda: `npx vitest run src/core/flow/validar.test.ts && npm run typecheck`
Espera: PASSA. O `typecheck` pode acusar `switch` não exaustivo em
`validar.ts`, `executar.ts`, `nos.tsx`, `painel.tsx` e `editor.tsx` — **isso é
esperado** e as próximas tarefas resolvem. Se acusar, siga assim mesmo.

- [ ] **Passo 5: commit**

```bash
git add src/core/flow/schema.ts src/core/flow/validar.test.ts
git commit -m "feat: schema do nó de API

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 2 — O motor emite a chamada e volta com a resposta

**Arquivos:**
- Modifica: `src/core/engine/types.ts`, `src/core/engine/executar.ts`
- Testa: `src/core/engine/executar.test.ts`

**Interfaces:**
- Consome: `NoHttp`, `Metodo`, `AoFalhar`, `Cabecalho`, `Mapeamento` (Tarefa 1)
- Produz:
  - status `'aguardando_http'` em `statusSessaoSchema`
  - entrada `{ tipo: 'http_respondeu', valores: Record<string, string> }`
  - ação `{ tipo: 'chamar_http', metodo, url, cabecalhos, corpo, mapear, aoFalhar }`,
    com `url`, `corpo` e os `valor` dos cabeçalhos **já interpolados** com as
    variáveis da sessão

- [ ] **Passo 1: escrever os testes que falham**

Em `src/core/engine/executar.test.ts`, no fim do arquivo:

```ts
describe('nó de API', () => {
  const comApi: Fluxo = fluxoSchema.parse({
    inicio: 'consulta',
    nodes: [
      {
        id: 'consulta',
        type: 'http',
        position: p,
        data: {
          metodo: 'GET',
          url: 'https://exemplo.com/pedido/{{codigo}}?chave={{segredo.token}}',
          mapear: [{ variavel: 'situacao', caminho: 'pedido.status' }],
        },
      },
      { id: 'aviso', type: 'mensagem', position: p, data: { texto: 'Seu pedido está {{situacao}}.' } },
      { id: 'humano', type: 'handoff', position: p, data: { motivo: 'fim' } },
    ],
    edges: [
      { id: 'a1', source: 'consulta', target: 'aviso' },
      { id: 'a2', source: 'aviso', target: 'humano' },
    ],
  })

  const sessaoCom = (vars: Record<string, string>): Sessao => ({
    ...sessaoNova(),
    vars,
  })

  it('para no nó e descreve a chamada, sem executar nada', () => {
    const r = executar(comApi, sessaoCom({ codigo: 'AB12' }), { tipo: 'inicio' })

    expect(r.sessao.status).toBe('aguardando_http')
    expect(r.sessao.noAtual).toBe('consulta')
    expect(tipos(r.acoes)).toEqual(['chamar_http'])
  })

  it('interpola a variável da sessão na URL', () => {
    const r = executar(comApi, sessaoCom({ codigo: 'AB12' }), { tipo: 'inicio' })
    const acao = r.acoes[0]

    expect(acao?.tipo).toBe('chamar_http')
    if (acao?.tipo !== 'chamar_http') throw new Error('ação errada')
    expect(acao.url).toContain('/pedido/AB12')
  })

  it('NÃO toca em {{segredo.x}} — quem resolve segredo é o servidor', () => {
    const r = executar(comApi, sessaoCom({ codigo: 'AB12' }), { tipo: 'inicio' })
    const acao = r.acoes[0]

    if (acao?.tipo !== 'chamar_http') throw new Error('ação errada')
    expect(acao.url).toContain('chave={{segredo.token}}')
  })

  it('com a resposta, guarda os valores e segue o fluxo', () => {
    const parado = executar(comApi, sessaoCom({ codigo: 'AB12' }), { tipo: 'inicio' })
    const r = executar(comApi, parado.sessao, {
      tipo: 'http_respondeu',
      valores: { situacao: 'a caminho' },
    })

    expect(r.sessao.vars.situacao).toBe('a caminho')
    expect(tipos(r.acoes)).toEqual(['salvar_campo', 'enviar_texto', 'transferir_humano'])
    expect(textos(r.acoes)).toContain('Seu pedido está a caminho.')
  })

  it('ignora o que a pessoa escreve enquanto a chamada não voltou', () => {
    const parado = executar(comApi, sessaoCom({ codigo: 'AB12' }), { tipo: 'inicio' })
    const r = executar(comApi, parado.sessao, { tipo: 'texto', texto: 'oi?' })

    expect(r.acoes).toEqual([])
    expect(r.sessao.status).toBe('aguardando_http')
  })

  it('sem valores (o caso do aoFalhar seguir), continua mesmo assim', () => {
    const parado = executar(comApi, sessaoCom({ codigo: 'AB12' }), { tipo: 'inicio' })
    const r = executar(comApi, parado.sessao, { tipo: 'http_respondeu', valores: {} })

    expect(textos(r.acoes)).toContain('Seu pedido está .')
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Roda: `npx vitest run src/core/engine/executar.test.ts`
Espera: FALHA — `aguardando_http` não existe no enum e `http_respondeu` não é
uma entrada válida.

- [ ] **Passo 3: implementar os tipos**

Em `src/core/engine/types.ts`:

O import no topo passa a trazer os tipos do nó:

```ts
import type { AoFalhar, Cabecalho, Mapeamento, Metodo, Opcao } from '../flow/schema'
```

No `statusSessaoSchema`, depois de `'aguardando_ia'`:

```ts
  /** parada num nó de API, esperando a resposta da chamada */
  'aguardando_http',
```

No `entradaSchema`, depois de `ia_respondeu`:

```ts
  /**
   * O servidor chamou a API e trouxe os valores **já extraídos**. Quem entende
   * de JSON é o resolvedor; o motor só sabe manipular pares de nome e texto.
   */
  z.object({
    tipo: z.literal('http_respondeu'),
    valores: z.record(z.string(), z.string()),
  }),
```

No tipo `Acao`, depois de `chamar_ia`:

```ts
  /**
   * Chamar uma API e reentrar no motor com `{ tipo: 'http_respondeu' }`.
   *
   * `url`, `corpo` e os valores dos cabeçalhos já vêm interpolados com as
   * variáveis da sessão. O que **não** vem resolvido é `{{segredo.x}}` — isso é
   * trabalho do servidor, e de propósito: segredo que entrasse aqui entraria na
   * sessão, e a sessão viaja para o navegador no simulador.
   */
  | {
      tipo: 'chamar_http'
      metodo: Metodo
      url: string
      cabecalhos: Cabecalho[]
      corpo: string
      mapear: Mapeamento[]
      aoFalhar: AoFalhar
    }
```

- [ ] **Passo 4: implementar o motor**

Em `src/core/engine/executar.ts`, dentro do `switch` de `avancar()`, depois do
`case 'ia'`:

```ts
      case 'http': {
        acoes.push({
          tipo: 'chamar_http',
          metodo: no.data.metodo,
          url: interpolar(no.data.url, s.vars),
          cabecalhos: no.data.cabecalhos.map((c) => ({
            chave: c.chave,
            valor: interpolar(c.valor, s.vars),
          })),
          corpo: interpolar(no.data.corpo, s.vars),
          mapear: no.data.mapear,
          aoFalhar: no.data.aoFalhar,
        })
        s.noAtual = no.id
        s.status = 'aguardando_http'
        return { acoes, sessao: s }
      }
```

E em `executar()`, logo depois do bloco `if (atual.type === 'ia')` e antes do
`if (atual.type === 'pergunta')`:

```ts
  if (atual.type === 'http') {
    // A pessoa escreveu enquanto a chamada rodava: ignora, a resposta vem.
    if (entrada.tipo !== 'http_respondeu') return { acoes, sessao: s }

    for (const [variavel, valor] of Object.entries(entrada.valores)) {
      s.vars[variavel] = valor
      // Emitir `salvar_campo` faz o dado virar coluna na tela de leads sozinho,
      // porque as colunas de lá saem dos dados.
      acoes.push({ tipo: 'salvar_campo', campo: variavel, valor })
    }

    s.tentativas = 0
    return avancar(fluxo, porId, s, acoes, proximo(fluxo, atual.id))
  }
```

Repare no que **não** está aí: nenhuma decisão sobre sucesso ou falha. O motor
só recebe `http_respondeu` quando a chamada deu certo (ou quando `aoFalhar` é
`seguir`, e aí `valores` vem vazio). Falha com `aoFalhar: 'humano'` é resolvida
no servidor — é o que mantém o motor sem saber o que é um status HTTP.

- [ ] **Passo 5: rodar e ver passar**

Roda: `npx vitest run src/core/engine/executar.test.ts && npm run typecheck`
Espera: PASSA. `typecheck` ainda pode reclamar de `validar.ts` e dos arquivos de
UI — as próximas tarefas resolvem.

- [ ] **Passo 6: commit**

```bash
git add src/core/engine/types.ts src/core/engine/executar.ts src/core/engine/executar.test.ts
git commit -m "feat: o motor descreve a chamada de API e volta com os valores

Segue o mesmo desenho do nó de IA: descreve, para, e alguém de fora resolve.
O motor continua puro e {{segredo.x}} atravessa intacto — é o que faz o cofre
ser aditivo depois.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 3 — O validador

**Arquivos:**
- Modifica: `src/core/flow/validar.ts`
- Testa: `src/core/flow/validar.test.ts`

**Interfaces:**
- Consome: `NoHttp` (Tarefa 1)
- Produz: os códigos `URL_VAZIA`, `URL_INSEGURA`, `CORPO_INVALIDO` (erros),
  `SEGREDO_INEXISTENTE` (aviso), e `VARIAVEL_INVALIDA` reaproveitado para os
  nomes do `mapear`

- [ ] **Passo 1: escrever os testes que falham**

Em `src/core/flow/validar.test.ts`. Use o helper que o arquivo já tem para
montar fluxo; se não houver um, esta função local resolve:

```ts
describe('validação do nó de API', () => {
  const comHttp = (data: Record<string, unknown>) =>
    fluxoSchema.parse({
      inicio: 'api',
      nodes: [
        { id: 'api', type: 'http', position: { x: 0, y: 0 }, data },
        { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [{ id: 'a1', source: 'api', target: 'humano' }],
    })

  const codigos = (fluxo: Fluxo) => validar(fluxo).erros.map((e) => e.codigo)

  it('recusa URL vazia', () => {
    expect(codigos(comHttp({ url: '' }))).toContain('URL_VAZIA')
  })

  it('recusa URL que não é https', () => {
    expect(codigos(comHttp({ url: 'http://exemplo.com' }))).toContain('URL_INSEGURA')
  })

  it('aceita https', () => {
    expect(codigos(comHttp({ url: 'https://exemplo.com' }))).not.toContain('URL_INSEGURA')
  })

  it('recusa nome de variável inválido no mapeamento', () => {
    const fluxo = comHttp({
      url: 'https://e.com',
      mapear: [{ variavel: 'nome do lead', caminho: 'a' }],
    })
    expect(codigos(fluxo)).toContain('VARIAVEL_INVALIDA')
  })

  it('recusa POST com corpo que não é JSON', () => {
    const fluxo = comHttp({ url: 'https://e.com', metodo: 'POST', corpo: '{ nome: }' })
    expect(codigos(fluxo)).toContain('CORPO_INVALIDO')
  })

  it('aceita POST com corpo que usa {{variavel}}', () => {
    const fluxo = comHttp({
      url: 'https://e.com',
      metodo: 'POST',
      corpo: '{"nome": "{{nome}}", "idade": {{idade}}}',
    })
    expect(codigos(fluxo)).not.toContain('CORPO_INVALIDO')
  })

  it('não cobra corpo de GET', () => {
    const fluxo = comHttp({ url: 'https://e.com', metodo: 'GET', corpo: 'nada disso é JSON' })
    expect(codigos(fluxo)).not.toContain('CORPO_INVALIDO')
  })

  it('o que o nó mapeia conta como variável definida do fluxo', () => {
    const fluxo = fluxoSchema.parse({
      inicio: 'api',
      nodes: [
        {
          id: 'api',
          type: 'http',
          position: { x: 0, y: 0 },
          data: { url: 'https://e.com', mapear: [{ variavel: 'situacao', caminho: 's' }] },
        },
        { id: 'diz', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'está {{situacao}}' } },
        { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        { id: 'a1', source: 'api', target: 'diz' },
        { id: 'a2', source: 'diz', target: 'humano' },
      ],
    })

    expect(validar(fluxo).avisos.map((a) => a.codigo)).not.toContain('VARIAVEL_DESCONHECIDA')
  })

  it('avisa que o cofre de segredos ainda não existe', () => {
    const fluxo = comHttp({ url: 'https://e.com?k={{segredo.token}}' })
    expect(validar(fluxo).avisos.map((a) => a.codigo)).toContain('SEGREDO_INEXISTENTE')
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Roda: `npx vitest run src/core/flow/validar.test.ts`
Espera: FALHA — nenhum dos códigos novos é emitido.

- [ ] **Passo 3: implementar**

Em `src/core/flow/validar.ts`.

Primeiro, o padrão do segredo, logo abaixo dos imports:

```ts
/**
 * `{{segredo.nome}}` — o namespace reservado para o cofre da v2.
 *
 * Ele atravessa o motor sem ser tocado (o regex de `interpolar()` não casa com
 * ponto), então hoje sairia literal na requisição. Por isso o aviso: é erro de
 * quem desenhou, mas não trava publicação de fluxo que não depende disso.
 */
const CITA_SEGREDO = /\{\{\s*segredo\.[a-zA-Z][a-zA-Z0-9_]*\s*\}\}/
```

Em `conferirConteudo`, um `case` novo antes do `case 'handoff'`:

```ts
    case 'http': {
      if (vazio(no.data.url)) {
        erros.push({ codigo: 'URL_VAZIA', mensagem: 'Este bloco não diz qual endereço chamar.', noId: no.id })
      } else if (!no.data.url.trim().startsWith('https://')) {
        erros.push({
          codigo: 'URL_INSEGURA',
          mensagem: 'O endereço precisa começar com https:// — o servidor recusa qualquer outro.',
          noId: no.id,
        })
      }

      for (const item of no.data.mapear) {
        conferirVariavel(item.variavel, 'variável')
        if (vazio(item.variavel)) {
          erros.push({
            codigo: 'VARIAVEL_INVALIDA',
            mensagem: 'Um dos mapeamentos não diz em qual variável guardar.',
            noId: no.id,
          })
        }
      }

      if (no.data.metodo === 'POST' && !vazio(no.data.corpo) && !ehJsonComVariaveis(no.data.corpo)) {
        erros.push({
          codigo: 'CORPO_INVALIDO',
          mensagem: 'O corpo não é JSON válido.',
          noId: no.id,
        })
      }
      break
    }
```

E a função auxiliar, no fim do arquivo:

```ts
/**
 * O corpo é JSON válido, considerando que `{{variavel}}` ainda não virou nada.
 *
 * Troca cada `{{...}}` por `1` antes de conferir. O `1` é escolhido porque
 * funciona nos dois lugares onde uma variável aparece: dentro de aspas
 * (`{"nome": "1"}`) e fora delas (`{"idade": 1}`). Trocar por texto quebraria o
 * segundo caso, e recusar o corpo por causa disso puniria a forma correta de
 * escrever.
 */
function ehJsonComVariaveis(corpo: string): boolean {
  try {
    JSON.parse(corpo.replace(/\{\{[^}]*\}\}/g, '1'))
    return true
  } catch {
    return false
  }
}
```

Em `variaveisDoNo`, um `case` novo:

```ts
    case 'http':
      return [
        ...variaveisCitadas(no.data.url),
        ...variaveisCitadas(no.data.corpo),
        ...no.data.cabecalhos.flatMap((c) => variaveisCitadas(c.valor)),
      ]
```

Em `conferirVariaveis`, o nó também **define** variáveis — sem isso, todo
`{{situacao}}` vindo de uma API viraria `VARIAVEL_DESCONHECIDA`:

```ts
    if (no.type === 'http') {
      for (const item of no.data.mapear) definidas.add(item.variavel)
    }
```

E o aviso do segredo, dentro do mesmo laço de `conferirVariaveis` ou logo depois
dele — colocando junto do `return problemas`:

```ts
  for (const no of fluxo.nodes) {
    if (no.type !== 'http') continue
    const textos = [no.data.url, no.data.corpo, ...no.data.cabecalhos.map((c) => c.valor)]
    if (textos.some((t) => CITA_SEGREDO.test(t))) {
      problemas.push({
        codigo: 'SEGREDO_INEXISTENTE',
        mensagem:
          'Este bloco usa {{segredo.…}}, e o cofre de segredos ainda não existe. Hoje isso sai literal na chamada.',
        noId: no.id,
      })
    }
  }
```

- [ ] **Passo 4: rodar e ver passar**

Roda: `npx vitest run src/core/flow && npm run typecheck`
Espera: PASSA. O `typecheck` agora só deve reclamar dos arquivos de UI.

- [ ] **Passo 5: commit**

```bash
git add src/core/flow/validar.ts src/core/flow/validar.test.ts
git commit -m "feat: o validador cobra o que o nó de API precisa ter

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 4 — A recusa de rede (SSRF)

Uma URL configurável executada pelo nosso servidor é SSRF por construção: quem
edita o fluxo passa a poder fazer a Vercel emitir requisições para qualquer
endereço alcançável a partir dela — incluindo o serviço de metadados da nuvem,
que entrega credencial. Hoje só o operador edita, mas o BRIEF-UI §6 prevê o
cliente com acesso, e essa porta não pode estar aberta quando ele chegar.

Esta tarefa é só a recusa. Ela não faz requisição nenhuma.

**Arquivos:**
- Cria: `src/server/efeitos/rede.ts`
- Testa: `src/server/efeitos/rede.test.ts`

**Interfaces:**
- Consome: nada
- Produz: `conferirEndereco(url: string): Promise<Veredito>` onde
  `type Veredito = { ok: true } | { ok: false; motivo: string }`

- [ ] **Passo 1: escrever o teste que falha**

Cria `src/server/efeitos/rede.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

const lookup = vi.hoisted(() => vi.fn())
vi.mock('node:dns/promises', () => ({ lookup }))

const { conferirEndereco } = await import('./rede')

/** Faz o DNS responder o que o teste quiser, no formato de `lookup(h, {all})`. */
function dnsResponde(...enderecos: string[]) {
  lookup.mockResolvedValue(
    enderecos.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })),
  )
}

describe('conferirEndereco', () => {
  it('aceita https que resolve para endereço público', async () => {
    dnsResponde('93.184.216.34')
    expect(await conferirEndereco('https://exemplo.com/x')).toEqual({ ok: true })
  })

  it('recusa http', async () => {
    dnsResponde('93.184.216.34')
    const v = await conferirEndereco('http://exemplo.com')
    expect(v.ok).toBe(false)
  })

  it('recusa URL que não dá para ler', async () => {
    const v = await conferirEndereco('não é uma url')
    expect(v.ok).toBe(false)
  })

  it.each([
    ['127.0.0.1', 'loopback'],
    ['10.1.2.3', 'rede privada 10/8'],
    ['172.16.0.1', 'rede privada 172.16/12'],
    ['172.31.255.254', 'fim da faixa 172'],
    ['192.168.1.1', 'rede privada 192.168/16'],
    ['169.254.169.254', 'metadados da nuvem'],
    ['0.0.0.0', 'endereço nulo'],
    ['100.64.0.1', 'CGNAT'],
  ])('recusa %s (%s)', async (ip) => {
    dnsResponde(ip)
    const v = await conferirEndereco('https://parece-inocente.com')
    expect(v.ok).toBe(false)
  })

  it('aceita 172.15 e 172.32, que estão FORA da faixa privada', async () => {
    dnsResponde('172.15.0.1')
    expect(await conferirEndereco('https://a.com')).toEqual({ ok: true })
    dnsResponde('172.32.0.1')
    expect(await conferirEndereco('https://a.com')).toEqual({ ok: true })
  })

  it.each([['::1'], ['fc00::1'], ['fe80::1']])('recusa o IPv6 %s', async (ip) => {
    dnsResponde(ip)
    const v = await conferirEndereco('https://a.com')
    expect(v.ok).toBe(false)
  })

  it('recusa IPv4 disfarçado de IPv6', async () => {
    dnsResponde('::ffff:127.0.0.1')
    const v = await conferirEndereco('https://a.com')
    expect(v.ok).toBe(false)
  })

  it('basta UM endereço ruim para recusar', async () => {
    dnsResponde('93.184.216.34', '127.0.0.1')
    const v = await conferirEndereco('https://a.com')
    expect(v.ok).toBe(false)
  })

  it('recusa quando o DNS não resolve', async () => {
    lookup.mockRejectedValue(new Error('ENOTFOUND'))
    const v = await conferirEndereco('https://nao-existe.invalid')
    expect(v.ok).toBe(false)
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Roda: `npx vitest run src/server/efeitos/rede.test.ts`
Espera: FALHA — o módulo `./rede` não existe.

- [ ] **Passo 3: implementar**

Cria `src/server/efeitos/rede.ts`:

```ts
import 'server-only'
import { lookup } from 'node:dns/promises'

/**
 * Quem pode ser chamado pelo nó de API.
 *
 * Uma URL que o usuário digita e o nosso servidor executa é SSRF por
 * construção. A recusa mora aqui, no servidor, e não no editor: validação de
 * tela é conveniência, e a recusa precisa valer venha a chamada de onde vier —
 * a mesma lógica que `publicar()` já aplica ao validador.
 *
 * A conferência é feita sobre o **endereço resolvido**, não sobre o nome: um
 * domínio público pode apontar para 127.0.0.1, e é exatamente assim que esse
 * ataque costuma ser escrito.
 */

export type Veredito = { ok: true } | { ok: false; motivo: string }

export async function conferirEndereco(url: string): Promise<Veredito> {
  let alvo: URL
  try {
    alvo = new URL(url)
  } catch {
    return { ok: false, motivo: 'o endereço não é uma URL válida' }
  }

  if (alvo.protocol !== 'https:') {
    return { ok: false, motivo: 'só https é aceito' }
  }

  let enderecos: { address: string }[]
  try {
    enderecos = await lookup(alvo.hostname, { all: true })
  } catch {
    return { ok: false, motivo: `não foi possível resolver "${alvo.hostname}"` }
  }

  if (enderecos.length === 0) {
    return { ok: false, motivo: `"${alvo.hostname}" não resolveu para endereço nenhum` }
  }

  // Basta um endereço ruim: um nome que resolve para vários é justamente o
  // jeito de esconder o alvo interno atrás de um público.
  for (const { address } of enderecos) {
    if (ehInterno(address)) {
      return { ok: false, motivo: `"${alvo.hostname}" aponta para um endereço interno` }
    }
  }

  return { ok: true }
}

/** `true` para tudo que não deveria ser alcançável a partir de um fluxo. */
export function ehInterno(endereco: string): boolean {
  const limpo = endereco.trim().toLowerCase()

  // IPv4 disfarçado de IPv6 (`::ffff:127.0.0.1`) — a mesma rede, outro nome.
  const mapeado = limpo.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapeado?.[1]) return ehInterno(mapeado[1])

  if (limpo.includes(':')) return ehIpv6Interno(limpo)

  const partes = limpo.split('.').map(Number)
  if (partes.length !== 4 || partes.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    // Não sabemos o que é. Recusar é a resposta segura.
    return true
  }

  const [a = 0, b = 0] = partes

  if (a === 0) return true                       // 0.0.0.0/8
  if (a === 10) return true                      // privada
  if (a === 127) return true                     // loopback
  if (a === 169 && b === 254) return true        // link-local e metadados da nuvem
  if (a === 172 && b >= 16 && b <= 31) return true // privada
  if (a === 192 && b === 168) return true        // privada
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true                      // multicast e reservado

  return false
}

function ehIpv6Interno(endereco: string): boolean {
  if (endereco === '::' || endereco === '::1') return true
  // fc00::/7 (único local) e fe80::/10 (link-local).
  return /^f[cd]/.test(endereco) || /^fe[89ab]/.test(endereco)
}
```

- [ ] **Passo 4: rodar e ver passar**

Roda: `npx vitest run src/server/efeitos/rede.test.ts`
Espera: PASSA, 15 testes.

- [ ] **Passo 5: commit**

```bash
git add src/server/efeitos/rede.ts src/server/efeitos/rede.test.ts
git commit -m "feat: recusa de endereço interno para o nó de API

A conferência é sobre o IP resolvido, não sobre o nome: domínio público que
aponta para 127.0.0.1 é como esse ataque costuma ser escrito.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 5 — O disparo da requisição

**Arquivos:**
- Cria: `src/server/efeitos/http.ts`
- Testa: `src/server/efeitos/http.test.ts`

**Interfaces:**
- Consome: `conferirEndereco` (Tarefa 4), o tipo da ação `chamar_http` (Tarefa 2)
- Produz:
  - `chamarHttp(pedido: PedidoHttp, opcoes: { deTeste: boolean }): Promise<RespostaHttp>`
  - `type PedidoHttp = Extract<Acao, { tipo: 'chamar_http' }>`
  - `type RespostaHttp = { ok: true; valores: Record<string, string> } | { ok: false; motivo: string }`
  - `extrair(json: unknown, caminho: string): string`
  - `TIMEOUT_MS = 10_000`, `CABECALHO_TESTE = 'X-AutoFluxos-Teste'`

- [ ] **Passo 1: escrever o teste que falha**

Cria `src/server/efeitos/http.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

const conferirEndereco = vi.hoisted(() => vi.fn())
vi.mock('./rede', () => ({ conferirEndereco }))

const { chamarHttp, extrair, CABECALHO_TESTE } = await import('./http')
import type { PedidoHttp } from './http'

const pedido = (mudanca: Partial<PedidoHttp> = {}): PedidoHttp => ({
  tipo: 'chamar_http',
  metodo: 'GET',
  url: 'https://exemplo.com/pedido',
  cabecalhos: [],
  corpo: '',
  mapear: [],
  aoFalhar: 'humano',
  ...mudanca,
})

function fetchResponde(corpo: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  conferirEndereco.mockReset()
})

describe('extrair', () => {
  const dados = { pedido: { status: 'a caminho' }, itens: [{ nome: 'Camisa' }], total: 42, pago: true }

  it('lê campo raso', () => expect(extrair(dados, 'total')).toBe('42'))
  it('lê caminho com ponto', () => expect(extrair(dados, 'pedido.status')).toBe('a caminho'))
  it('lê índice de lista', () => expect(extrair(dados, 'itens.0.nome')).toBe('Camisa'))
  it('booleano vira texto', () => expect(extrair(dados, 'pago')).toBe('true'))
  it('caminho que não existe vira vazio', () => expect(extrair(dados, 'nada.aqui')).toBe(''))
  it('objeto inteiro vira JSON', () => expect(extrair(dados, 'pedido')).toBe('{"status":"a caminho"}'))
})

describe('chamarHttp', () => {
  it('recusa antes de chamar quando o endereço é interno', async () => {
    conferirEndereco.mockResolvedValue({ ok: false, motivo: 'endereço interno' })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    const r = await chamarHttp(pedido(), { deTeste: false })

    expect(r.ok).toBe(false)
    expect(espiao).not.toHaveBeenCalled()
  })

  it('mapeia a resposta nas variáveis pedidas', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchResponde({ pedido: { status: 'a caminho' } }))

    const r = await chamarHttp(
      pedido({ mapear: [{ variavel: 'situacao', caminho: 'pedido.status' }] }),
      { deTeste: false },
    )

    expect(r).toEqual({ ok: true, valores: { situacao: 'a caminho' } })
  })

  it('sem mapear, não liga para o que voltou — é o webhook disparado e esquecido', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchResponde('isto não é JSON'))

    const r = await chamarHttp(pedido(), { deTeste: false })

    expect(r).toEqual({ ok: true, valores: {} })
  })

  it('com mapear, resposta que não é JSON é falha', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchResponde('isto não é JSON'))

    const r = await chamarHttp(
      pedido({ mapear: [{ variavel: 'x', caminho: 'a' }] }),
      { deTeste: false },
    )

    expect(r.ok).toBe(false)
  })

  it('status fora de 2xx é falha', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchResponde({ erro: 'ops' }, 500))

    const r = await chamarHttp(pedido(), { deTeste: false })

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('deveria ter falhado')
    expect(r.motivo).toContain('500')
  })

  it('POST manda o corpo e o content-type', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido({ metodo: 'POST', corpo: '{"a":1}' }), { deTeste: false })

    const [, init] = espiao.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"a":1}')
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
  })

  it('marca o disparo vindo do simulador', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido(), { deTeste: true })

    const [, init] = espiao.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get(CABECALHO_TESTE)).toBe('1')
  })

  it('não marca o disparo vindo do WhatsApp', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido(), { deTeste: false })

    const [, init] = espiao.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get(CABECALHO_TESTE)).toBeNull()
  })

  it('rede que estoura vira falha com motivo, não exceção', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket hang up')))

    const r = await chamarHttp(pedido(), { deTeste: false })

    expect(r.ok).toBe(false)
  })

  it('redirecionamento passa pela mesma recusa de endereço', async () => {
    conferirEndereco.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, motivo: 'interno' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, { status: 302, headers: { location: 'https://interno.local/' } }),
      ),
    )

    const r = await chamarHttp(pedido(), { deTeste: false })

    expect(r.ok).toBe(false)
    expect(conferirEndereco).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Roda: `npx vitest run src/server/efeitos/http.test.ts`
Espera: FALHA — o módulo `./http` não existe.

- [ ] **Passo 3: implementar**

Cria `src/server/efeitos/http.ts`:

```ts
import 'server-only'
import type { Acao } from '@/core/engine/types'
import { conferirEndereco } from './rede'

/**
 * O disparo da chamada do nó de API.
 *
 * O que este arquivo NÃO faz: decidir o que a conversa vira depois. Ele devolve
 * "deu certo, com estes valores" ou "falhou, por isto" — quem transforma isso
 * em handoff ou em continuação é o resolvedor, porque essa é decisão de fluxo.
 */

export type PedidoHttp = Extract<Acao, { tipo: 'chamar_http' }>

export type RespostaHttp =
  | { ok: true; valores: Record<string, string> }
  | { ok: false; motivo: string }

/**
 * O processamento roda dentro de `after()`, então o corte de 20s da Meta não se
 * aplica aqui. O limite real é a paciência de quem está esperando no WhatsApp.
 */
export const TIMEOUT_MS = 10_000

/** Marca o disparo que veio da aba Testar, para o outro lado poder filtrar. */
export const CABECALHO_TESTE = 'X-AutoFluxos-Teste'

/** Quantos redirecionamentos seguir. Cada salto é reconferido. */
const MAX_SALTOS = 3

export async function chamarHttp(
  pedido: PedidoHttp,
  { deTeste }: { deTeste: boolean },
): Promise<RespostaHttp> {
  let url = pedido.url
  let resposta: Response

  for (let salto = 0; ; salto++) {
    const veredito = await conferirEndereco(url)
    if (!veredito.ok) return { ok: false, motivo: veredito.motivo }

    if (salto >= MAX_SALTOS) {
      return { ok: false, motivo: 'a chamada redirecionou vezes demais' }
    }

    try {
      resposta = await fetch(url, {
        method: pedido.metodo,
        headers: montarCabecalhos(pedido, deTeste),
        body: pedido.metodo === 'POST' ? pedido.corpo : undefined,
        // Seguir sozinho pularia a conferência de endereço no destino, que é
        // exatamente por onde o ataque entraria.
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (erro) {
      const motivo = erro instanceof Error && erro.name === 'TimeoutError'
        ? `a chamada passou de ${TIMEOUT_MS / 1000}s sem responder`
        : 'a chamada não completou'
      return { ok: false, motivo }
    }

    const destino = resposta.status >= 300 && resposta.status < 400
      ? resposta.headers.get('location')
      : null

    if (!destino) break
    url = new URL(destino, url).toString()
  }

  if (!resposta.ok) {
    return { ok: false, motivo: `a chamada respondeu ${resposta.status}` }
  }

  // Sem mapeamento, o que voltou não interessa: é o webhook disparado e
  // esquecido, que é metade do valor deste nó.
  if (pedido.mapear.length === 0) return { ok: true, valores: {} }

  let json: unknown
  try {
    json = await resposta.json()
  } catch {
    return { ok: false, motivo: 'a resposta não é JSON, e o bloco pede campos dela' }
  }

  const valores: Record<string, string> = {}
  for (const { variavel, caminho } of pedido.mapear) {
    valores[variavel] = extrair(json, caminho)
  }

  return { ok: true, valores }
}

function montarCabecalhos(pedido: PedidoHttp, deTeste: boolean): Headers {
  const cabecalhos = new Headers()
  for (const { chave, valor } of pedido.cabecalhos) {
    if (chave.trim() !== '') cabecalhos.set(chave, valor)
  }
  if (pedido.metodo === 'POST' && !cabecalhos.has('content-type')) {
    cabecalhos.set('content-type', 'application/json')
  }
  if (deTeste) cabecalhos.set(CABECALHO_TESTE, '1')
  return cabecalhos
}

/**
 * Lê `pedido.status` ou `itens.0.nome` de dentro do JSON.
 *
 * Deliberadamente não é JSONPath: quase todo caso real é um campo raso, e o que
 * não for o cliente achata do lado dele. Tudo sai como texto, porque é só isso
 * que as variáveis da sessão sabem guardar.
 */
export function extrair(json: unknown, caminho: string): string {
  let atual: unknown = json

  for (const parte of caminho.split('.')) {
    if (atual === null || atual === undefined) return ''
    if (typeof atual !== 'object') return ''
    atual = (atual as Record<string, unknown>)[parte]
  }

  if (atual === null || atual === undefined) return ''
  if (typeof atual === 'object') return JSON.stringify(atual)
  return String(atual)
}
```

- [ ] **Passo 4: rodar e ver passar**

Roda: `npx vitest run src/server/efeitos && npm run typecheck`
Espera: PASSA.

- [ ] **Passo 5: commit**

```bash
git add src/server/efeitos/http.ts src/server/efeitos/http.test.ts
git commit -m "feat: dispara a chamada do nó de API, com timeout e sem retry

Sem retry de propósito: POST não é idempotente e repetir um timeout criaria
dois registros no sistema do cliente.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 6 — O resolvedor único (IA + API)

O laço que hoje resolve só IA passa a resolver os dois efeitos. Continua sendo
**um só**, usado pelo simulador e pelo WhatsApp — é o que impede duas
implementações se comportando diferente.

**Arquivos:**
- Cria: `src/server/efeitos/resolver.ts` (conteúdo vem de `src/server/ia/conduzir.ts`)
- Cria: `src/server/efeitos/resolver.test.ts` (conteúdo vem de `src/server/ia/conduzir.test.ts`)
- Apaga: `src/server/ia/conduzir.ts`, `src/server/ia/conduzir.test.ts`
- Modifica: `src/server/receber-mensagem.ts`, `src/app/api/simular/route.ts`

**Interfaces:**
- Consome: `chamarHttp` (Tarefa 5), `executar` (Tarefa 2)
- Produz: `executarComEfeitos(fluxo, sessao, entrada, opcoes: OpcoesDeEfeitos): Promise<Resultado>`,
  onde `OpcoesDeEfeitos` é o antigo `OpcoesDeIa` mais
  `origem: 'simulador' | 'whatsapp'`. Também exporta `MAX_EFEITOS = 10`.

- [ ] **Passo 1: mover os arquivos, sem mudar comportamento**

```bash
git mv src/server/ia/conduzir.ts src/server/efeitos/resolver.ts
git mv src/server/ia/conduzir.test.ts src/server/efeitos/resolver.test.ts
```

Em `resolver.ts`, o único import relativo a corrigir é
`import type { Modelo, Turno } from './types'`, que vira `'../ia/types'` — os
outros (`@/core/engine/executar`, `@/core/engine/types`, `@/core/flow/schema`)
são absolutos e não mudam. Renomeie `executarComIa` → `executarComEfeitos` e
`OpcoesDeIa` → `OpcoesDeEfeitos`. Em `resolver.test.ts`, ajuste o import de
`'./conduzir'` para `'./resolver'` e os dois nomes.

Atualize os dois chamadores:
- `src/server/receber-mensagem.ts` linha ~6:
  `import { executarComEfeitos, type OpcoesDeEfeitos } from './efeitos/resolver'`
- `src/app/api/simular/route.ts` linha ~4:
  `import { executarComEfeitos } from '@/server/efeitos/resolver'`

E os nomes nas chamadas.

- [ ] **Passo 2: rodar e ver tudo continuar passando**

Roda: `npm test && npm run typecheck`
Espera: PASSA, mesmos números de antes. Se falhar, é import errado — conserte
antes de seguir. Este passo é só mudança de endereço.

- [ ] **Passo 3: commit da mudança de endereço**

```bash
git add -A
git commit -m "refactor: o laço de IA vira o resolvedor de efeitos externos

Só muda de lugar e de nome. O nó de API entra nele no commit seguinte.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Passo 4: escrever os testes que falham**

Em `src/server/efeitos/resolver.test.ts`, no fim:

```ts
describe('resolvendo o nó de API', () => {
  const comApi = fluxoSchema.parse({
    inicio: 'consulta',
    nodes: [
      {
        id: 'consulta',
        type: 'http',
        position: { x: 0, y: 0 },
        data: { url: 'https://e.com', mapear: [{ variavel: 'situacao', caminho: 'status' }] },
      },
      { id: 'diz', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'está {{situacao}}' } },
      { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [
      { id: 'a1', source: 'consulta', target: 'diz' },
      { id: 'a2', source: 'diz', target: 'humano' },
    ],
  })

  const semIa = { modelo: null, contextoNegocio: '', origem: 'whatsapp' as const }

  it('chama, mapeia e a conversa segue', async () => {
    chamarHttp.mockResolvedValue({ ok: true, valores: { situacao: 'a caminho' } })

    const r = await executarComEfeitos(comApi, sessaoNova(), { tipo: 'inicio' }, semIa)

    expect(r.acoes.some((a) => a.tipo === 'chamar_http')).toBe(false)
    expect(r.acoes.filter((a) => a.tipo === 'enviar_texto').map((a) => a.texto)).toContain(
      'está a caminho',
    )
  })

  it('falha com aoFalhar humano passa a conversa e diz o motivo real', async () => {
    chamarHttp.mockResolvedValue({ ok: false, motivo: 'a chamada respondeu 500' })

    const r = await executarComEfeitos(comApi, sessaoNova(), { tipo: 'inicio' }, semIa)

    expect(r.sessao.status).toBe('humano')
    const transferencia = r.acoes.find((a) => a.tipo === 'transferir_humano')
    if (transferencia?.tipo !== 'transferir_humano') throw new Error('faltou a transferência')
    expect(transferencia.motivo).toContain('500')
  })

  it('falha com aoFalhar seguir continua a conversa com a variável vazia', async () => {
    const tolerante = fluxoSchema.parse({
      ...comApi,
      nodes: comApi.nodes.map((n) =>
        n.id === 'consulta' ? { ...n, data: { ...n.data, aoFalhar: 'seguir' } } : n,
      ),
    })
    chamarHttp.mockResolvedValue({ ok: false, motivo: 'caiu' })

    const r = await executarComEfeitos(tolerante, sessaoNova(), { tipo: 'inicio' }, semIa)

    expect(r.sessao.status).not.toBe('humano')
    expect(r.acoes.filter((a) => a.tipo === 'enviar_texto').map((a) => a.texto)).toContain('está ')
  })

  it('marca como teste quando a origem é o simulador', async () => {
    chamarHttp.mockResolvedValue({ ok: true, valores: {} })

    await executarComEfeitos(comApi, sessaoNova(), { tipo: 'inicio' }, {
      ...semIa,
      origem: 'simulador',
    })

    expect(chamarHttp).toHaveBeenCalledWith(expect.anything(), { deTeste: true })
  })

  it('a trava para o encadeamento sem fim, e conta IA e API juntas', async () => {
    // Um bloco de API ligado em si mesmo: sem trava, o laço nunca sai daqui.
    const ciclo = fluxoSchema.parse({
      inicio: 'consulta',
      nodes: [
        { id: 'consulta', type: 'http', position: { x: 0, y: 0 }, data: { url: 'https://e.com' } },
        { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [{ id: 'a1', source: 'consulta', target: 'consulta' }],
    })
    chamarHttp.mockResolvedValue({ ok: true, valores: {} })

    await executarComEfeitos(ciclo, sessaoNova(), { tipo: 'inicio' }, semIa)

    expect(chamarHttp).toHaveBeenCalledTimes(MAX_EFEITOS)
  })
})
```

No topo do arquivo, o dublê e os imports que faltam:

```ts
const chamarHttp = vi.hoisted(() => vi.fn())
vi.mock('./http', () => ({ chamarHttp }))
```

Mais `fluxoSchema` de `@/core/flow/schema`, `sessaoNova` de
`@/core/engine/types` e `MAX_EFEITOS` de `./resolver`, se ainda não estiverem
importados. Como `resolver.ts` faz `import ... from './http'`, o `vi.mock` tem
que ser **hoisted** — daí o `vi.hoisted`; declarar o dublê depois do import não
funciona.

`MAX_EFEITOS` precisa ser exportado para o teste da trava. Marque isso agora:
no Passo 6, a constante sai como `export const MAX_EFEITOS = 10`.

- [ ] **Passo 5: rodar e ver falhar**

Roda: `npx vitest run src/server/efeitos/resolver.test.ts`
Espera: FALHA — `chamar_http` não é atendido, então a ação sobra na lista.

- [ ] **Passo 6: implementar**

Em `src/server/efeitos/resolver.ts`.

A trava de encadeamento sobe:

```ts
/**
 * Trava contra fluxo que encadeia efeitos externos sem fim.
 *
 * Era 3, calibrado para IA, onde encadear é sinal de fluxo errado. Com API é
 * diferente: consultar o CEP, gravar no CRM e avisar no Slack na mesma passada
 * são três chamadas de um fluxo perfeitamente sensato. A trava continua
 * existindo para matar ciclo, não para limitar desenho — por isso sobe.
 */
export const MAX_EFEITOS = 10
```

`OpcoesDeEfeitos` ganha a origem:

```ts
  /** De onde veio a conversa. Marca o disparo do simulador para o outro lado filtrar. */
  origem: 'simulador' | 'whatsapp'
```

E o laço passa a atender os dois efeitos. Substitua o corpo do `for` por:

```ts
  for (let volta = 0; volta < MAX_EFEITOS; volta++) {
    const chamadaIa = resultado.acoes.find((a) => a.tipo === 'chamar_ia')
    const chamadaHttp = resultado.acoes.find((a) => a.tipo === 'chamar_http')

    if (chamadaHttp?.tipo === 'chamar_http') {
      const resposta = await chamarHttp(chamadaHttp, { deTeste: opcoes.origem === 'simulador' })

      if (!resposta.ok && chamadaHttp.aoFalhar === 'humano') {
        return {
          acoes: [
            ...semEfeito(resultado.acoes, 'chamar_http'),
            { tipo: 'enviar_texto', texto: AVISO_DE_HANDOFF },
            { tipo: 'transferir_humano', motivo: `a integração falhou — ${resposta.motivo}` },
          ],
          sessao: { ...resultado.sessao, status: 'humano' },
        }
      }

      // `aoFalhar: 'seguir'` reentra sem valores: a conversa continua e a
      // variável fica vazia, que é como o produto já trata variável ausente.
      const seguinte = executar(fluxo, resultado.sessao, {
        tipo: 'http_respondeu',
        valores: resposta.ok ? resposta.valores : {},
      })

      resultado = {
        acoes: [...semEfeito(resultado.acoes, 'chamar_http'), ...seguinte.acoes],
        sessao: seguinte.sessao,
      }
      continue
    }

    if (!chamadaIa || chamadaIa.tipo !== 'chamar_ia') return resultado

    // Sem modelo, `chamar_ia` continua na lista e quem chamou decide o que
    // fazer — hoje, mandar para uma pessoa. Nunca fingir que respondeu.
    if (!opcoes.modelo) return resultado

    const resposta = await opcoes.modelo.responder({
      contextoNegocio: opcoes.contextoNegocio,
      instrucao: chamadaIa.instrucao,
      pergunta,
      historico: opcoes.historico,
    })

    if (resposta.tipo === 'nao_sei') {
      return {
        acoes: [
          ...semEfeito(resultado.acoes, 'chamar_ia'),
          { tipo: 'enviar_texto', texto: AVISO_DE_HANDOFF },
          { tipo: 'transferir_humano', motivo: `a IA não soube responder — ${resposta.motivo}` },
        ],
        sessao: { ...resultado.sessao, status: 'humano' },
      }
    }

    const seguinte = executar(fluxo, resultado.sessao, {
      tipo: 'ia_respondeu',
      texto: resposta.texto,
    })

    resultado = {
      acoes: [...semEfeito(resultado.acoes, 'chamar_ia'), ...seguinte.acoes],
      sessao: seguinte.sessao,
    }
  }
```

E `semChamada` vira genérica:

```ts
/**
 * Tira o pedido de efeito da lista depois de atendido.
 *
 * Se ficasse, quem aplica as ações veria um pedido já respondido e mandaria a
 * conversa para um humano em cima de algo que deu certo.
 */
function semEfeito(acoes: Acao[], tipo: 'chamar_ia' | 'chamar_http'): Acao[] {
  return acoes.filter((a) => a.tipo !== tipo)
}
```

O import do topo: `import { chamarHttp } from './http'`.

- [ ] **Passo 7: fechar as pontas nos chamadores**

Em `src/app/api/simular/route.ts`, a chamada passa a mandar a origem:

```ts
  return Response.json(
    await executarComEfeitos(fluxo, sessao, entrada, {
      modelo,
      contextoNegocio,
      historico,
      origem: 'simulador',
    }),
  )
```

Em `src/server/receber-mensagem.ts`:

1. `prepararIa` devolve `OpcoesDeEfeitos`, então o objeto `vazio` e o retorno
   ganham `origem: 'whatsapp'`.
2. O `switch` de `aplicar()` precisa de um `case 'chamar_http'`. Ele só é
   alcançado se o resolvedor deixar passar, o que não deveria acontecer —
   tratar como handoff é a resposta segura:

```ts
      case 'chamar_http':
        // O resolvedor sempre atende esta ação. Chegar aqui é defeito nosso, e
        // deixar alguém pendurado é pior do que passar para uma pessoa.
        await registrarHandoff(sessaoId, 'a integração não foi executada')
        break
```

3. **Consertar o comentário velho** no `case 'chamar_ia'` (linha ~248). Ele diz
   "A IA é a Etapa 2 e ainda não existe", o que deixou de ser verdade quando o
   módulo de IA foi construído. O comportamento está certo — é o caminho de
   quando não há modelo. Troque o texto por:

```ts
        // Só chega aqui quando não há modelo disponível (sem plano contratado
        // ou sem chave). O fluxo publicado pede IA e ninguém pode responder,
        // então a conversa vai para uma pessoa em vez de ficar pendurada.
```

- [ ] **Passo 8: rodar e ver passar**

Roda: `npm test && npm run typecheck`
Espera: PASSA. Os testes de `core/` que rodam sem `.env` continuam passando; os
de banco continuam se pulando.

- [ ] **Passo 9: commit**

```bash
git add -A
git commit -m "feat: o resolvedor atende IA e API no mesmo laço

Um resolvedor só, usado pelo simulador e pelo WhatsApp — é o que impede duas
implementações se comportando diferente. A trava de encadeamento sobe de 3 para
10, porque encadear chamadas de API é fluxo sensato e encadear IA não é.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 7 — O bloco no editor

**Arquivos:**
- Modifica: `src/components/editor/nos.tsx`, `src/components/editor/editor.tsx`,
  `src/components/editor/painel.tsx`
- Testa: manual (não há teste de componente no repo hoje; não introduza a
  ferramenta agora)

**Interfaces:**
- Consome: `NoHttp`, `METODOS`, `Cabecalho`, `Mapeamento` (Tarefa 1)
- Produz: `'http'` presente em `CORES`, `ICONES`, `NOMES`, `tiposDeNo`, `TIPOS`,
  `DESCRICOES` e `dadosPadrao`

- [ ] **Passo 1: o visual do bloco**

Em `src/components/editor/nos.tsx`, acrescente às três tabelas do topo:

```ts
const CORES = {
  // ...
  http: 'border-cyan-400/30',
} as const

export const ICONES = {
  // ...
  http: '⇄',
} as const

export const NOMES = {
  // ...
  http: 'API',
} as const
```

O componente, junto dos outros:

```tsx
function NoHttp({ data, selected }: NodeProps) {
  const d = data as { metodo: string; url: string; mapear: { variavel: string }[] }
  return (
    <Caixa tipo="http" selecionado={!!selected}>
      <p className="truncate text-[12.5px] leading-5 text-soft">
        <span className="font-mono text-[10px] text-[#8de2fa]">{d.metodo}</span>{' '}
        {vazio(d.url, '(sem endereço)')}
      </p>
      {d.mapear.length > 0 && (
        <p className="mt-1 font-mono text-[10px] text-dim">
          guarda {d.mapear.map((m) => m.variavel).join(', ')}
        </p>
      )}
    </Caixa>
  )
}
```

E o registro no fim:

```ts
export const tiposDeNo: NodeTypes = {
  // ...
  http: NoHttp,
}
```

- [ ] **Passo 2: o catálogo**

Em `src/components/editor/editor.tsx`:

```ts
const TIPOS: TipoNo[] = ['mensagem', 'pergunta', 'condicao', 'salvar-campo', 'ia', 'handoff', 'http']

const DESCRICOES: Record<TipoNo, string> = {
  // ...
  http: 'Chama um sistema',
}
```

E em `dadosPadrao`, um `case` novo. Ele nasce com um endereço de exemplo que
funciona de verdade, para dar para testar antes de configurar qualquer coisa:

```ts
    case 'http':
      return {
        metodo: 'GET',
        url: 'https://viacep.com.br/ws/01310100/json/',
        cabecalhos: [],
        corpo: '',
        mapear: [{ variavel: 'cidade', caminho: 'localidade' }],
        aoFalhar: 'humano',
      }
```

- [ ] **Passo 3: o formulário**

Em `src/components/editor/painel.tsx`, o bloco novo antes da seção de variáveis:

```tsx
      {no.type === 'http' && (
        <>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Método</span>
            <select
              value={no.data.metodo}
              onChange={(e) => aoMudarDados({ metodo: e.target.value })}
              className="app-field px-3 py-2.5 text-[13px]"
            >
              {METODOS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>

          <Linha
            rotulo="Endereço"
            valor={no.data.url}
            dica="precisa ser https. aceita {{variavel}}"
            aoMudar={(url) => aoMudarDados({ url })}
          />

          {no.data.metodo === 'POST' && (
            <Area rotulo="Corpo (JSON)" valor={no.data.corpo} aoMudar={(corpo) => aoMudarDados({ corpo })} />
          )}

          <Cabecalhos
            cabecalhos={no.data.cabecalhos}
            aoMudar={(cabecalhos) => aoMudarDados({ cabecalhos })}
          />

          <Mapeamentos mapear={no.data.mapear} aoMudar={(mapear) => aoMudarDados({ mapear })} />

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Se falhar</span>
            <select
              value={no.data.aoFalhar}
              onChange={(e) => aoMudarDados({ aoFalhar: e.target.value })}
              className="app-field px-3 py-2.5 text-[13px]"
            >
              <option value="humano">passa para uma pessoa</option>
              <option value="seguir">continua a conversa mesmo assim</option>
            </select>
          </label>

          <p className="rounded-[10px] border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-cyan-300">
            A aba Testar chama este endereço <strong>de verdade</strong>. Os disparos vindos dali
            levam o cabeçalho <code className="font-mono">X-AutoFluxos-Teste: 1</code>.
          </p>
        </>
      )}
```

Os dois subcomponentes, junto de `Opcoes` no fim do arquivo:

```tsx
function Cabecalhos({
  cabecalhos,
  aoMudar,
}: {
  cabecalhos: Cabecalho[]
  aoMudar: (c: Cabecalho[]) => void
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Cabeçalhos</span>

      <div className="space-y-1.5">
        {cabecalhos.map((c, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={c.chave}
              placeholder="nome"
              onChange={(e) => {
                const copia = [...cabecalhos]
                copia[i] = { ...c, chave: e.target.value }
                aoMudar(copia)
              }}
              className="app-field min-w-0 flex-1 px-3 py-2 text-[12.5px]"
            />
            <input
              value={c.valor}
              placeholder="valor"
              onChange={(e) => {
                const copia = [...cabecalhos]
                copia[i] = { ...c, valor: e.target.value }
                aoMudar(copia)
              }}
              className="app-field min-w-0 flex-1 px-3 py-2 text-[12.5px]"
            />
            <button
              onClick={() => aoMudar(cabecalhos.filter((_, j) => j !== i))}
              title="remover cabeçalho"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs text-dim transition hover:bg-rose-400/[0.08] hover:text-rose-300"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => aoMudar([...cabecalhos, { chave: '', valor: '' }])}
        className="mt-2 w-full rounded-lg border border-dashed border-white/[0.12] py-2 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-accent"
      >
        + adicionar cabeçalho
      </button>

      <p className="mt-2 text-[10.5px] leading-4 text-dim">
        Não coloque token aqui: o fluxo publicado é imutável e o valor ficaria guardado. O cofre de
        segredos ainda não existe — enquanto isso, use endereço que já traz a chave (Apps Script,
        n8n) ou passe por um intermediário.
      </p>
    </div>
  )
}

function Mapeamentos({
  mapear,
  aoMudar,
}: {
  mapear: Mapeamento[]
  aoMudar: (m: Mapeamento[]) => void
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
        Guardar da resposta
      </span>

      <div className="space-y-1.5">
        {mapear.map((m, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={m.variavel}
              placeholder="variável"
              onChange={(e) => {
                const copia = [...mapear]
                copia[i] = { ...m, variavel: e.target.value }
                aoMudar(copia)
              }}
              className="app-field min-w-0 flex-1 px-3 py-2 text-[12.5px]"
            />
            <input
              value={m.caminho}
              placeholder="pedido.status"
              onChange={(e) => {
                const copia = [...mapear]
                copia[i] = { ...m, caminho: e.target.value }
                aoMudar(copia)
              }}
              className="app-field min-w-0 flex-1 px-3 py-2 font-mono text-[12.5px]"
            />
            <button
              onClick={() => aoMudar(mapear.filter((_, j) => j !== i))}
              title="remover"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs text-dim transition hover:bg-rose-400/[0.08] hover:text-rose-300"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => aoMudar([...mapear, { variavel: '', caminho: '' }])}
        className="mt-2 w-full rounded-lg border border-dashed border-white/[0.12] py-2 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-accent"
      >
        + guardar um campo
      </button>

      <p className="mt-2 text-[10.5px] leading-4 text-dim">
        Caminho com ponto e índice: <code className="font-mono">pedido.status</code>,{' '}
        <code className="font-mono">itens.0.nome</code>. O que você guardar vira coluna na tela de
        leads sozinho.
      </p>
    </div>
  )
}
```

Ajuste o import do topo do arquivo para trazer `METODOS`, `type Cabecalho` e
`type Mapeamento` de `@/core/flow/schema`.

- [ ] **Passo 4: conferir**

Roda: `npm run typecheck && npm run build`
Espera: ambos passam. `build` é o que pega erro de JSX que o `typecheck` deixa
escapar.

Depois, no olho: `npm run dev`, abra um fluxo, clique em **API** no catálogo. O
bloco precisa nascer selecionado, com o formulário aberto, e a alça de saída
precisa ligar em outro bloco.

- [ ] **Passo 5: commit**

```bash
git add src/components/editor
git commit -m "feat: o bloco de API no catálogo, no desenho e no painel

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 8 — O evento na aba Testar

**Arquivos:**
- Modifica: `src/components/conversa.tsx`

**Interfaces:**
- Consome: a ação `chamar_http` (Tarefa 2)
- Produz: nada que outra tarefa use

- [ ] **Passo 1: tratar a ação no switch**

Em `src/components/conversa.tsx`, dentro de `aplicar()`, depois do
`case 'chamar_ia'`:

```ts
        case 'chamar_http':
          // Chegar aqui significa que o resolvedor não atendeu — não deveria
          // acontecer, e mostrar é melhor do que sumir com o evento.
          novos.push({
            chave,
            de: 'sistema',
            texto: `a chamada para ${acao.url} não foi executada`,
            alerta: true,
          })
          break
```

O caminho normal é o resolvedor já ter trocado essa ação pelos
`salvar_campo` que vieram da resposta — que a aba Testar já sabe mostrar.

- [ ] **Passo 2: avisar que a chamada é de verdade**

Ainda em `conversa.tsx`, logo antes do `return` do componente:

```tsx
  const temApi = fluxo.nodes.some((n) => n.type === 'http')
```

E no JSX, acima da lista de mensagens:

```tsx
      {temApi && (
        <p className="mx-4 mt-4 rounded-[10px] border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-2.5 text-[11.5px] leading-5 text-cyan-300">
          Este fluxo chama uma API. O teste dispara <strong>de verdade</strong> — testar cinco
          vezes grava cinco vezes no sistema do cliente.
        </p>
      )}
```

- [ ] **Passo 3: conferir**

Roda: `npm run typecheck && npm run build && npm test`
Espera: tudo passa.

No olho, com `npm run dev`: monte um fluxo com o bloco de API já configurado com
o ViaCEP do padrão, ligue-o a uma mensagem que use `{{cidade}}`, e converse na
aba Testar. O bot precisa responder com **São Paulo**. Isso prova a cadeia
inteira: motor → resolvedor → rede → mapeamento → variável → mensagem.

- [ ] **Passo 4: commit**

```bash
git add src/components/conversa.tsx
git commit -m "feat: a aba Testar avisa que a chamada de API é real

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 9 — Fechar a documentação

**Arquivos:**
- Modifica: `README.md`, `docs/ARQUITETURA.md`

- [ ] **Passo 1: README**

Na seção "Como um fluxo se parece", a linha dos tipos passa a ser:

```
Sete tipos de nó: `mensagem`, `pergunta`, `condicao`, `salvar-campo`, `ia`,
`handoff`, `http`.
```

E na seção "Garantias que o motor dá de graça", uma linha nova:

```
- **Integração que falha** não deixa ninguém pendurado: por padrão a conversa
  vai para uma pessoa, com o motivo real no painel
```

- [ ] **Passo 2: ARQUITETURA**

O §4 diz "Seis tipos de nó. Nem um a mais." — precisa registrar por que o
sétimo entrou, senão o documento passa a mentir. Acrescente ao fim do §4:

```markdown
> **O sétimo nó entrou em 12/ago/2026: `http`.** O teste desta seção é "isso é
> um nó/configuração, ou é um cliente específico?" — e uma URL configurável não
> carrega o nome de ninguém. Ele existe porque a alternativa era um conector
> nomeado por sistema (HubSpot, Omie, Bling), e aí sim o `src/` começaria a
> colecionar cliente. Desenho em [NO-API.md](NO-API.md).
```

- [ ] **Passo 3: commit**

```bash
git add README.md docs/ARQUITETURA.md
git commit -m "docs: o sétimo nó, e por que ele não quebra a regra do §4

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Checagem final

- [ ] `npm test` — os 61 que já passavam continuam passando, mais os novos
- [ ] `npm run typecheck` — limpo
- [ ] `npm run build` — limpo
- [ ] Fluxo com bloco de API publica quando está válido, e é recusado quando a
      URL é `http://`
- [ ] Na aba Testar, o ViaCEP responde e `{{cidade}}` aparece na mensagem
- [ ] `git status` limpo
