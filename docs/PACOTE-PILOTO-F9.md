# Pacote do piloto (T9.2, item 3)

> Escrito em 22/set/2026, ao fim da **T9.1**.
>
> O plano manda "solicitar autorização de produção **somente com esse pacote
> concreto**, quando a execução chegar a esta fase". Este é o pacote. O que
> falta depois dele é decisão de gente, e está no §6.
>
> **Nada aqui foi executado.** O item 5 da T9.2 é explícito: "planejamento ou
> teste local não equivalem a release".

## 1. O que já está em produção, e o que não está

O código das fases F0 a F8 está **todo publicado**: neste repositório o `git
push` em `main` é o deploy, e os commits foram empurrados por tarefa.

O banco de produção está com as migrations `0001` a `0086`.

| Pendente | O que é | Precisa de você |
|---|---|---|
| ~~`0087`~~ | fecha o `EXECUTE` de três funções de `public` | **aplicada em 22/set/2026**, com autorização |

**Não há migration pendente.** A `0087` foi aplicada em 22/set/2026, e o
registro objeto a objeto está no `BANCO-COMPARTILHADO.md`. Ela nasceu da
auditoria de isolamento da T9.1. Dois pontos que valiam para a decisão de
aplicar, mantidos aqui porque explicam por que ela não era urgente:

- **não há pressa de incidente.** O alcance foi medido: `anon` entra na função e
  é barrado pelo `grant` de tabela da 0041 uma camada depois. Nenhum dado
  vazou, e a única `security definer` das três retorna `trigger`, que o Postgres
  recusa chamar diretamente;
- **o código publicado não depende dela.** Um revoke não muda contrato, então
  não existe o risco da `0071` (código no ar lendo objeto que não existe). Ela
  pode entrar quando você quiser, inclusive depois do piloto.

## 2. Os flags, e o que cada um faz

Não há sistema de feature flags. O que existe é **configuração por conta**, que
é mais simples e mais fácil de reverter: muda uma linha de `public.clients`.

| Flag | Onde | Padrão | O que faz |
|---|---|---|---|
| `clients.objetivo` | 0084 | `atender` | decide o que o onboarding cobra (`core/objetivo-da-conta.ts`) |
| `clients.crm_ativo` | 0084 | `true` | o CRM aparece no menu desta conta |
| `contacts.automacao_ativa` | anterior | ligada | o bot responde **naquela conversa**, ou fica calado |
| `clients.plano` | 0066 | `essencial` | medido, **não trava nada** |
| `clients.distribuicao` | 0064 | `manual` | rodízio de atendimento |

**`crm_ativo` nasce `true` e isso é decisão registrada na 0084:** o natural para
recurso opcional seria `false`, e aqui esconderia a tela de funil das 6 contas
que já usam quadros. Para uma empresa piloto que só quer atender, o gesto é
gravar `false` nela.

**`plano` não nega atendimento a ninguém**, e isso é deliberado (0066): medir vem
antes de cobrar, e medir sem travar vem antes de travar. Se a trava nascesse
junto da primeira medição, o primeiro erro de contagem viraria cliente sem
atender.

## 3. O plano de retorno

Reverter é por camada, e nenhuma delas exige coordenação com a Verandi.

| O que deu errado | Como volta | Custo |
|---|---|---|
| uma conta piloto não se dá bem com o CRM | `update clients set crm_ativo = false where id = ...` | imediato, só aquela conta |
| o bot responde o que não devia numa conversa | `automacao_ativa = false` **naquele contato** | imediato, e a conversa continua no Inbox |
| o bot precisa parar na conta inteira | não existe uma chave só: é por contato, ou despublicar o fluxo | **conferir antes do piloto**, ver §4 |
| um commit quebrou uma tela | `git revert` e push (o push é o deploy) | minutos |
| a `0087` causou algo inesperado | `grant execute on function ... to service_role` já está lá; para voltar ao estado anterior, `grant execute ... to public` nas três | imediato |

**O que não tem volta fácil, e por isso não entra no piloto:** qualquer migration
que apague ou reescreva dado. Nenhuma das pendentes faz isso. O projeto de
produção **não tem PITR** (plano gratuito), e é dividido com a Verandi: um erro
destrutivo atinge os dois produtos.

## 4. O monitoramento que já existe

Nada precisa ser construído para começar a observar. O que está no ar:

| Onde | O que mostra |
|---|---|
| `/admin/alertas` | falhas gravadas em `public.alertas` (0039): webhook, entrega na Cloud API, leitura do cofre |
| `/admin/auditoria` | quem fez o quê, inclusive impersonação |
| `/admin/consumo` | conversas e arquivos por conta (views da 0066) |
| painel da conta | desfechos do mês, com as quatro fatias que somam o total (0086) |

**O alerta grava sempre em tabela, e o webhook é opcional.** Isso é conserto de
um erro antigo registrado em `server/alertar.ts`: durante meses o único caminho
de aviso dependia de `ALERTA_WEBHOOK_URL`, que nunca foi preenchida, e tudo caía
num `console.error` que some do log da Vercel em horas.

