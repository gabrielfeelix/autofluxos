# AutoFluxos: tudo que o sistema oferece

Inventário lido do **código** em 05/out/2026 (commit `c1fc082`), não dos planos.
Onde um doc antigo diz outra coisa, vale o código. Itens com **(parcial)** existem
pela metade; a seção final lista o que **não existe**.

Caminhos abreviados: `APP` = `src/app/clientes/[clienteId]`.

---

## 1. Mapa do produto

Menu do cliente (`src/components/design/secoes-do-cliente.tsx`):

| Seção | O que tem |
|---|---|
| Início | "Precisa de você", números do dia, equipe agora, fechamentos, clientes sumindo |
| Conversas | Inbox, canais, respostas rápidas, mensagens guardadas |
| CRM | Contatos, Segmentos, Negociações (funis), Atividades |
| Automações | Fluxos, Gatilhos, Sequências, Transmissões |
| Comércio | Catálogo, lojas conectadas (Magento, Nuvemshop) |
| Análise | Atendimento, Vendas |
| Configurações | Empresa, equipe, horário, distribuição, IA, acervo, chaves, API, plano, integrações |

Além disso: várias organizações por login (`/contas` + seletor no topo), console
de administração da plataforma (`/admin`), site comercial, central de ajuda e
docs de desenvolvedor.

---

## 2. Canais de conversa

### WhatsApp (Cloud API oficial da Meta)
- **Conexão por Embedded Signup** hospedado pela Meta: cliente autoriza, servidor troca o código por token, escolhe a WABA que contém o número e inscreve o app. `src/server/whatsapp/conexao.ts`
- **Coexistência**: número continua no app WhatsApp Business do celular. Importa contatos e histórico automaticamente (janela de 24h), espelha no Inbox o que foi escrito no celular, trata desconexão/reconexão. Barra de progresso e aviso de "travou". `src/server/receber-coexistencia.ts`
- **Vários números** por conta (plano Escala).
- **4 papéis de fluxo por número**: Principal, Boas-vindas, Mídia recebida, Pós-atendimento. `src/core/papeis-do-numero.ts`
- **Webhook** com assinatura HMAC, resposta imediata e processamento em segundo plano.
- **Janela de 24h** respeitada em todo envio; fora dela, só template aprovado.

### Instagram Direct
- Conexão por login do Instagram (OAuth), token longo de 60 dias **renovado sozinho** a partir de 10 dias antes de vencer.
- Recebe texto, imagem, vídeo, áudio, arquivo, compartilhamento e menção em story; envia texto, mídia, opções (quick replies) e "digitando".
- **(parcial)** Liga só contas da própria 4YU até o App Review da Meta. Fluxos no Instagram ainda fechados (`disponivel: false` em `src/core/canais.ts`).

### Chat do site (widget próprio)
- Um `<script>` com a chave da conta (`public/chat/v1.js`). Lista de domínios permitidos (até 10).
- Personalização: cor, tema claro/escuro, título, saudação, prazo de resposta, mascote (imagem ou vídeo), prévia ao vivo.
- Formulário de contato configurável (nome, e-mail, telefone, CPF, CNPJ, campo próprio; obrigatório ou não).
- Várias conversas por visitante, contador de não lidas, convite no balão.
- **Ligação de voz** do visitante para o atendente (seção 4).

### Telegram
- **(parcial)** Adaptador de envio pronto (`src/channels/telegram.ts`); sem tela de conexão nem webhook.

### Saúde das conexões
- Cartão por canal em 4 camadas: configurado, autorização, último evento, falha. `src/core/saude-da-conexao.ts`
- Faixa "canal caiu" no Inbox quando número é desconectado ou token vence.

---

## 3. Inbox (atendimento)

### Tempo real
- Stream SSE (consulta a cada 1s) com reconexão automática e plano B por polling a cada 5s.
- Troca de conversa sem recarregar a página; ações otimistas (fixar, não lida, agendar, anotar).

