# O nó `API` — a chave-mestra de integração

> Spec fechado em 12/ago/2026. O que motiva: **poder dizer "sim, integra"**
> numa reunião de venda, cobrindo o máximo de casos com o mínimo construído.

---

## O problema

O motor tem seis ações possíveis e nenhuma fala com o mundo fora do WhatsApp:

```
enviar_texto · enviar_opcoes · salvar_campo · chamar_ia · transferir_humano · encerrar
```

`salvar_campo` grava em `contacts.campos`, no nosso Supabase. É tudo. Não existe
nó de HTTP, não existe webhook de saída, não existe gatilho de entrada.

Consequência comercial: toda pergunta de cliente que comece com "e dá pra ligar
no meu..." termina em não. Planilha do Sheets, CRM, ERP, consulta de pedido,
agenda — todos fora.

## A decisão: um nó, não uma família de conectores

Um webhook de saída **é** um nó HTTP onde você ignora a resposta. Não são duas
features; é a mesma, com e sem leitura do retorno. Então a chave-mestra é um
tipo de bloco só:

```
+ Mensagem  + Pergunta  + Condição  + Guardar  + IA  + Falar com humano  + API
```

A ARQUITETURA §4 avisa que o sétimo nó é onde MVP morre, e o teste dela é:
*isso é um nó/configuração, ou é a Prelúdio?* Uma URL configurável é a definição
de nó genérico — não carrega o nome de cliente nenhum. Passa no teste.

Conectores nomeados (HubSpot, RD Station, Omie) são o oposto: cada um é código
novo, com autenticação própria, para um cliente que talvez não apareça. O nó
genérico cobre todos eles no dia um, e um conector nomeado só se justifica
quando o mesmo sistema aparecer no terceiro cliente.

### O que isso cobre de verdade

| Caso | Como |
|---|---|
| **Sheets como banco** | o cliente publica um Apps Script como Web App e cola a URL |
| **n8n / Make / Zapier** | `POST` no webhook deles — e eles carregam os 5.000 apps que nunca vamos integrar na mão |
| **Consulta de pedido, rastreio, estoque** | `GET` na API do sistema dele, resposta mapeada em variável |
| **CEP, CNPJ** | ViaCEP, BrasilAPI — enriquece o lead sem perguntar |
| **Notificação interna** | webhook do Slack, do Telegram, do que for |
| **CRM com `Authorization`** | **não**, até o cofre existir (v2). A resposta honesta é "passa por n8n" |

O Sheets merece nota: a API do Google **não aceita API key para escrita** —
exige OAuth2 ou service account com a planilha compartilhada. O caminho que o
mercado usa é o Apps Script publicado, que vira um `POST` comum com o segredo já
embutido na própria URL gerada pelo Google. Por isso o v1 alcança Sheets sem ter
cofre: não há campo de token para guardar.

---

## Encaixe no motor

**O motor continua puro.** A natureza de `executar()` não muda em nada: sem
banco, sem rede, sem relógio.

O padrão já existe e foi construído para dois inquilinos. Quando a conversa
chega num bloco de IA, `executar()` não chama o modelo — ele **descreve** o que
precisa (`chamar_ia`), para em `aguardando_ia`, e alguém de fora resolve e
reentra com `ia_respondeu`. O nó `API` é o mesmo desenho com outro nome:

| IA (existe) | API (novo) |
|---|---|
| ação `chamar_ia` | ação `chamar_http` |
| status `aguardando_ia` | status `aguardando_http` |
| entrada `ia_respondeu` | entrada `http_respondeu` |

A entrada nova carrega os valores já extraídos, não a resposta crua — quem
entende de JSON é o resolvedor, e o motor recebe só pares de nome e texto, que é
tudo que ele sabe manipular:

```ts
z.object({
  tipo: z.literal('http_respondeu'),
  valores: z.record(z.string(), z.string()),
})
```

O resolvedor é o laço que já mora em `server/ia/conduzir.ts`: hoje procura
`chamar_ia` e reentra; passa a procurar os dois. **Um resolvedor só**, usado
pelo simulador e pelo WhatsApp — é o que impede "no simulador funcionava".

O arquivo deixa de ser sobre IA e passa a ser sobre efeitos externos:

```
src/server/efeitos/
├── resolver.ts        o laço (era ia/conduzir.ts)
├── http.ts            dispara a requisição, com as recusas de rede
└── http.test.ts
```

`server/ia/` continua existindo com `gemini.ts`, `modelo.ts`, `prompt.ts` e
`types.ts` — só o laço sai de lá. É o único mexer em código existente.

### Por que a URL é montada no servidor, e não no motor

Esta é a decisão que faz o cofre (v2) ser aditivo em vez de reescrita.

