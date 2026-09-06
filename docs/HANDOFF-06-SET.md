# Handoff — 06/set/2026

> **Continuação:** as rodadas 1, 2 e 3 foram feitas na noite de 06/set. O que
> mudou, o que os planos diziam errado e o que falta está em
> [HANDOFF-06-SET-NOITE.md](HANDOFF-06-SET-NOITE.md). Este documento continua
> valendo por inteiro — principalmente o §4 e o §7.

Para quem pegar este projeto agora, humano ou agente. **Leia este documento
inteiro antes de abrir código.** Ele existe porque a sessão anterior errou duas
vezes por não ter lido o que já estava escrito, e as duas foram corrigidas pelo
dono, não pelo agente.

---

## 1. Comece por aqui, nesta ordem

1. **`git fetch` antes de qualquer coisa.** Há sessões paralelas neste
   repositório. Em 06/set o `main` local estava **35 commits atrás** do origin.
2. [LEVANTAMENTO-06-SET.md](LEVANTAMENTO-06-SET.md) — o que existe, o que falta,
   o que decidir. **É o mapa.**
3. [PLANO-IMPLEMENTACAO-SET.md](PLANO-IMPLEMENTACAO-SET.md) — as seis rodadas, em
   ordem, com decisão técnica tomada e critério de prova.
4. [PLANO-ESPERA.md](PLANO-ESPERA.md) — o contexto da janela e a conversa sobre
   cobrança.
5. Só então código.

---

## 2. As duas lições que custaram caro nesta sessão

### 2.1 O código está escrito em português

Procurei `*kanban*` e concluí, por escrito e com confiança, que não havia
Kanban. **Havia**: `core/quadros.ts`, `repos/quadros.ts`, tela de 745 linhas com
drag-and-drop, migrations `0032`–`0035` e testes nos dois níveis. Chama-se
**quadros**.

**Antes de afirmar que algo não existe, procure em português e com pelo menos
três sinônimos.** `quadros` (não kanban), `etiquetas` (não tags), `sequencias`,
`campanhas`, `gatilhos`, `acervo`, `conexoes`, `contatos` (a rota é `/leads`, o
nome é Contatos).

### 2.2 Documento não é fonte de verdade sobre o código

Já estava escrito no [HANDOFF.md §0.4.1](HANDOFF.md). O levantamento de 06/set
achou **oito** casos novos: login e papéis, mídia, formatação de mensagem, tool
calling da IA, bloco em pilha, o furo do `/api/simular` — todos constam como
pendentes em algum plano e **estão prontos**.

Planejar pela leitura dos planos leva a reconstruir o que existe. **`grep` custa
segundos e vale mais que qualquer parágrafo de documento.**

---

## 3. O estado, em uma tela

**O produto está pronto para vender. O que falta é a Meta.**

| | |
|---|---|
| App review | **PENDING**, enviado 04/set, 6 permissões. Prazo real 3–5 semanas |
| Verificação do negócio | ✅ `verified` |
| Tech Provider / verificação de acesso | ✅ verificado |
| Coexistence | Libera quando o app review aprovar. Sem formulário novo |
| Última migration | **`0044`** — confira pelo diretório, sempre |

Números do produto: 44 migrations · 18 telas do cliente + 5 do admin · 13 blocos
no editor · 12 ações no motor · 88 server actions · WhatsApp no ar, Instagram
pronto e travado, Telegram só no catálogo.

---

## 4. O que NÃO fazer enquanto a análise da Meta correr

Isto é o mais importante deste documento.

- **Não mudar rota, nome de menu, nem o caminho das telas que o revisor abre.**
  Ele segue o passo a passo que enviamos: entrar com `revisor.meta@4yu.com.br`
  → Clientes → `Estúdio de exemplo` → conectar → Inbox. Mudar isso é reprovar
  por conta própria.
- **Não trocar a senha do revisor** (`revisor.meta@4yu.com.br`). Está no `.env` e
  no formulário da Meta. Só depois da aprovação.
- **Não ligar `instagram.disponivel: true`** em `core/canais.ts`. Continua
  `false` de propósito.