### O problema que a medição achou, e que atrapalha o item 4

A tabela tem **3.087 alertas**, sendo **2.973 nos últimos 7 dias**. Medido em
22/set/2026:

```
webhook do WhatsApp recebido (diagnóstico)        2401   <- não é falha
a Cloud API recusou a entrega                      177
evento para um telefone que não é contato          157
o contato novo não entrou no quadro padrão          88
o Instagram mandou para conta não ligada            87
```

**78% do volume é um alerta de diagnóstico que grava em toda chamada do
webhook.** Ele foi posto de propósito em 13/set para caçar o caso da
coexistência, e o comentário dele em `src/app/api/webhook/whatsapp/route.ts:68`
já diz o que fazer: *"Sai quando o caso fechar: alerta por chamada é barulho, e
barulho em alerta faz parar de ler alerta."*

Isso encosta direto no item 4 da T9.2, que manda acompanhar falhas durante a
liberação: **hoje `/admin/alertas` está afogado**, e quem for observar o piloto
vai rolar 2.400 linhas de ruído para achar as 177 que importam.

**Recomendação, e ela é sua para decidir:** tirar o alerta de diagnóstico antes
de começar o piloto, ou filtrar a tela por título. Tirar é melhor, porque o caso
da coexistência que o motivou está registrado como resolvido no handoff de
13/set. Não fiz isso nesta fase porque é mudança de comportamento em produção
fora do escopo da T9.1, e a hora certa é junto da decisão de começar.

Os outros números **não** são ruído e merecem olhada antes do piloto: 177
recusas da Cloud API e 88 contatos que não entraram no quadro padrão são falhas
de verdade, com a última ocorrência em 19/set.

### O que o plano manda acompanhar, e onde olhar

O item 4 da T9.2 lista cinco coisas:

| Acompanhar | Onde |
|---|---|
| eventos duplicados | `/admin/alertas`; e o A05/A23 têm teste automatizado |
| conversas sem destino | Inbox, filtro "sem dono" (`fila-local.ts`) |
| falhas de transferência | painel da conta, fatia **falha** dos desfechos (0086) |
| divergências de totais | painel: as quatro fatias somam o total de propósito, e não baterem é o sinal |
| acesso | `/admin/auditoria` |

**A fatia `prevista` vai começar em zero, e isso está certo.** Nenhum handoff
anterior à 0086 tem `origem`, e a migration não fez backfill de propósito: nulo
quer dizer "gravado antes de o produto saber distinguir", e quem lê trata como
`falha`. A fatia só cresce a partir da primeira transferência nova. **Não trate
o zero inicial como defeito.**

## 5. A prévia do legado

As 6 contas de produção continuam funcionando sem mudar nada:

- todas leem `objetivo = 'atender'` e `crm_ativo = true`, que é como elas já se
  comportavam antes da 0084;
- os 29 cartões seguem com `temperatura is null` ("não avaliada"), e não com uma
  avaliação inventada;
- os 8 handoffs seguem com `origem is null`, lidos como `falha`;
- **0 vendas e 0 cartões ganhos**: nenhuma tela de cliente tem número comercial
  para mostrar hoje, e toda tela de relacionamento nasce vazia. Isso não é
  defeito, é a base real.

**Consequência para o roteiro de observação:** não dá para mostrar a parte de
vendas do produto com o dado que existe. Uma empresa piloto que for testar
SDR/venda precisa cadastrar produto e registrar venda durante a sessão, ou o
roteiro daquele trabalho fica vazio.

## 6. O que depende de você, e não de mim

Estes são os itens 1, 2, 4 e 5 da T9.2, e eles não são coisa que um agente faz.

1. **Decidir sobre o alerta de diagnóstico do webhook** (§4). Ele é 78% do
   volume de `/admin/alertas`, e sem essa limpeza o item 4 da T9.2 fica difícil
   de cumprir na prática.
2. **Escolher as empresas piloto.** O plano pede três trabalhos: atendimento,
   SDR/vendas e pós-venda. Vale lembrar do §5: o piloto de vendas precisa de
   dado que ninguém cadastrou ainda.
3. **Observar as pessoas usando.** O plano é específico e a distinção importa:
   "observar tarefas, não apenas perguntar se a tela agradou". O item 2 lista o
   que precisa ser verificado na cabeça de quem usa: se a pessoa distingue
   modelo de chatbot de modelo de mensagem, concluir de vender,
   temperatura de qualificação, e segmento de destinatários. Se ela não
   distinguir, o conserto é de texto e de passo, e aí volta para mim.
4. **Liberar gradualmente**, acompanhando o §4.
5. **Declarar a fase liberada**, com evidência de ambiente e implantação.

**O que eu posso fazer quando você voltar com resultado:** ajustar textos e
passos que confundirem (item 2), cobrir as falhas abertas do checklist
(`VALIDACAO-OPERACAO-CHATBOT-CRM.md`, em especial o **A20**).