### Fila
- Estados: abertas, adiadas, encerradas (com contagens).
- Atribuição: todos, sem dono, meus, por atendente.
- Origem: veio de anúncio ou direto. Ícone do canal em cada conversa.
- Ordenar: mais recentes, mais antigas, esperando há mais tempo. Filtro de não lidas.
- Busca por nome, telefone e texto das mensagens. 50 por página.
- Fixar até 5 conversas no topo; marcar como não lida; leitura controlada por usuário.
- Contador de mensagens agendadas da conta.

### Mensagens
- Texto com **citação** (responder mensagem), emoji, formatação.
- **Anexos**: imagem, vídeo, áudio, documento; arrastar e soltar, revisão com legenda, envio em fila. Upload direto para o storage.
- **Gravar áudio** no navegador (convertido para OGG/Opus, formato que a Meta aceita; até 300s).
- **Reações** (enviar e receber).
- **Receber**: foto, áudio, vídeo, documento, figurinha, localização, mensagem apagada. Mídia guardada no nosso storage antes de expirar na Meta (até 16 MB).
- **Favoritar mensagens** e tela "Mensagens guardadas".
- Reenviar mensagem não confirmada. Tiques de entrega e leitura (enviada, entregue, lida, falhou).
- Recibo de leitura enviado ao abrir a conversa; "digitando" quando o bot responde.
- Assinatura do atendente ("Nome:") no WhatsApp; selo de autor na bolha (bot, IA, pessoa).
- **Rajada**: mensagens seguidas do cliente são agrupadas (3s) para o bot responder uma vez só.
- **Respostas rápidas**: atalho + texto, busca, `/` abre o painel; importar por CSV.
- **Comércio no chat**: enviar card de produto, cupom e status de pedido (seção 12).
- **Retomar com template** quando a janela de 24h fechou.

### Ações na conversa
- **Assumir** (atômico: dois atendentes não assumem juntos), liberar, encerrar (devolve ao bot), atribuir a outra pessoa.
- Pausar/religar o bot só nesta conversa. Estado unificado de "quem conduz".
- Marcar resolvida/reabrir. **Adiar** (3h, amanhã, 3 dias, 1 semana; volta sozinha).
- **Agendar mensagem** ao cliente (presets ou data livre até 365 dias; aviso da janela de 24h; cancelar).
- Anotações internas da equipe, etiquetas, nova atividade, mover etapa do funil sem sair da conversa.
- Ficha do contato ao lado (abas Contato e Anotações).

### Supervisão e avisos
- **Modo espiar**: gestor vê a caixa de um atendente como ele vê, sem marcar como lido; auditado.
- Notificação do navegador em handoff novo (a cada 30s).
- **Web Push** com o painel fechado (VAPID + service worker); não avisa de madrugada.

---

## 4. Voz e transcrição
- **Transcrição de áudio** sob demanda (botão no player, Gemini), resultado guardado. `src/server/transcrever-audio.ts`
- **Leitura de imagem** recebida, automática dentro da conversa com IA. `src/server/ler-imagem.ts`
- **Ligação de voz pelo chat do site**: WebRTC navegador a navegador; toca no Inbox, atender/recusar/desligar, cartão fixo durante a chamada, vira "perdida" após 45s. `src/server/chamadas.ts`, `src/components/inbox/telefone-do-inbox.tsx`
- **(parcial)** Ligação pelo WhatsApp: só a sonda que registra o evento; sem atender de verdade.

---

## 5. Chatbot: Fluxos

### Organização
- Abas: **Fluxos**, **Gatilhos** (Palavras-chave, Eventos, Campanhas, Webhooks de entrada), **Sequências**.
- Lista com busca e filtros (canal, publicadas, nunca publicadas, ligadas, desligadas, com pendência).
- Pastas, reordenar por arrastar, renomear, duplicar, apagar. Interruptor liga/desliga (só liga se publicado).

### Editor visual
- Canvas com blocos e ligações; painel lateral com abas **Bloco**, **Testar**, **Antes de publicar**.
- Rascunho com salvamento automático, publicar, descartar rascunho.
- Desfazer/refazer (Ctrl+Z / Ctrl+Y), desfazer exclusão, seleção múltipla, **Organizar** (layout automático), atraso em lote.
- Inserir `{{variável}}` com autocomplete, formatação do WhatsApp e emojis.
- **Versões**: cada publicação é imutável; ver versão antiga e "voltar para esta".
- **Checklist antes de publicar** e validador com cerca de 70 verificações (bloco órfão, sem saída humana, variável desconhecida, URL insegura, credencial faltando, etapa ou etiqueta inexistente, texto de exemplo esquecido etc.).
- Limites por canal aplicados no editor (WhatsApp: 3 botões, 10 itens de lista, rótulo de 20 caracteres).