O regex da interpolação é `[a-zA-Z][a-zA-Z0-9_]*` (`core/engine/interpolar.ts`).
**Ponto não casa.** Então `{{segredo.crm_token}}` atravessa `executar()` intacto
— não vira string vazia, não é tocado. O motor interpola só as variáveis da
sessão; o resolvedor faz uma segunda passada e preenche os segredos.

Se fosse o contrário — motor montando a URL completa — o segredo teria que
entrar na sessão para chegar lá. E a sessão viaja para o navegador a cada
mensagem do simulador (`components/conversa.tsx`). Fazendo a segunda passada no
servidor, credencial nenhuma encosta no motor, na sessão, ou no browser.

Regra que fica: **o motor nunca vê segredo.** Vale para o v1, onde não há
segredo, exatamente para valer no v2, onde haverá.

---

## O que o nó guarda

```ts
{
  type: 'http',
  data: {
    metodo: 'GET' | 'POST',
    url: string,                                    // aceita {{var}}
    cabecalhos: { chave: string, valor: string }[], // aceita {{var}}
    corpo: string,                                  // JSON como texto, aceita {{var}}
    mapear: { variavel: string, caminho: string }[],
    aoFalhar: 'humano' | 'seguir',                  // padrão: 'humano'
  }
}
```

**`caminho`** é caminho simples com ponto e índice — `pedido.status`,
`resultados.0.nome`. Não é JSONPath completo de propósito: a esmagadora maioria
dos casos é um campo raso, e o que não for, o cliente achata no Apps Script
dele. JSONPath é uma linguagem inteira para manter, testar e explicar.

**Cada valor mapeado entra em `vars` e emite `salvar_campo`.** Consequência
boa e de graça: o dado que veio do sistema do cliente aparece sozinho como
coluna na tela de leads, porque as colunas de lá saem dos dados (BRIEF-UI §4a).
Ninguém configura nada.

**Uma saída só**, igual `mensagem` e `IA`. Falha não vira segunda alça: vira o
campo `aoFalhar`, com padrão `humano`. É a regra do §9 — quem garante a saída é
o sistema, não a boa vontade de quem desenha. `seguir` existe para
enriquecimento opcional (o CEP não respondeu, e a conversa não deveria morrer
por isso).

### Como o motor executa

O nó `API` é o **primeiro nó que espera sem ser uma pergunta e sem ser IA**.
No `avancar()`, ele se comporta como o `ia`: empurra a ação, marca `noAtual`,
troca o status e retorna.

```ts
case 'http': {
  acoes.push({
    tipo: 'chamar_http',
    metodo: no.data.metodo,
    url: interpolar(no.data.url, s.vars),
    cabecalhos: no.data.cabecalhos.map(c => ({ ...c, valor: interpolar(c.valor, s.vars) })),
    corpo: interpolar(no.data.corpo, s.vars),
    mapear: no.data.mapear,
    aoFalhar: no.data.aoFalhar,
  })
  s.noAtual = no.id
  s.status = 'aguardando_http'
  return { acoes, sessao: s }
}
```

E a reentrada, no `executar()`, espelhando o bloco do `ia`:

```ts
if (atual.type === 'http') {
  if (entrada.tipo !== 'http_respondeu') return { acoes, sessao: s }

  for (const [variavel, valor] of Object.entries(entrada.valores)) {
    s.vars[variavel] = valor
    acoes.push({ tipo: 'salvar_campo', campo: variavel, valor })
  }
  s.tentativas = 0
  return avancar(fluxo, porId, s, acoes, proximo(fluxo, atual.id))
}
```

Repare no que **não** está aí: nenhuma decisão sobre sucesso ou falha. Quando a
requisição falha e `aoFalhar` é `humano`, quem transfere é o resolvedor — o
motor só recebe `http_respondeu` quando deu certo. Isso mantém o motor sem saber
o que é um status HTTP, que é o ponto de ele ser puro.

Com `aoFalhar: 'seguir'`, o resolvedor reentra com `valores: {}` — a conversa
continua e as variáveis mapeadas ficam vazias, que é como o produto já trata
variável ausente (`interpolar` devolve string vazia de propósito).

---

## Falha, timeout, retry

- **Timeout de 10s.** O processamento roda em `after()`, então o corte de 20s da
  Meta não se aplica — o limite real é a paciência de quem está do outro lado.
- **Status fora de 2xx é falha**, junto com timeout, DNS que não resolve e
  resposta que não é JSON quando o nó tem `mapear` preenchido. (Sem `mapear`, o
  que voltou não interessa — é o caso do webhook disparado e esquecido.)
- **Sem retry.** `POST` não é idempotente: repetir um lead que falhou no timeout
  cria dois registros no CRM do cliente. Retry entra quando existir chave de
  idempotência, e não antes.
- Falha com `aoFalhar: 'humano'` manda a mensagem de transferência e registra o
  motivo real — `a integração não respondeu (timeout)` —, que já aparece na tela
  de leads sem trabalho nenhum.
