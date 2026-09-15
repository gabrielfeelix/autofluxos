# Inbox com cara de WhatsApp — o que ficou pronto e o que vem

> Sessão de 14–15/set/2026. O pedido do dono: *"quase uma cópia do WhatsApp,
> mas de inbox. Só que mais interessante"* — figurinha, emoji, GIF, reação,
> chamada perdida.
>
> O plano das cinco camadas está em [PLANO-INBOX-COMPLETO.md](PLANO-INBOX-COMPLETO.md).
> **Camada 1 entregue.** Camadas 2 a 5 abertas.

## Onde parou

`main` em `0efff1f`, árvore limpa, deploy em produção feito. 770 testes de
`core`/`channels`/`components` passando, typecheck e lint limpos.

## Camada 1 — mandar mídia pelo Inbox (feita)

O adaptador já sabia enviar foto, vídeo, áudio e PDF desde a Fase 11 do motor;
o bloco de mídia do fluxo usa há meses. **Nenhuma tela do Inbox chamava** — quem
atendia não conseguia mandar a foto da tabela de preço nem o PDF do contrato.

- `src/server/acoes-midia-do-inbox.ts` — a ação. Confere janela de 24h, recusa
  legenda em áudio (regra da Meta) e grava antes de enviar.
- `src/components/lead/botao-de-anexo.tsx` — o clipe. Sobe direto para o
  Storage por URL assinada e passa só o endereço.
- `src/components/lead/responder.tsx` — ganhou a propriedade `anexo`, opcional.

### Três decisões que o próximo precisa conhecer

**O arquivo não passa pelo servidor.** `File` em Server Action bate no teto de
1 MB do Next, e um vídeo de 12 MB morre no caminho sem erro útil. O caminho é
`acaoPrepararEnvioDeArquivo` → `PUT` na URL assinada → ação com a URL pública.
É o mesmo do Acervo: mesmo bucket, mesma validação, mesma limpeza na LGPD.

**O payload grava `midia` em português.** É o formato que `anexoDoPayload`
(`repos/leads.ts:756`) já lê para desenhar a bolha, e o mesmo que o bloco de
mídia grava. Um segundo formato faria a foto do atendente sumir da conversa
enquanto a do bot aparece — e isso só apareceria em produção.

**Quase sobrescrevi `src/components/lead/anexo.tsx`.** Ele já existia e desenha
anexo **recebido**. O botão novo ficou em `botao-de-anexo.tsx`. Conferir nome de
arquivo antes de criar.

### Não foi testado com envio real

Precisa de conversa aberta dentro das 24h. O caminho está provado por
typecheck, lint e build — não por uma foto que chegou no celular de alguém.

## O que a Meta permite, e o que não

Levantado na doc oficial em 15/set. A tabela completa está no plano; o resumo:

| | Situação |
|---|---|
| Reagir a mensagem | ✅ `type: reaction` — **teto de 30 dias** |
| Responder citando | ✅ `context.message_id` — já recebemos o campo |
| Figurinha | ✅ só WebP: 100 KB estática, 500 KB animada |
| Localização, contato | ✅ receber já funciona; falta desenhar |
| Marcar como lida, "digitando" | ✅ |
| GIF | ⚠️ **não está na lista oficial**; o caminho é converter para MP4 |
| Chamada perdida | ⚠️ existe webhook de chamada, **não existe evento "perdida"** |
| Editar enviada | ❌ não existe |
| Apagar para todos | ❌ não existe |
| Enquete | ❌ não existe na Cloud API |

**Emoji não está na tabela porque não é recurso de API** — é texto puro, já
funciona. Falta só o seletor visual.

## As quatro camadas abertas

### Camada 2 — reagir e responder citando

A mais valiosa das que sobraram, e a que nenhum concorrente pesquisado entrega
bem.

- Reagir: `type: reaction` com `{message_id, emoji}`. **O teto de 30 dias tem
  de aparecer na tela** — botão que some sem explicação vira chamado de suporte.
- Citar: o `context` já chega em toda mensagem recebida; falta guardar e
  desenhar.
- **Receber reação está errado hoje**: entra como mensagem solta na conversa,
  em vez de grudar na mensagem reagida. `tipo-da-mensagem.ts` já a reconhece
  para a prévia da fila, mas `receber-mensagem.ts` não a trata.

### Camada 3 — figurinha e GIF

Figurinha exige WebP dentro dos limites; o caminho honesto é um acervo de
figurinhas por cliente, não converter no navegador. GIF vira MP4 — funciona na
prática, **não é documentado**, então precisa de teste real antes de virar
promessa na tela.

### Camada 4 — chamada

A Meta manda `connect` e `terminate`, e nada que diga "perdida". Dá para inferir
de um `terminate` sem atendimento e mostrar "📞 chamada não atendida, 14:32".
Hoje isso é invisível: a pessoa liga, ninguém atende, e o atendimento não sabe.

**Precisa de uma chamada real** para saber quais campos vêm — o mapeamento é
inferência nossa, não contrato.

### Camada 5 — acabamento

Seletor de emoji, desenhar localização e cartão de contato, "digitando…",
marcar como lida ao abrir (hoje a pessoa do outro lado nunca vê o segundo tique).

## Armadilhas desta área do código

- **`vitest.config.ts` carrega o `.env` do repo em `test.env`, e isso sobrepõe
  variável do shell.** Para rodar contra o banco local não adianta
  `SUPABASE_URL=... npx vitest`: é preciso editar o `.env` e restaurar depois.
  Os testes de repo apontam para **produção** por padrão.
- **PostgREST cacheia schema.** Tabela nova some do cache até
  `notify pgrst, 'reload schema'` ou reiniciar `supabase_rest_autofluxos`. O
  sintoma — "Could not find the table" — parece migration não aplicada e não é.
- **`leituras.test.ts` falha no banco local** (2 testes), e já falhava antes.
  Não é regressão.
- **O Storage é global ao projeto compartilhado com a Verandi.** Bucket novo
  precisa identificar o produto no nome, e a remoção de cliente precisa limpá-lo
  explicitamente. Ver [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md).

## Um bug corrigido no meio desta sessão, que vale conhecer

O Inbox do primeiro cliente mostrava só o que os contatos escreveram, como se
ele nunca tivesse respondido. Eram 133 mensagens marcadas como entrada e
penduradas num contato com o número **dele mesmo**.

A causa: `direcaoDaMensagem` recebia `phone_number_id` onde a Meta manda o
número de telefone — `110549275215531` contra `5511911001414`. Passou porque os
dois são dígitos de tamanho parecido e o teste usava o mesmo valor dos dois
lados, então nunca poderia falhar.

Corrigido no código e nos dados (127 das 133 reparadas). O que fica de lição
para esta área: **teste de direção com dois valores diferentes**, sempre.

## O que não fazer

- **Não prometer enquete, editar ou apagar para todos.** Nenhum existe na Cloud
  API. O que aparece no mercado são provedores não oficiais rodando WhatsApp
  Web — o caminho que arrisca banir o número do cliente, recusado desde o
  começo (ver o topo de `channels/cloud-api.ts`).
- **Não converter figurinha no navegador.** Vira problema de CPU e de formato.
- **Não tratar GIF e chamada perdida como certos** antes do teste real.
