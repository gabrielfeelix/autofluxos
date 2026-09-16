# Distribuição de leads: as decisões, antes do código

16/set/2026. Responde ao pedido do dono de 15/set, registrado em
`docs/HANDOFF-16-SET-TRANSMISSOES-E-DISTRIBUICAO.md`:

> "tenho quatro vendedores, um lead entra, os quatro respondem e disputam o
> cliente, como funciona?"

O handoff pesquisou o mercado e listou as entidades que faltam. Ele termina
dizendo, com razão, que começar errado custa caro para desfazer. Este documento
fecha as escolhas. O que estiver aqui foi decidido; o que ficou de fora está na
última seção, com o motivo.

---

## O que já existia, e por que não resolvia

| Peça | Onde | O que faltava |
|---|---|---|
| `contacts.atribuido_a` | `repos/conversas.ts`, `atribuirContato` | ninguém preenchia sozinho |
| Rail "sem dono / de fulano" | `components/inbox/fila.tsx` | só filtra, não impede nada |
| Presença `disponivel` / `ausente` | `af_usuarios`, `repos/usuarios.ts` | não entrava em decisão nenhuma |
| Papéis `owner` / `admin` / `member` | `af_membros` | não controlam o Inbox |

Ou seja: a atribuição existia inteira como **registro** e não existia como
**regra**. O cenário que o dono descreveu acontece hoje exatamente assim.

---

## As cinco decisões

### 1. A carteira ganha do rodízio, e ela já existe

Só lead **sem dono** entra na distribuição. Quem já tem `atribuido_a` continua
com quem o atendeu, mesmo que a conversa tenha sido resolvida meses atrás.

Isto não precisou de tabela nova: `atribuido_a` mora no contato, não na sessão
nem no handoff, e o comentário de `atribuirContato` já dizia por quê ("quem
atendeu ontem é quem a pessoa espera reencontrar amanhã"). A carteira é o
comportamento que sai de graça dessa escolha antiga.

**Sem prazo de validade, por enquanto.** "A carteira vale 90 dias" é uma regra
que só se sabe querer depois de ver a primeira reclamação de vendedor que saiu
da empresa. Quando existir, é uma coluna e uma comparação, não um redesenho.

### 2. Balanceado, e não rodízio puro

Quem tem menos conversa aberta recebe a próxima. Rodízio por ordem fixa ignora
carga: o vendedor com onze conversas abertas recebe a décima segunda porque
"era a vez dele".

Empate resolve pelo id do usuário, para a escolha ser determinística. Sorteio
faria o mesmo estado de entrada produzir resultados diferentes, e isso é
impossível de testar e pior de explicar.

### 3. Distribuir quando o bot desiste, e não quando a mensagem chega

O gancho fica onde o handoff é registrado (`receber-mensagem.ts`), e não em toda
entrada. Uma conversa que o fluxo está atendendo sozinho não precisa de dono, e
distribuir ali encheria a fila de todo mundo com conversas que ninguém vai
abrir.

É também onde o dono da conta já espera que algo aconteça: é o momento em que a
conversa passa a esperar uma pessoa.

### 4. Ver e responder são coisas diferentes

Todo mundo continua **vendo** tudo. Quem cobre férias precisa ler o histórico, e
esconder conversa de colega cria o problema que a pessoa resolve pedindo o
celular do outro.

O que muda é **responder**: com "só quem assumiu pode responder" ligado, quem
não é o dono vê o botão de assumir no lugar da caixa de resposta. É o que impede
dois vendedores digitando ao mesmo tempo, que é a queixa original.

**Desligado por padrão.** Conta de uma pessoa só, ou de duas que se entendem, não
precisa disso, e ligar sozinho mudaria o comportamento de quem já usa.

### 5. Gestor não entra no rodízio por padrão

Quem é `owner` ou `admin` acompanha; quem é `member` atende. Os dois podem ser
mudados por pessoa, na tela da equipe, porque em conta pequena o dono também
vende.

Quem está **ausente** sai do rodízio e **mantém as conversas dele**. Pausa que
redistribui o que já era seu vira abandono, e o cliente do outro lado percebe.

---

## O que entra no banco

A `0064` cria uma tabela e duas colunas.

`public.af_atendentes`, por conta e por pessoa:

| Coluna | Para quê |
|---|---|
| `entra_no_rodizio` | se recebe lead novo automaticamente |
| `teto_simultaneo` | máximo de conversas abertas; `0` é sem teto |

Linha ausente vale como padrão (`member` entra, `owner`/`admin` não), então
ninguém precisa configurar nada para a distribuição funcionar.

Em `public.clients`:

| Coluna | Para quê |
|---|---|
| `distribuicao` | `manual` (hoje) ou `balanceado` |
| `exige_assumir` | se responder exige ser o dono |

As duas nascem no valor que preserva o comportamento atual. Migration aditiva
que liga coisa sozinha é a que ninguém perdoa.

---

## O que ficou de fora, e por quê

- **Visibilidade restrita/equipe/geral.** O produto não tem conceito de equipe
  dentro da conta, então dos três níveis sobrariam dois, e o que o dono descreveu
  se resolve pelo item 4 sem esconder nada de ninguém. Esconder histórico é a
  parte que mais quebra tela (muda consulta em quase todo o Inbox) e a que menos
  resolve a queixa. Fica para quando existir equipe de verdade.
- **Prazo da carteira.** Ver a decisão 1.
- **Distribuição por região ou produto.** Precisa de dado que não existe (nem
  território nem especialidade estão cadastrados em lugar nenhum).
- **Notificar quem recebeu.** O aviso de handoff já existe e já sai
  (`avisarDoHandoff`). Mandar um segundo aviso dizendo "e é sua" é ruído até
  alguém reclamar da falta.