- **Não remover `c5ed171`** (o `console.error` com o corpo cru do webhook). É a
  única janela para o que a Meta manda de verdade, até a aprovação.
- **Não aplicar migration em produção sem autorização explícita do dono.** O
  banco é compartilhado com a Verandi.

---

## 5. As seis rodadas, em uma linha cada

Detalhe, decisão técnica e critério de prova em
[PLANO-IMPLEMENTACAO-SET.md](PLANO-IMPLEMENTACAO-SET.md).

| # | O quê | Decisão pendente? |
|---|---|---|
| 1 | ✅ **Feito em 06/set.** Cartão entra sozinho no quadro | Decidida: quadro padrão explícito. `0043` **aplicada em produção** |
| 2 | ✅ **Feito em 06/set.** Fluxo aplica etiqueta e escreve nota | Não |
| 3 | ✅ **Feito em 06/set.** Webhook de entrada, `POST /api/webhook/entrada/[clienteId]` | Não |
| 4 | **Painel direito do Inbox** — `Object.entries(lead.campos)` despeja tudo com a chave crua | Não |
| 5 | **Aviso de handoff** — só avisa quem está com o Inbox aberto | Não |
| 6 | **Auditoria OWASP escrita** — 7 dos 9 blocos de endurecimento já estão fechados | Não |

**A rodada 1 tinha a única decisão do dono embutida** e ela foi tomada em
06/set: quadro padrão explícito, marcado numa caixa no cabeçalho do quadro. As
outras cinco podem começar sem perguntar nada.

---

## 6. Decisões abertas que são do dono, não suas

Não decida por ele; pergunte no momento certo e siga com o resto.

1. ~~**Qual quadro recebe o contato novo** (rodada 1)~~ — **decidida em 06/set**:
   quadro padrão explícito, opt-in por conta. Nenhuma conta existente foi
   ligada.
2. **Subfluxo volta ao chamador?** Recomendação registrada: **não**. É a decisão
   nº 1 do `PLANO-MESTRE` e nunca foi fechada. Bloqueia a coluna `Conexões`.
3. **Cobrança**: o que é cobrado e por qual gateway. Nada existe no código —
   nem tabela, nem limite por plano. Análise em [PLANO-ESPERA §5](PLANO-ESPERA.md).
4. **LLM padrão**: hoje Gemini free tier; o palpite documentado é Gemini Flash
   pago e nunca virou decisão.

---

## 7. Armadilhas ainda vivas

As de agosto estão em [HANDOFF.md §0.4.1](HANDOFF.md) e continuam valendo — leia.
As desta sessão:

- **`AGENTS.md` dizia que a próxima migration era `0030`; era `0042`.**
  Corrigido em `d4874a6`, mas planos de agosto ainda dizem `0019` e `0038`.
  **O diretório é a única fonte de verdade.**
- **`privileges` da Meta devolve tudo como `REJECTED` sem que haja reprovação.**
  É o estado "nunca concedida". Quem responde o que falta é `requirements`.
- **O MCP da Meta reporta `screencast: is_completed false` para todas as
  permissões, e a tela mostra os vídeos anexados.** A tela venceu. Não confie
  nesse campo isolado.
- **Sequências e campanhas não têm rota própria** — vivem dentro de `/fluxos`.
  Quem procura `/sequencias` conclui que não existe.
- **`ir_para_fluxo` não está no `switch` de `receber-mensagem.ts`** — é resolvido
  em `efeitos/resolver.ts`. Contar `case` achando que cobre o tipo `Acao` inteiro
  erra por um.

---

## 8. Como se prova que uma rodada terminou

Sem exceção, e nesta ordem:

```
npm test && npm run typecheck && npm run lint && npm run build && git diff --check
```

Depois: commit por rodada, e **atualizar o documento de origem** para que item
pronto não continue parecendo pendente. Essa dívida é exatamente o que gerou o
levantamento de 06/set — oito planos diziam pendente sobre coisa pronta.

**E a regra que vale mais que todas:** afirmar que algo funciona só depois de ver
a saída do comando que prova. O console da Meta dizia "publicado" com o site
carregando outro contêiner por meses; o handoff dizia que `renovarToken()` não
era chamada por ninguém quando estava no cron desde `f7561e6`.