### Os 15 blocos (`src/core/flow/schema.ts`)

| Grupo | Bloco | O que faz |
|---|---|---|
| Conversar | Mensagem | Texto em até 10 partes (texto, mídia, pausa, guardar variável, pausar automação) |
| | Mídia | Imagem, vídeo, documento ou áudio do Acervo, com legenda |
| | Pergunta | Botões (até 3) ou lista (até 10), opções fixas ou vindas de variável; valida data, hora, número, e-mail, telefone, CPF; aceita mídia, texto livre e tempo limite |
| | Pesquisa de satisfação | NPS 0 a 10 com saídas promotor/neutro/detrator e "por quê?" opcional |
| Decidir | Condição | Compara variável (igual, diferente, contém, vazio, preenchido, maior, menor) |
| | Voltar | Volta a um bloco anterior (ex.: menu) |
| | Ir para outra automação | Salta para outro fluxo |
| Organizar | Guardar | Grava variável ou campo do contato, com conta aritmética |
| | Etapa do funil | Move o cartão no funil |
| | Etiqueta | Aplica etiqueta |
| | Anotação | Escreve na ficha do contato |
| Integrar | IA | Conversa com IA, com ferramentas, catálogo, cardápio e contexto da empresa |
| | Serviços externos | Chamada HTTP (GET/POST/DELETE) com variáveis, credencial do cofre e mapeamento da resposta em variáveis |
| | Transferir para atendente | Handoff com motivo, mensagens, aviso por push e retomada automática |
| | Encaminhar contato | Manda o cliente para o WhatsApp de outro time, com mensagem pronta |

### Variáveis
- Nativas: nome, telefone, datas (hoje, amanhã, semana, próxima semana, daqui 30 dias, hora agora), horário de atendimento (aberto, próxima abertura, motivo fechado).
- Coletadas pelo fluxo viram campos do contato e colunas opcionais em Contatos e Respostas.

### Comportamentos do motor
- Palavras de escape ("atendente", "falar com uma pessoa") levam ao humano em qualquer ponto.
- Palavras de reinício ("menu inicial", "recomeçar") voltam ao começo.
- 3 respostas inválidas seguidas levam ao caminho de reserva.
- Proteção contra chamada HTTP a endereço interno (anti-SSRF).

### Gatilhos (o que abre um fluxo)
- **Palavra-chave** (igual ou contém), com contagem de disparos.
- **Campanha**: frase do anúncio Click-to-WhatsApp abre o fluxo certo (prioridade sobre palavra-chave).
- **Evento** de sistema externo por webhook de entrada assinado.
- **Primeira mensagem** pelos papéis do número.
- **API pública** (`POST /api/v1/fluxos/{id}/disparar`).
- **Lead Ads** (formulário do Facebook/Instagram vira contato e entra no funil).

### Modelos prontos e nichos
- Galeria "Nova automação" com busca e etiquetas. Modelos: em branco, recado, recado curto, menu de atendimento, qualificar (SDR), agendamento, reagendamento, não comparecimento, lembrete, aluno inativo, carrinho abandonado, atendimento de loja, status do pedido, cardápio com botões, atendente IA de restaurante, "vocês têm?", horário e local, pesquisa NPS, cobrança amigável. `src/exemplos/`
- **4 nichos** (`src/core/nichos.ts`): Aulas e serviços com horário, Loja virtual, Restaurante/delivery, Loja física. O nicho troca rótulos do menu (ex.: Alunos, Pedidos), modelos sugeridos, funil e perguntas da ficha da IA.

