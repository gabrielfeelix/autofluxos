# Handoff — 21/set/2026 — fluxos da MGM, expediente com feriado, ajuda em tooltip

O que foi feito nesta rodada e, no fim, **o que ficou de fora**. Quem pegar
daqui começa pela última seção.

## Feito e no ar

**Botão Organizar no editor** (`bc7a884`, antes `b4142de`). Arruma o desenho em
colunas da entrada para a saída (Sugiyama enxuto). A conta pura está em
`src/components/editor/organizar.ts`, com testes. Ciclo ("voltar ao menu") não
empurra o início para a direita, a ordem dos ramos é a das opções do bloco, e
organizar duas vezes dá o mesmo desenho.

**Fluxos da MGM corrigidos e publicados**: Atendimento v8, Agendamento v5,
Reagendamento v5, Não Comparecimento v3.

O grave: o **rascunho** do Não Comparecimento cancelava criando aula. O "Sim,
pode CANCELAR" levava a um `POST /participacoes`, o `DELETE` apontava para uma
variável que aquele rascunho nunca preenchia, e a confirmação vinha depois de
já ter executado. A versão que estava no ar era a correta, e foi ela que voltou
para o rascunho.

Os outros: "Agora não" transferia para humano mandando a nota interna
*"Entrou em contato e gostaria de saber valores"* para o cliente; Personal
Pilates mandava `FALAR COM  RECEPÇÃO`; "Voltar ao menu" reiniciava o fluxo
repetindo a saudação; `409` da Verandi (horário cheio) virava "Prontinho,
marcada"; emoji colado, travessões e sobras de "Escreva a mensagem aqui.".

**Feriado no expediente + expediente vindo do CRM** (`bc7a884` aqui,
`de74bf5` na Verandi). Exceções por data em `core/horario.ts`, a frase do bot
passa a dizer o motivo ("hoje é Natal e o atendimento está fechado"), variável
`motivo_fechado` nos fluxos, e `GET /api/v1/funcionamento` na Verandi com a
semana e os feriados. O AutoFluxos guarda uma cópia com validade de 6h
(`src/server/horario-do-crm.ts`): falha ou lentidão na busca usa a cópia
anterior e segue.

**Conexão duplicada da MGM apagada.** Sobrou `VERANDI-OFICIAL`
(`a9f8ce40-…`), que é a que os fluxos usam. A antiga "Verandi (agenda)"
(`e2d5c1a8-…`) só aparecia em versões **v1** históricas; voltar para uma delas
agora pede trocar a credencial antes de publicar.

## Não feito

**1. A ajuda sai de baixo do campo e vai para o "?" — só a tarefa foi escrita.**
Plano completo em [PLANO-AJUDA-EM-TOOLTIP.md](PLANO-AJUDA-EM-TOOLTIP.md):
nenhum texto de ajuda solto embaixo de campo, um `?` ao lado de cada título,
abrindo balão ou modal **sem navegar**, e um link para `/ajuda` só no rodapé do
modal. São ~51 textos só em `components/editor/painel.tsx`, mais
`components/cliente/*` e `components/lead-crm/*`. O `?` de hoje no painel é um
`<a>` que abre `/ajuda#secao` em outra aba: ele morre.

**2. Ligar o toggle da MGM** (é do dono, não de código). Configurações →
Horário de atendimento → "Puxar o horário da agenda (Verandi)" → credencial
`VERANDI-OFICIAL` → Salvar. Enquanto não for marcado, o expediente da MGM
segue o que está digitado à mão (seg a sex, 07:00–20:00) e feriado nenhum é
considerado.