- **Trava de encadeamento:** o `MAX_CHAMADAS = 3` do resolvedor de IA vira
  `MAX_EFEITOS = 10`, contando IA e API juntas. O 3 foi calibrado para IA, onde
  encadear é sinal de fluxo errado. Com API é diferente: consultar o CEP, gravar
  no CRM e avisar no Slack na mesma passada são três chamadas de um fluxo
  perfeitamente sensato. A trava continua existindo para matar ciclo, não para
  limitar desenho — por isso sobe, e não some.

---

## Segurança

Uma URL configurável executada pelo nosso servidor é SSRF por construção: quem
edita o fluxo passa a poder fazer a Vercel emitir requisições para qualquer
endereço alcançável a partir dela. Hoje só o operador edita, mas o BRIEF-UI §6
já prevê o cliente com acesso, e essa porta não pode estar aberta quando ele
chegar.

O resolvedor recusa, antes de emitir a requisição:

- esquema diferente de `https`
- `localhost`, `127.0.0.0/8`, `::1`
- `169.254.169.254` e o resto de `169.254.0.0/16` — metadados de nuvem
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- endereços que só caem nessas faixas **depois de resolver o DNS**
- os mesmos destinos alcançados **via redirecionamento** (`redirect: 'manual'`,
  e cada salto passa pela mesma checagem)

A recusa mora no resolvedor, não no editor. Validação de tela é conveniência; a
recusa precisa valer venha a chamada de onde vier — a mesma lógica que
`publicar()` já aplica ao validador.

### O simulador dispara de verdade

É a promessa central do produto (simulador e produção rodam o mesmo código) e é
o que a IA já faz na aba Testar. Manter assim é o certo.

Mas isso significa que testar um fluxo cinco vezes cria cinco registros no
sistema do cliente. Então:

- **aviso visível** na aba Testar quando o fluxo tem nó de API
- todo disparo vindo do simulador leva o cabeçalho **`X-AutoFluxos-Teste: 1`**,
  para o lado de lá poder filtrar

---

## Validador

Impedimentos (travam a publicação):

| Código | Quando |
|---|---|
| `URL_VAZIA` | a URL está em branco |
| `URL_INSEGURA` | a URL não começa com `https://` |
| `VARIAVEL_INVALIDA` | nome de variável do mapeamento fora de `[a-zA-Z][a-zA-Z0-9_]*` |
| `CORPO_INVALIDO` | método `POST` com corpo que não é JSON válido |

O `CORPO_INVALIDO` só vale depois de trocar os `{{var}}` por um valor de
mentira — senão `{"nome": {{nome}}}` seria recusado sempre, e é justamente a
forma correta de escrever.

Aviso (não trava): `SEGREDO_INEXISTENTE` — o texto cita `{{segredo.algo}}` e o
cofre ainda não existe. Vira impedimento no v2.

---

## Testes

| Onde | O que prova |
|---|---|
| `core/engine/executar.test.ts` | nó `http` emite `chamar_http` e para em `aguardando_http`; reentra com `http_respondeu` e segue, gravando as variáveis; entrada de outro tipo enquanto espera é ignorada |
| `core/flow/validar.test.ts` | cada impedimento acima, e o corpo com `{{var}}` **não** sendo recusado |
| `server/efeitos/http.test.ts` | sucesso, 500, timeout, JSON quebrado, mapeamento raso e com índice, `aoFalhar` nos dois valores — tudo com `fetch` dublado, sem rede |
| `server/efeitos/http.test.ts` | a lista de recusa de rede: cada faixa privada, `localhost`, metadados, `http://`, e o redirecionamento que tenta cair numa delas |
| `server/efeitos/resolver.test.ts` | o laço atendendo `chamar_ia` e `chamar_http` no mesmo fluxo, e o `MAX_CHAMADAS` contando os dois |

Os testes do motor e do validador rodam sem rede e sem banco, como todos os
outros de `core/`.

---

## Fora do v1, de propósito

- **Cofre de segredos** — v2, e é aditivo: `{{segredo.x}}` já atravessa o motor
  intacto, então entra como segunda passada no resolvedor, sem mudar o formato
  do nó nem invalidar fluxo publicado
- **Retry** — espera chave de idempotência
- **OAuth** — espera o cofre
- **Conectores nomeados** — quando o mesmo sistema aparecer no terceiro cliente
- **Gatilho de entrada** (o sistema do cliente inicia a conversa) — exige
  template aprovado pela Meta e conversa paga. É outro produto, não um nó

---

## O que isso deixa dizer na reunião

> "Integra. O bot consulta e grava no seu sistema durante a conversa."

Verdade para Sheets via Apps Script, para qualquer webhook, e para n8n, Make e
Zapier — que sozinhos carregam os 5.000 apps que nunca vamos integrar na mão.

Para CRM que exige cabeçalho `Authorization`, a resposta honesta continua sendo
"passa por n8n", até o cofre existir.