### Testar, compartilhar, importar
- **Simulador** na aba Testar, rodando o motor real.
- **Link compartilhado** `/f/[token]`: página pública com resumo, roteiro, conversa de teste e botão "importar para minha conta". Prazo (30 dias padrão), revogar, contador de aberturas, QR.
- **Exportar/importar JSON** do fluxo.

### Respostas
- Histórico de cada passagem pelas automações: filtro por automação, desfecho (terminou com o bot, foi para pessoa, não terminou), busca, colunas das variáveis, **exportar CSV**. `APP/respostas`

---

## 6. Inteligência artificial

### Provedores
- Cadeia com reserva automática: Cerebras, Gemini, Groq, Cloudflare Workers AI, Mistral (todos via modelo gpt-oss-120b ou Gemini Flash). `src/server/ia/cadeia.ts`
- **Chave própria do cliente** (só Gemini, plano Escala): guardada cifrada, tem prioridade sobre a da 4YU.
- IA é liberada por automação pela 4YU e exige o recurso no plano. Teto de respostas de IA por plano.

### Contexto e conhecimento
- **Contexto do negócio** em texto livre ou pela **Ficha do assistente** (perguntas por nicho, placar de preenchimento, testar).
- "Sobre a empresa" por bloco (até 6000 caracteres).
- **Acervo**: arquivos (imagem, vídeo, documento, áudio) para os blocos de mídia.
- **Materiais**: cardápio em PDF ou imagem, enviado pela IA quando pedem.
- **Catálogo** (próprio ou da loja) como fonte de produtos.
- Manuais/drivers da loja Magento enviados em PDF.

### Ferramentas que a IA usa (17, `src/core/ferramentas.ts`)
- **Agenda** (Verandi): ver horários, catálogo, minha agenda, **marcar**, **desmarcar**.
- **Loja**: buscar, "combina com", detalhes, mostrar card, frete, consultar pedido, manuais, enviar manual, enviar cardápio.
- **Cobrança**: montar pedido com soma conferida pelo servidor (itens, ajustes, taxa de entrega, forma de pagamento).
- Trava anti-invenção: IA só usa IDs/SKUs que vieram de resultado anterior.

### Segurança e autonomia
- Escopo fechado ao negócio (regra da Meta de jan/2026); "não sei" vira handoff.
- Proteção contra prompt injection (resultado de consulta é dado, não ordem).
- **Autonomia por ferramenta**: automático, pedir confirmação ao cliente ("posso marcar?") ou passar a humano. Escrita pede confirmação por padrão.
- Registro de cada chamada de ferramenta (LGPD art. 20).

### Aprendizado: Dúvidas
- Rotina noturna classifica as conversas por tema e por quem resolveu (IA, equipe, ninguém).
- Relatório "Principais dúvidas" e "Perguntas sem resposta".
- **Ensinar resposta**: a equipe grava pergunta + resposta e ela entra no contexto da IA.

---

## 7. Sequências, retomada e acompanhamento
- **Sequências** de até 5 passos (cada passo é um fluxo, com template opcional fora das 24h).
- Entram por: atendimento encerrado, etiqueta aplicada, etapa alcançada, cliente sumido (7 a 365 dias).
- Saem quando: respondeu, foi para humano, automação pausada, etiqueta de saída, janela fechou, vendeu, perdeu, mudou de etapa.
- **Retomada do bot**: conversa parada com humano volta ao bot após X minutos (padrão 120), com mensagem configurável; por conta e por bloco.
- **Mensagens agendadas** ao cliente (Inbox e ficha).
- Continuidade entre funis (ganhar no SDR abre no comercial, depois pós-venda).

---

## 8. Transmissões e templates
- **Templates (modelos da Meta)**: criar do zero (Marketing, Utilidade, Autenticação; até 10 botões), criar de modelos prontos (lembrete de consulta, confirmação, vencimento, pedido a caminho, retomar conversa, pós-atendimento, novidade), criar da biblioteca da Meta, apagar. Status sincronizado por webhook e conferência diária.
- **Transmissão**: nome, template aprovado, público por etiqueta (com contagem), variáveis por contato, envio agora ou agendado, limite diário com aviso.
- Motor de disparo com ritmo controlado, escada de limite da Meta (250 a ilimitado), novas tentativas por tipo de erro, para tudo se o template for derrubado.
- Lista com filtros e cancelamento; detalhe com cada destinatário (na fila, saiu, Meta avaliando, chegou, lida, não recebeu).
- **(parcial)** Público só por etiqueta na tela; segmentos salvos ainda não são público de transmissão.

