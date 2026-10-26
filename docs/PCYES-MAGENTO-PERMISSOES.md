# Permissões do Magento da PCYES (integração do AutoFluxos)

Árvore de recursos da integração que gerou o token do AutoFluxos, como estava
em 26/out/2026 (prints do Gabriel). `[x]` = marcado. Serve para saber o que
pedir sem precisar de print novo. Onde fica no admin: **Sistema > Extensões >
Integrações > (integração do AutoFluxos) > Editar > API > Recursos**.

Mudou alguma caixinha? Se o Magento pedir **Reautorizar**, ele gera token novo
e o atual para; troque na credencial da loja em
https://autofluxos.4yu.com.br/clientes/64dbc3a9-1f77-4892-9770-e3e4be9e14cd/ajustes/chaves

**Permissão controla o que o AutoFluxos pode perguntar ou fazer no Magento.
Nenhuma caixinha faz o Magento avisar o AutoFluxos sozinho** (isso exige
módulo instalado; em 26/out não havia nenhum de webhook genérico).

## O que cada uso precisa

| Uso no AutoFluxos | Recurso | Situação |
|---|---|---|
| Consultar pedido, rastreio, pedidos que viraram Processando | Vendas > Operações > Meus Pedidos > Ações > Visualizar | [x] |
| Ler cadastro do cliente (aceite de WhatsApp) | Clientes > Todos os Clientes (`Magento_Customer::customer`) | [x] desde 26/out |
| Estoque exato | Inventário > Stocks > Sales Stock; Catálogo > Inventário > Produtos | [x] |
| Cupons do inbox | Marketing > Promoções > Regras de preço do carrinho | [x] |
| Ler e lançar PC Points (`/V1/rewards/...`) | Mirasvit (Menu Mirasvit, Lojas > Configuração > Mirasvit Reward Points) | [x], lançamento testado em 26/out |

## A árvore (o que estava marcado)

- Dashboard [ ]
- Lof All, Lof Product Label, MagePal Notification [ ]
- Pontos de recompensa > Earning Rules, Spending Rules, Mensagens, Terceiro, Transações, Referências, Configurações, Relatório [ ]
- Analítica > API [ ]; Magiccart > Magicslider [ ]; Melhor Envio > Envios, Configuração [ ]
- **Vendas [x]**
  - **Operações [x] > Meus Pedidos [x] > Ações [x]**: **Visualizar [x]**; Criar, Order Save API, Pay with Payment Services, Enviar e-mail de pedido, Refazer pedido, Editar, Cancelar, Aceitar ou negar pagamento, Captura, Fatura, Memorandos de crédito, Em espera, Retomar, Enviar, Comente, Enviar e-mail de vendas, Payment Amount Authorization [ ]
  - Serviços de Pagamento, Faturas [ ]; **Postagens [x]**; Memorandos de Crédito, Acordos de Faturamento, Transações, Carrinhos Abandonados [ ]
- **Catálogo [x] > Inventário [x] > Produtos [x]** (Mass Update, Edit Product Design, Pre Order Release Notification [ ]); Categorias, Amasty Related Products, Amasty Product Feed [ ]
- **Clientes [x] > Todos os Clientes [x] > Ações [x]** (Excluir, Reset password, Invalidate tokens, Remote shopping assistance opt-in [ ]); Online Agora, Grupos de Cliente, Login como Cliente [ ]
- Carrinhos, Dashboard [ ]
- **Marketing [x] > Promoções [x] > Regras de preço do carrinho [x]**; Regra de preço de catálogo, Cart Price Rules Wizard, Afiliados (todos), Email Marketing, Comunicações (e-mail, newsletter), Amasty SEO, SEO & Pesquisa, Conteúdo do Utilizador (avaliações) [ ]
- Mageplaza (Smtp, Documentations, Active Module), Plumrocket, Conteúdo (páginas, blocos, widgets, mídia, templates, temas), TikTok Shop Integration [ ]
- **Relatórios [x] > Vendas [x] > Cupons [x]**; demais relatórios (Marketing, Pre-Order, Avaliações, Clientes, Produtos, Estatísticas, BI, Amasty) [ ]
- **Lojas [x] > Configurações [x] > Configuração [x]**: **Core > Validador de extensões Mirasvit [x]**, **Mirasvit Reward Points [x]**, **Mirasvit Reward Social [x]**; todas as outras seções [ ]; Termos e Condições, Situação do pedido [ ]
- **Inventário: Stocks > Sales Stock [x]**; Sources, demais Stocks, Impostos, Moeda, Atributos, Outras Configurações [ ]
- **Menu Mirasvit [x]**
- Sistema (cron, Adobe, transferência de dados, integrações, cache, backups, índices, permissões, logs, notificações, chave de encriptação, serviços) [ ]
- Busca Global, Oderco Order XML API [ ]
