# Conexões — credencial de cliente sem ela nunca encostar no fluxo

> Spec fechado em 12/ago/2026. Substitui a ideia de `{{segredo.x}}` que estava
> no [NO-API.md](NO-API.md). O motivo da troca está em "Por que Conexão e não
> variável de segredo".

---

## O que isto resolve

O nó de API cobre Sheets, webhook e qualquer coisa que aceite chave embutida na
URL. **Não cobre CRM**, que exige cabeçalho `Authorization` — e não havia onde
guardar esse token.

A saída provisória era mandar o cliente passar por n8n. Isso é errado como
produto: se ele precisa do n8n, ele não precisa da gente. **O meio somos nós.**

## A ordem importa, e não é a óbvia

Fixar o IP vem **antes** do cofre, e não é preciosismo.

Hoje o rebinding de DNS é SSRF: dá para fazer o servidor bater num endereço
interno. Com credencial guardada, ele vira **roubo de credencial** — porque o
rebinding não muda o host, só o IP, e a regra que larga cabeçalho em
redirecionamento só dispara quando a *origem* muda. O `Authorization` do CRM
sairia direto para o IP do atacante.

Cofre sem IP fixado é entregar token. Então: IP primeiro.

---

## Parte 1 — Fixar o IP na conexão

### O problema, confirmado

`undici` (o cliente HTTP do Node, e o que está por baixo do `fetch`) **ignora o
`agent` do Node e re-resolve o DNS na hora de conectar**. Então o padrão
"resolve, confere, chama" tem uma janela: quem controla o domínio devolve um IP
público na conferência e o endereço de metadados da nuvem na conexão.

Não é teoria. É a mesma classe da CVE do **Budibase** (`GHSA-v42f-v8xc-j435`),
que é um low-code com nó de REST — o mesmo produto que a gente está fazendo.

### A correção

Conectar no **IP que já foi validado**, em vez de deixar resolver de novo:

```
connect.lookup → devolve o IP validado, sem consultar DNS
Host:          → continua o hostname original
TLS servername → continua o hostname original (senão o certificado não bate)
```

Some a janela: não existe segunda resolução para o atacante trocar.

Consequências no código:

- `conferirEndereco()` passa a devolver **qual IP** foi aprovado, não só "pode".
- `http.ts` troca `fetch` por `undici.request`, que aceita `dispatcher`. É um
  módulo `server-only`; não faz falta a semântica de `fetch`.
- Cada salto de redirecionamento resolve, valida e fixa **de novo**.
- `undici` entra como dependência explícita. Ela já vem com o Node, mas depender
  de dependência transitiva é depender de coisa que some sem aviso.

---

## Parte 2 — Conexões

### O que é uma Conexão

Uma credencial nomeada, de um cliente, guardada no cofre.

```
Cliente "Prelúdio"
  └── Conexão "CRM"        tipo: bearer      → token no Vault
  └── Conexão "Planilha"   tipo: query       → chave no Vault, campo `key`
  └── Conexão "Estoque"    tipo: cabecalho   → chave no Vault, campo `x-api-key`
```

O bloco de API aponta para uma conexão. **Não existe campo onde digitar o
token dentro do fluxo.**

### Por que Conexão e não variável de segredo

A ideia anterior era `{{segredo.crm_token}}` escrito à mão num cabeçalho. Ela
funciona, e é pior em quatro pontos:

| | `{{segredo.x}}` | Conexão |
|---|---|---|
| Onde o operador erra | pode colar o token no lugar do nome, e aí ele entra no grafo | não há campo para colar token |
| O que vai para a versão imutável | um texto que *deveria* ser só o nome | um id, sempre |
| Rotação | trocar o valor, e torcer para o nome bater em todo fluxo | trocar o valor; os fluxos apontam para o id |
| OAuth depois | não cabe: refresh precisa de estado, não de substituição de texto | é um `tipo` novo |

O quarto ponto é o que decide. CRM sério (HubSpot, RD Station, Salesforce) é
OAuth2, com refresh token e expiração. Isso é **estado**, não texto — precisa de
uma linha que alguém atualiza. Um `{{segredo.x}}` não tem onde guardar isso.

Nascer com Conexão significa que o dia do OAuth é uma coluna a mais e um tipo a
mais. Nascer com substituição de texto significa refazer.

### Onde o valor mora

**Supabase Vault.** Já está na stack, a chave de criptografia fica fora do
banco, e um dump do banco entrega ciphertext e id de chave — nunca o segredo.

O `pgsodium` está sendo aposentado, mas o Vault hoje é auto-contido e a
interface é estável; a Supabase migra o interior sem mexer no que a gente chama.

A tabela nossa guarda **só a referência**:

```sql
connections
  id            uuid
  client_id     uuid  → clients
  nome          text        "CRM"          (o que aparece na tela)
  tipo          text        bearer | cabecalho | query
  campo         text        "x-api-key"    (só para cabecalho e query)
  secret_id     uuid  → vault.secrets      NUNCA o valor
  criado_em     timestamptz
```

O acesso ao Vault é por função `security definer` no schema `public`, com
permissão revogada de `anon` e `authenticated` e concedida só ao `service_role`
— que é a chave que só o servidor tem.

### Como a credencial entra na requisição

No resolvedor, **depois** do motor. O motor não muda:

```
executar()          descreve a chamada, com conexaoId, sem credencial nenhuma
    ↓
resolver.ts         lê a conexão, pede o valor ao cofre
    ↓
http.ts             injeta conforme o tipo, dispara
```

A regra que já valia continua valendo, agora por construção: **o motor nunca vê
segredo**, e portanto ele nunca entra na sessão — que viaja para o navegador a
cada mensagem do simulador.

Por tipo:

| tipo | o que faz |
|---|---|
| `bearer` | `Authorization: Bearer <valor>` |
| `cabecalho` | `<campo>: <valor>` |
| `query` | acrescenta `?<campo>=<valor>` na URL |

Três cobre o que existe hoje de chave estática. O quarto (`oauth2`) entra quando
houver um cliente que exija, e aí ele traz `refresh_token`, `expira_em` e um
resolvedor próprio.

### O que nunca pode acontecer

- valor voltar para a tela depois de gravado (a tela grava e esquece; para
  trocar, grava de novo)
- valor em log, em `motivo` de handoff, ou no payload do simulador
- fluxo de um cliente alcançar conexão de outro
- conexão apagada deixar fluxo publicado chamando com credencial vazia — apagar
  exige confirmar, e o validador acusa fluxo apontando para conexão inexistente

---

## O que fica de fora, de propósito

**Credencial de teste (sandbox) por conexão.** A aba Testar dispara de verdade,
então testar um fluxo com conexão de CRM grava no CRM de verdade. A solução
completa é uma segunda credencial por conexão, usada quando a origem é o
simulador.

Fica para depois porque dobra a tela e o modelo, e existe mitigação hoje: o
aviso na aba Testar e o cabeçalho `X-AutoFluxos-Teste: 1`, que o sistema do
cliente consegue filtrar. **É risco conhecido, não esquecido** — e o primeiro
cliente com CRM de produção é o gatilho para construir.

**OAuth2.** Ver acima: entra como tipo, quando houver quem exija.

**Rotação automática e auditoria de uso.** Quando houver mais de um operador.