---

## 9. CRM: contatos

### Lista de contatos
- Colunas: nome/telefone, responsável, etiquetas, nível de cliente, situação (com bot / aguardando pessoa), última mensagem. Colunas extras com cada variável coletada.
- Filtros somáveis: nível, etiquetas automáticas (abriu com mídia, foi para pessoa, não respondeu), etiquetas manuais, segmento.
- Busca, novo contato, **ações em lote** (etiquetar, pôr no funil, apagar), pausar bot por contato.
- **Exportar CSV** com os filtros aplicados (até 20.000 linhas).
- **Nível de cliente** Ouro/Prata/Bronze por valor comprado (faixas editáveis).

### Ficha do contato
- Nome, estágio (novo, lead, cliente, perdido, inativo; muda sozinho e aceita ajuste), responsável, temperatura, origem ("veio do anúncio X").
- Abas: Visão geral (negociações, informações, próximos passos, resumo de compras, anotações, etiquetas), Atividades, Automático (agendadas e sequências), Histórico (diário + linha do tempo), Dados e origem (o que o fluxo coletou + jornada de anúncios), Conversa completa.
- Modo editar com barra de salvar. Corrigir nome com histórico. Cancelar venda registrada.
- Precedência de dados: correção humana não é sobrescrita por importação ou automação.

### Importar contatos
- CSV até 4 MB; detecta Nome e Telefone sozinho; casa por telefone (com ou sem nono dígito); linhas recusadas voltam editáveis.
- Importar leads antigos do Lead Ads (até 90 dias).

### Segmentos
- Regras salvas (todas/qualquer) sobre nome, telefone, estágio, responsável, datas, valor, compras, produto comprado, temperatura etc. Contagem ao vivo. Filtram a lista e o CSV.

### Etiquetas
- Criar, renomear, 6 cores, juntar duas, apagar, contagem clicável. 3 etiquetas automáticas.

---

## 10. Funil, negócios e vendas
- **Vários funis** por conta. **6 modelos**: Atendimento, Comercial, Captação (SDR), Agenda e avaliação, Pós-venda e recompra, Pedidos. Ou em branco.
- Etapas (até 8): normal/ganho/perdido, cor, limite de dias parado.
- Vista **Kanban** (arrastar) e **Lista**. Alerta de cartão parado. Filtros (situação, responsável, temperatura), busca, ordenar por espera, valor ou recente.
- Cartão: responsável, título, ganhar (com ou sem valor), perder (com motivo), reabrir, tirar do funil. Painel lateral com o contato.
- Trazer contatos para o funil (um, todos, em lote). Funil padrão para contato novo. **Entrega encadeada** entre funis.
- **Página do negócio**: etapa atual, valor, produto, previsão de fechamento, responsável, qualificação, origem, anotações, atividades, outros negócios da pessoa, histórico com filtros, levar para outro funil.
- **Registrar venda** com itens (produto, quantidade, valor unitário); cancelar/corrigir venda (permissão separada).

---

## 11. Atividades e agenda
- Tipos: tarefa, ligação, reunião, visita, proposta (cada um com campos próprios).
- Criar na agenda, na ficha, no Inbox ou no negócio. Concluir, cancelar com motivo, reabrir, reagendar rápido, atribuir.
- Vistas: **Lista** e **Calendário** (semana ou mês). Filtros por situação, prazo (vencidas, hoje, próximas), tipo, responsável, minhas ou da equipe.
- Contador de atrasadas no menu e no Início.
- **Agendamento com o cliente** via integração **Verandi**: horários, marcar, desmarcar, lista de espera, pelos blocos e pela IA; horário de atendimento puxado do CRM Verandi.

---

## 12. Comércio: produtos, pedidos, frete

