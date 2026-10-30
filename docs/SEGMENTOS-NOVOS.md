# Segmentos novos: saúde, salão, pet, imobiliária e hospedagem (30/out/2026)

Pedido do Gabriel em 30/out: abrir os ramos que faltam e integrar com o
sistema que cada um já usa. Este arquivo é a especificação e o registro do que
foi pesquisado. O que já está no código fica marcado com ✅.

## 1. O mapa: ramos se agrupam por motor, não por nome

Cada ramo novo é um `PacoteDoNicho` em `src/core/nichos.ts` (rótulos, ficha
do assistente, modelos, funil). O que muda de verdade entre eles é o **motor**
por baixo, e são só quatro:

| Motor | Ramos | Situação |
|---|---|---|
| **Agenda** | aulas, saúde (clínica e odonto), laboratório, beleza, pet | Existia só a Verandi. Agora tem conector genérico (§2) |
| **Pedido** | restaurante, loja virtual, comércio, farmácia | Já existe (cardápios, lojas, catálogo próprio) |
| **Lead e venda consultiva** | imobiliária | Funil comercial e catálogo próprio de imóveis; CRM externo depois (§5) |
| **Reserva** | hospedagem | Catálogo de acomodações e link de pagamento; PMS externo depois (§6) |

Ramos novos em `NICHOS`: `saude`, `laboratorio`, `farmacia`, `salao`, `pet`,
`imobiliaria`, `hospedagem`. O check `clients_nicho_check` sobe na migration
0158.

**O ramo de salão é `salao`, e não `beleza`** (0159): "beleza" é a gíria de
"ok" que `core/confirmacao.ts` reconhece, e o teste de governança dos ramos
não aceita a mesma palavra nos dois papéis.

## 2. Agenda externa: um contrato, um conector por sistema

### O contrato (`src/agendas/types.ts`)

Todo sistema de agenda traduz para cinco operações, as mesmas que a IA já
conhece da Verandi:

| Operação | O que devolve |
|---|---|
| `servicos()` | serviços/procedimentos e profissionais, com id |
| `horarios({ de, ate, servicoId?, profissionalId? })` | horários livres, cada um com `horarioId` |
| `minhas(telefone)` | marcações futuras de quem conversa, com `marcacaoId` |
| `marcar(horarioId, pessoa)` | a marcação criada |
| `desmarcar(marcacaoId, telefone)` | ok, só se a marcação é de quem conversa |

O `horarioId` carrega tudo que o sistema precisa para gravar (profissional,
serviço, data, hora, local) codificado, para o modelo não montar nada à mão.
O telefone **nunca** é argumento do modelo: vem da conversa (`injetados`).

### Ferramentas da IA

Família nova, `tipo: 'agenda'` em `core/ferramentas.ts`, executada no servidor
como as de loja (`executarNaAgenda` no resolvedor): `horarios_livres`,
`servicos_da_agenda`, `minhas_marcacoes`, `marcar_horario`,
`desmarcar_horario`. As `agenda_*` da Verandi **não mudam** (MGM é cliente
pagante). Migrar a Verandi para o contrato fica para depois, com teste dela.

### Onde a conta liga

`agendas_conectadas` (0158), uma linha por conta e plataforma, credencial no
cofre (`connections`), igual a `cardapios_conectados` (0154). Tela:
Configurações > Integrações > Agenda, com "Solicitar integração" para quem
ainda não tem conector (lista no check de `pedidos_de_loja`).

### Os sistemas, pelo que a pesquisa achou

| Sistema | Ramo | API | Situação |
|---|---|---|---|
| **Feegow** | clínica | pública, `x-access-token` liberado pelo usuário master no Feegow Clinic. `https://api.feegow.com/v1/api` | ✅ conector |
| **Clínica nas Nuvens** | clínica, odonto | pública (OpenAPI em `api.clinicanasnuvens.com.br/v2/api-docs`). Basic `client_id:client_secret` mais cabeçalho `clinicaNasNuvens-cid` (token da clínica em Configurações > Minha Empresa > Integrações). 120 req/min | ✅ conector |
| Ninsaúde (Apolo) | clínica | OAuth2, só parceiro | solicitar |
| Clinicorp | odonto | não documentada (só cliente PHP de terceiro) | solicitar |
| iClinic, Amigo, GestãoDS, ProDoctor, Simples Dental, Shosp | clínica, odonto | não achada | solicitar |
| Doctoralia | clínica | só empurra agenda do software para o portal; não serve ao chatbot | fora |
| Shift, Pixeon, Worklab | laboratório | fechada, contrato | solicitar |
| Tecnofit, EVO, Next Fit | academia | ver §7 | ver §7 |
| Trinks, Avec, Booksy | beleza | ver §7 | ver §7 |
| SimplesVet | pet | ver §7 | ver §7 |

Detalhes que viraram regra no código:

- **Feegow**: horários vêm aninhados `profissional_id > local_id > data > [horas]`
  (`GET /appoints/available-schedule`, datas `DD-MM-YYYY`, `tipo=E|P`).
  Paciente se acha por telefone (`GET /patient/list?telefone=`, só dígitos).
  Marcar: `POST /appoints/new-appoint`. Desmarcar: `POST /appoints/cancel-appoint`
  (`motivo_id` obrigatório; usamos o configurado na conexão, padrão 1).
  Confirmar: `POST /appoints/statusUpdate` com `StatusID 7`. Não aceita
  agendamento retroativo.
- **Clínica nas Nuvens**: horários por profissional
  (`GET /executor-agenda/disponibilidade?idExecutorAgenda=&data=&dataFim=`),
  então a busca sem profissional percorre os profissionais ativos (teto de 6,
  por causa dos 120 req/min). Paciente **não** se acha por telefone: a busca é
  por CPF (`GET /paciente/lista?cpfCnpj=`), então o fluxo de clínica pergunta o
  CPF. Marcar exige `idLocalAgenda`, `idTipoConsulta` e `idPacienteConvenio`;
  os três padrões ficam na conexão.

## 3. LGPD: dado de saúde é sensível (art. 11)

Vale para `saude`, `laboratorio` e `farmacia` (`dadoSensivel: true` no pacote):

1. **Aviso antes de perguntar qualquer coisa de saúde.** Os modelos destes
   ramos abrem com o aviso de uso do dado e o botão "Concordo"; quem não
   concorda vai para uma pessoa. A resposta fica gravada na variável
   `aceite_dados_saude` da conversa.
2. **Regras da IA do ramo** (`regrasDaIa` no pacote, entram no prompt de toda
   IA da conta): não dá diagnóstico, não indica nem ajusta remédio ou dose,
   não interpreta exame, urgência vai para o 192 e para uma pessoa; não pede
   nem repete diagnóstico, CID ou resultado na conversa.
3. **Resultado de exame nunca vai em arquivo no WhatsApp.** O modelo de
   laboratório avisa que está pronto e manda o link do portal do laboratório,
   que pede login. A Feegow devolve URL de laudo válida por 20 minutos; mesmo
   assim não a usamos.
4. **Farmácia**: a IA só fala de produto isento de prescrição. Remédio
   controlado (Portaria 344) e tarja vermelha: diz que precisa da receita e
   passa para o farmacêutico. Venda remota de medicamento segue a RDC 44/2009;
   quem fecha é a farmácia.
5. **O que não muda**: retenção, exclusão de dados e registro de quem viu já
   valem para toda conta (`/exclusao-de-dados`, auditoria). Dado de saúde não
   entra em campo personalizado com nome de doença; a ficha do assistente
   avisa.

## 4. Pacotes dos ramos novos

| Ramo | Contatos | Funil | Pedidos | Modelos do ramo |
|---|---|---|---|---|
| `saude` | Pacientes | agendamento | não | Atendente da clínica (IA + agenda), Horário e local |
| `laboratorio` | Pacientes | atendimento | não | Atendente do laboratório (IA: preparo, coleta, resultado), Horário e local |
| `farmacia` | Clientes | pedidos | sim, com entrega | Atendente da farmácia (IA + catálogo), Vocês têm?, Horário e local |
| `salao` | Clientes | agendamento | não | Atendente do salão (IA + agenda), Horário e local |
| `pet` | Tutores | agendamento | sim, com entrega | Atendente do pet shop (IA + agenda + catálogo), Vocês têm?, Horário e local |
| `imobiliaria` | Clientes | comercial | não | Atendente da imobiliária (IA + catálogo de imóveis), Qualificar lead |
| `hospedagem` | Hóspedes | comercial | não | Atendente da pousada (IA + acomodações), Horário e local |

Os modelos de IA são um desenho só (`src/exemplos/atendente-do-ramo.ts`) com
abertura, aviso de dados quando o ramo é sensível, conversa com as ferramentas
do ramo, menu e saída para pessoa. Muda o texto e a lista de ferramentas.

## 5. Imobiliária

- **Hoje**: imóveis entram no catálogo próprio (nome, preço, foto, categoria
  "Venda" ou "Aluguel", descrição com bairro e quartos). A IA busca com
  `loja_buscar`, mostra com `loja_mostrar` e marca visita pela agenda
  conectada ou passa para o corretor. Lead de portal entra pelo webhook de
  entrada que já existe.
- **Depois**: **Vista** tem API pública (`/imoveis/listar` com filtro,
  `/imoveis/detalhes`, chave por chamado). **Jetimob** expõe a lista de
  imóveis por chave. Kenlo só por parceria. Grupo OLX entrega lead por
  `POST` num endpoint homologado (`developers.grupozap.com/webhooks/integration_leads.html`),
  pergunta aberta para `chamado.integracao@olxbr.com`. Nenhum CRM tem
  "agendar visita": visita é nossa.

