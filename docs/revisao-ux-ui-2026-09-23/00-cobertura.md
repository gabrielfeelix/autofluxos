# Inventário de cobertura: revisão ampliada

Status: inventário e revisão estática encerrados. Base local de referência: commit `0527eec`, com documentação de revisão ainda não commitada. Os controles e ações principais foram inspecionados no código; nenhuma rota foi validada em navegador nesta revisão. Na Fase 12 (23/09) as 33 rotas da conta foram validadas em navegador (ver abaixo); as de admin, públicas e de cadastro seguem só inspecionadas no código.

Foram encontrados **51 arquivos de página**. Isso não significa 51 telas independentes: há redirecionamentos, páginas públicas, abas por query string, modais e subpainéis dentro da mesma rota. A contagem não inclui endpoints de API como telas.

## Como interpretar

- **Inventariada**: existência identificada; não implica inspeção de controles.
- **Inspecionada no código**: componentes e principais ações lidos; comportamentos estáticos documentados.
- **Parcial**: algum painel/ação/caminho não foi examinado; o relatório deve dizer qual.
- **Redirecionamento conferido**: rota encaminha a uma superfície atual; não deve ser reintroduzida como tela.
- **Validada em navegador**: percorrida na Fase 12 (23/09) com três personas (proprietário, gestão, atendimento) pela varredura `.ux-local/varredura.mjs`: status 200, sem tela de erro, sem erro de JS, e "Sem acesso" onde a permissão manda. Prints do proprietário em desktop e celular em `prints-depois/`; registro em `docs/ux-paralelo/fase-12.md`.

## Rotas

| Rota | Frente e relatório responsável | Cobertura final |
|---|---|---|
| `/admin/alertas` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/admin/auditoria` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/admin/consumo` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/admin/contas` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/admin` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Redirecionamento conferido |
| `/admin/usuarios` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/ajuda` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/cadastrar` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/clientes/[clienteId]/ajustes/acervo` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/anuncios` | [Transmissões e conexões](07-transmissoes-conexoes.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/chaves` | [Transmissões e conexões](07-transmissoes-conexoes.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/contexto` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/equipe` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/etiquetas` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/horario` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/instagram` | [Transmissões e conexões](07-transmissoes-conexoes.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/integracoes/magento` | [Transmissões e conexões](07-transmissoes-conexoes.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/integracoes` | [Transmissões e conexões](07-transmissoes-conexoes.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/negocio` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/plano` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/produtos` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/recursos` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/respostas-rapidas` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/retomada` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/ajustes/whatsapp` | [Transmissões e conexões](07-transmissoes-conexoes.md) | Validada em navegador |
| `/clientes/[clienteId]/atividades` | [Atendimento e CRM](05-atendimento-crm.md) | Validada em navegador |
| `/clientes/[clienteId]/configurar` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/favoritas` | [Atendimento e CRM](05-atendimento-crm.md) | Validada em navegador |
| `/clientes/[clienteId]/fluxos/[fluxoId]` | [Automações e editor](04-automacoes.md) | Validada em navegador |
| `/clientes/[clienteId]/fluxos` | [Automações e editor](04-automacoes.md) | Validada em navegador |
| `/clientes/[clienteId]/inbox` | [Atendimento e CRM](05-atendimento-crm.md) | Validada em navegador |
| `/clientes/[clienteId]/leads/[contatoId]` | [Atendimento e CRM](05-atendimento-crm.md) | Validada em navegador |
| `/clientes/[clienteId]/leads/importar` | [Atendimento e CRM](05-atendimento-crm.md) | Validada em navegador |
| `/clientes/[clienteId]/leads` | [Atendimento e CRM](05-atendimento-crm.md) | Validada em navegador |
| `/clientes/[clienteId]/leads/segmentos` | [Atendimento e CRM](05-atendimento-crm.md) | Validada em navegador |
| `/clientes/[clienteId]` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Validada em navegador |
| `/clientes/[clienteId]/quadros/atividades` | [Atendimento e CRM](05-atendimento-crm.md) | Validada em navegador |
| `/clientes/[clienteId]/quadros` | [Atendimento e CRM](05-atendimento-crm.md) | Validada em navegador |
| `/clientes/[clienteId]/respostas` | [Atendimento e CRM](05-atendimento-crm.md) | Validada em navegador |
| `/clientes/[clienteId]/transmissoes` | [Transmissões e conexões](07-transmissoes-conexoes.md) | Validada em navegador |
| `/contas` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/criar-conta` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/entrar` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/exclusao-de-dados` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/f/[token]` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/painel` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/primeiro-acesso` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/privacidade` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |
| `/termos` | [Configuração, acesso e demais telas](06-configuracao-acesso.md) | Inspecionada no código |

## Superfícies que a contagem de rotas não cobre

| Superfície | Registro exigido |
|---|---|
| Abas de Automações | Nome exibido, condições de acesso, conteúdo, ações, estado vazio e destino |
| Editor de automação | Tipos de bloco, propriedades, conexões, validação, rascunho/publicação, simulação, versões, compartilhamento |
| Inbox | Filtros, conversa, compositor, anexos, propriedade, transferência, bot/humano, painel lateral |
| Ficha de contato | Cada aba e ações internas, diferença entre contato/conversa/negócio/atividade |
| Funil | Filtros, cartões, menus, etapas, movimentos, ganhar/perder e formulários |
| Transmissões | Modelos, público, agendamento, cota, estados, falhas, cancelamento |
| Configurações | Campos editáveis, salvar/cancelar/testar, feedback e repercussão no restante do sistema |
| Shell e estados globais | Navegação, conta, permissões, loading, erro, not-found, teclado, mobile |

## Limite da palavra “tudo”

Esta rodada registra as 51 rotas e as superfícies internas identificadas nos relatórios 04–07. Mesmo uma rota inspecionada não prova todos os estados possíveis, resultados de provedores ou todas as combinações de permissão. Esses limites precisam permanecer no handoff para evitar transformar sugestão em garantia de funcionamento.

## Conferência final

- 51 rotas do disco correspondem às 51 linhas do inventário: nenhuma ausente ou extra.
- Relatórios 04–07 incluem inventário de controles e tickets; 08 organiza a execução.
- Páginas públicas foram revisadas quanto a estrutura e navegação, sem auditoria jurídica do conteúdo.
- Loading, erro, not-found e navegação mobile foram inspecionados no código em 06.
- Links entre os documentos foram conferidos; nenhuma referência local de documento ficou sem arquivo.
- Não há promessa de cobertura de toda combinação de estado, permissão, provedor ou renderização.