### Catálogo próprio
- Produto ou serviço: nome, preço, SKU, descrição, link, foto (URL), categoria, ordem; arquivar sem perder histórico.
- **Importar planilha** CSV/XLSX com prévia e erros por linha; reimportar atualiza sem duplicar (até 2000 itens). Download de planilha modelo.

### Lojas externas
- **Magento / Adobe Commerce**: busca de produtos, ficha técnica, "combina com", estoque exato, foto real, **frete**, **consulta de pedido**, **cupons**, **rastreio** (Frete Rápido), manuais em PDF.
- **Nuvemshop**: conexão OAuth, leitura de produtos com preço e estoque por variação.
- Tray, Loja Integrada, VTEX, WooCommerce, Shopify: "Em breve" com botão "Quero esta" (registra interesse).

### No atendimento
- **Cards de produto** (até 3 por vez) enviados pelo bot ou pelo atendente, com link rastreado (UTM + registro de clique).
- **Pedido na conversa**: IA monta o pedido, servidor soma em centavos pelo catálogo e manda o resumo (Pix, cartão ou na hora; entrega ou retirada; taxa e ajustes).
- **Consulta de pedido** (Magento) só se telefone ou CPF batem com o pedido; situação, itens, total, rastreio.
- **Frete** (Magento) por CEP, com transportadora e preço.
- **Cupons** (Magento): listar e enviar; relatório de cupons enviados vs. usados.
- Modelo de fluxo de **carrinho abandonado** (disparo por campanha).
- Relatório de produtos oferecidos, por robô ou pessoa, e cliques.

### Pagamento
- **(parcial)** Só demonstração: Pix copia e cola e checkout de cartão fictícios (`/demo/pagar`). Nenhum gateway real.

---

## 13. Anúncios da Meta e Lead Ads
- Conectar conta de anúncios e Páginas do Facebook (OAuth).
- **Atribuição Click-to-WhatsApp**: grava anúncio, título, mídia e `ctwa_clid` na primeira mensagem; nome da campanha, conjunto e anúncio resolvido pela API.
- Origem do lead na ficha, na fila do Inbox e nos relatórios ("de onde vêm os contatos", "de onde vêm as vendas").
- **Lead Ads**: formulário nativo do Facebook/Instagram vira contato, com respostas nos campos, e entra no funil. Rede de segurança diária recupera leads perdidos.

---

## 14. Integrações e credenciais
- **Catálogo "Todas as conexões"**: WhatsApp, Instagram, anúncios, chaves, Magento, Nuvemshop, site, Telegram (desenhado).
- **Cofre de credenciais** (Supabase Vault): valor entra e nunca volta para a tela; blocos usam a credencial pelo ID.
- **Integrações prontas no bloco Serviços externos**: RD Station (conversão), Google Sheets (gravar linha, ler), Verandi (13 operações de agenda), webhook genérico.
- Integração **Verandi** (agenda) também por webhook de entrada ("avisa se abrir vaga").

---

## 15. API pública v1
- Autenticação `Authorization: Bearer af_live_...`, chave guardada só em hash, mostrada uma vez.
- 6 escopos: `contatos:ler`, `contatos:escrever`, `fluxos:disparar`, `mensagens:enviar`, `funil:ler`, `funil:escrever`.
- 120 chamadas/min por chave, corpo até 64 KB, erros padronizados, `Idempotency-Key` no envio de template, teto diário de templates (500, ajustável).

| Método | Caminho | O que faz |
|---|---|---|
| GET | `/api/v1/contatos` | Lista paginada, filtros por etiqueta e data |
| POST | `/api/v1/contatos` | Cria ou atualiza contato com campos e etiquetas |
| GET | `/api/v1/contatos/{telefone}` | Consulta um contato |
| GET | `/api/v1/etiquetas` | Lista etiquetas |
| GET | `/api/v1/fluxos` | Lista automações |
| POST | `/api/v1/fluxos/{id}/disparar` | Abre a automação para um contato |
| GET | `/api/v1/templates` | Lista templates aprovados |
| POST | `/api/v1/mensagens/template` | Envia template (cria o contato se preciso) |
| GET | `/api/v1/funil` | Funis e etapas |
| GET | `/api/v1/funil/oportunidades` | Oportunidades de um telefone |
| POST | `/api/v1/funil/oportunidades` | Abre oportunidade |
| PATCH | `/api/v1/funil/oportunidades/{id}` | Muda etapa, ganha ou perde |