## 6. Hospedagem

- **Hoje**: acomodações no catálogo próprio, tarifa no preço, cobrança pelo
  gateway da conta (`montar_cobranca`). Disponibilidade por data fica com a
  equipe (a IA não promete vaga).
- **Depois**: **Stays** é a única API de reserva aberta e documentada
  (`/external/v1/booking/search-listings`, `calculate-price`, `reservations`;
  Basic `client_id:client_secret`; paga à parte). Cloudbeds só com
  credenciamento. Omnibees, Desbravador, HSystem, Hospedin: contato
  comercial. Booking.com e Airbnb: fechados para integrador pequeno.

## 7. Academia, beleza e pet

| Sistema | Ramo | API | Situação |
|---|---|---|---|
| **EVO (W12)** | academia | pública (Swagger em `evo-integracao-api.w12app.com.br/swagger/v1/swagger.json`). Basic: usuário = DNS da academia, senha = Secret Key. Aluno por telefone (`GET /api/v2/members?phone=`), grade `GET /api/v1/activities/schedule`, reserva `POST /api/v2/activities/booking`, cancela `DELETE /api/v2/activities/enroll`, inadimplentes `GET /api/v1/receivables/debtors`, webhook `POST /api/v1/webhook` | ✅ conector |
| **Trinks** | beleza | pública (`trinks.readme.io`). Cabeçalhos `X-Api-Key` e `estabelecimentoId`; o dono gera em trinks.com > Minha Área > Meu Cadastro > Token de API Pessoal. Vagas `GET /v1/agendamentos/profissionais/{data}`, cria `POST /v1/agendamentos` (**não confere conflito**: conferimos a vaga antes), status `PATCH /v1/agendamentos/{id}/status/cancelado`, cliente `GET /v1/clientes?Telefone=`. **60 req/min e 5.000/mês por chave** | ✅ conector |
| **AgendaPro** | beleza | pública (`developers.agendapro.com`). `Authorization: Bearer apk_live_...`, criada em Configuraciones > Integraciones. Vagas `GET /v3/available_slots`, cria `POST /v3/bookings`, cancela `PATCH /v3/bookings/{id}/cancel`, cliente `GET /v3/clients/quick-search`. Reserva pela API não avisa a cliente: o bot avisa | ✅ conector |
| Cloudgym | academia | Swagger público, sem vaga por horário nem cancelamento | solicitar |
| Tecnofit, Next Fit, Pacto | academia | não achada | solicitar |
| Wellhub (Gympass) | academia | sentido inverso (publica grade no app deles), só parceiro | fora |
| Booksy, Avec, Belasis, Gendo | beleza | fechada ou não achada | solicitar |
| SimplesVet, Vetsmart, Bitpet | pet | não achada | solicitar |

Pet sem API aberta: o ramo nasce com o catálogo próprio e a agenda da
Verandi ou de qualquer sistema acima.

## 8. Fora deste corte, de propósito

- Migrar as ferramentas da Verandi para o contrato genérico.
- Conector de laboratório e de ERP de farmácia: nenhum tem API aberta.
- Páginas `/segmentos/<ramo>` do site para os ramos novos: precisam de foto e
  texto aprovados (`propor-texto-antes-de-publicar`).

## 9. Onde está no código ✅

- Contrato e conectores: `src/agendas/` (testes em `agendas.test.ts`, contra
  respostas no formato de cada documentação).
- Ferramentas da IA: `FERRAMENTAS_DA_AGENDA_EXTERNA` em `src/core/ferramentas.ts`;
  execução em `src/server/agenda-externa.ts`, chamada pelo resolvedor.
- Ramos: `src/core/nichos.ts` (`regrasDaIa`, `dadoSensivel`, `sistemas`);
  regras no prompt por `regrasDoRamo` (`src/server/ia/prompt.ts`).
- Catálogo de sistemas e logos oficiais: `src/core/sistemas-dos-ramos.ts`,
  `public/marcas-de-sistemas/`.
- Tela: Configurações > Integrações > Sistemas do seu ramo
  (`src/app/clientes/[clienteId]/ajustes/integracoes/sistemas/`).
- Atendentes: `src/exemplos/atendente-do-ramo.ts`; modelos de mensagem da Meta
  por ramo em `src/core/modelos-prontos.ts` (8 por ramo).
- Banco: migrations 0158 e 0159, aplicadas em 30/out.

**Ainda não provado contra um sistema de verdade:** nenhum conector rodou com
chave de cliente. Os formatos vieram das documentações; o que a documentação
não mostrava está anotado no conector (Feegow: `valor` e `plano` da marcação;
Clínica nas Nuvens: formato de data na resposta da disponibilidade; EVO:
significado do status de cancelamento). A primeira conta de cada sistema
confirma.