- **Docs públicas** em `/ajuda/desenvolvedores` com exemplos em cURL, Node e Python, busca (atalho K) e "copiar página".

---

## 16. Webhooks
- **Saída** (até 5 por conta): eventos `contato.criado`, `contato.etapa_mudou`, `oportunidade.ganha`, `oportunidade.perdida`. Assinatura HMAC-SHA256, segredo `whsec_` trocável, 6 tentativas (1 min a 12 h), pausa após 20 falhas, botão de teste e log de entregas.
- **Entrada**: `POST /api/webhook/entrada/{clienteId}` com `{evento, telefone, dados}` assinado; cada evento abre um fluxo. Tela mostra a última chamada recebida.

---

## 17. Equipe, permissões e distribuição

### Funções e permissões
- 4 funções: Proprietário, Administrador, Gestor, Atendente (mais Suporte 4YU).
- 8 capacidades: configurar empresa, configurar operação, atender, criar oportunidade, registrar venda, corrigir venda, ver valores, exportar. Escopos: nenhum, próprios, equipe, todos.
- Hierarquia: ninguém edita quem está acima nem concede o que não tem; só o proprietário passa a posse.
- Exceções por pessoa com prévia em português. **Equipes** (criar, arquivar).
- Remover pessoa escolhendo para onde vão as conversas e tarefas dela.

### Distribuição
- Manual ou **automática por rodízio balanceado** (menos conversas abertas primeiro), respeitando presença (disponível/ausente), quem entra no rodízio e teto por pessoa. Carteira: contato com dono volta para ele.
- Passar conversas antigas em lote.

### Horário de atendimento
- Por dia da semana, no fuso da conta; pode copiar do Verandi.
- Fora do horário o bot segue atendendo e troca a promessa ("voltamos amanhã às 08:00"). Fluxos podem desviar por expediente.

---

## 18. Conta, login e segurança
- E-mail e senha (mínimo 10, senha vazada bloqueada), confirmação de e-mail, esqueci/redefinir senha (e-mail via Brevo).
- **Verificação em duas etapas** (TOTP + códigos de recuperação); obrigatória para admin da plataforma.
- Limite de tentativas de login por IP e por conta; até 3 aparelhos por usuário.
- Perfil: nome, foto, senha, presença.
- Um login em **várias organizações** (até 20), com função diferente em cada.
- Cabeçalhos de segurança (HSTS, anti-iframe, nosniff etc.); auditoria append-only com cerca de 45 tipos de ato.
- **LGPD**: páginas de termos, privacidade e exclusão de dados; contatos inativos há 12 meses apagados sozinhos; exportação CSV; apagar contato e conta.
- Aviso "saiu versão nova" na aba aberta.
- "Sentiu falta de algo?": caixa de sugestão em todas as telas.

---

## 19. Planos e consumo

Tabela de 05/out/2026 (`docs/PLANO-PRECOS-05-OUT.md`, migration `0128`).

| Plano | R$/mês | Anual (por mês) | Atendentes | Extra | Conversas | Números | IA/30 dias |
|---|---|---|---|---|---|---|---|
| Essencial | 297 | 247 | 3 | R$ 69 | 1.000 | 1 | 1.500 |
| Profissional | 597 | 497 | 10 | R$ 59 | 3.000 | 2 | 3.000 |
| Escala | 1.197 | 997 | 25 | R$ 49 | 8.000 | 5 | 6.000 |
| Enterprise | a partir de 2.500 | contrato | acima de 50 | negociado | sob medida | sob medida | sob medida |

- Recursos: Essencial = CRM, IA, transcrição, transmissões (2.000 envios/mês). Profissional = + integrações, vários números, API. Escala = + chave de IA própria (sem teto de IA), webhooks.
- Conversa excedente: R$ 0,40 / 0,30 / 0,20. Disparo sem resposta não conta.
- Atendente além do incluso: o modal de dar acesso mostra o custo e pede aceite.
- Transcrição desconta do teto de IA, salvo com chave própria.
- **Teste grátis de 14 dias** no Profissional, ativado pelo admin; vencido sem plano, IA, transmissões, integrações e API pausam.
- Perder um recurso deixa só leitura; nada é apagado; consumo nunca trava.
- Tela **Plano e consumo**: conversas, atendentes usados e custo extra, franquia da Meta, teste, pedido de troca.
- **(parcial)** Sem cobrança automática: troca de plano e cobrança de extras são feitas pela 4YU.

---

## 20. Onboarding
- **Assistente em 4 passos**: negócio, atendimento, preparação, revisão. Pergunta nicho, objetivo, modo de atendimento, canal, funil e chatbot; cria rascunho de automação e funil.
- **Objetivo da conta** (atender, automatizar, vender) define os "primeiros passos" cobrados no Início.
- Trilha de configuração: dados da empresa, canal, horário e conhecimento, automação publicada, testar.
- Liga/desliga CRM e Comércio por conta.

---

## 21. Administração da plataforma (`/admin`, só 4YU)
- Visão geral, **Organizações** (criar, filtrar; detalhe com dados, plano, pessoas, auditoria, suspender, excluir).
- **Usuários**: tornar admin, suspender, derrubar sessões, editar, redefinir senha, pôr em organização, excluir.
- **Planos** (editar, criar, mover organizações), **Funções** (matriz de capacidades), **Pedidos de plano** (atender/recusar).
- **Consumo** de todas as contas, **Alertas** automáticos (também no Discord), **Auditoria** global, **Sugestões** recebidas.
- **Entrar como** cliente (sessão de 1h, faixa de aviso, auditado).

---

## 22. Rotinas automáticas (crons)

| Horário | Rotina |
|---|---|
| 07:00 | Retenção: apaga inativos de 12 meses e alertas antigos, renova token do Instagram, reconcilia templates, aplica mudanças de plano |
| 07:15 | Tarefas agendadas (inclui cópia do consumo da Meta) |
| 07:30 | Recupera leads de formulário perdidos |
| 07:45 | Reenvia webhooks de saída pendentes |
| 08:00 | Classifica as dúvidas do atendimento |

Mensagens agendadas, transmissões e retentativas também "pegam carona" no webhook do WhatsApp e no stream do Inbox.

---

## 23. Site, ajuda e demonstração
- **Site comercial** (`/`): produto, preços, dúvidas, contato.
- **Central de ajuda** `/ajuda`: 4 categorias, busca, artigos sobre fluxos, blocos, variáveis, perguntas, datas, listas, erros, Verandi, receitas, dúvidas. Gaveta de ajuda dentro das telas.
- **Docs de desenvolvedor** (seção 15).
- **Demo no WhatsApp**: bots de exemplo por ramo com Pix e cartão fictícios.

---

## 24. O que ainda não existe

| Área | Falta |
|---|---|
| Pagamento | Gateway real (Pix, cartão, boleto); cobrança automática do plano |
| Frete | Correios, Melhor Envio, consulta de CEP; frete fora do Magento |
| Loja | Pedido gravado no banco; webhooks de pedido/carrinho; estoque e variantes no catálogo próprio; upload de foto |
| Lojas | Tray, Loja Integrada, VTEX, WooCommerce, Shopify |
| Anúncios | Conversions API (envio de eventos para a Meta) |
| Canais | Telegram completo; Instagram aberto a qualquer cliente; ligação pelo WhatsApp |
| CRM | Busca global; mesclar contatos duplicados; importar contatos por XLSX; mapear colunas na importação |
| CRM sem tela | Campos personalizados tipados, criar motivos de perda, qualificação por critérios (existem no servidor) |
| Agenda | Google Calendar / iCal; lembrete de atividade por e-mail ou push |
| Equipe | Convite por e-mail (acesso é criado com senha provisória) |
| Avisos | E-mail de handoff (só push) |
| Relatórios | Exportação dos relatórios; custo de IA visível |
| Transmissões | Público por segmento; métricas de clique |
| Mensagens | Editar mensagem enviada; encaminhar mensagem entre conversas |
| App | PWA instalável (há push, falta manifest); login com Google |
