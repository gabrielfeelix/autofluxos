# Plano de teste 05/out/2026: antes de abrir ao público

Base: `docs/HANDOFF-05-OUT-CACA-BUG.md`. Banco sempre local (`.env.teste-local`),
nunca produção. Um processo pesado por vez.

## Critério de "funciona" (vale para todo item)

1. A ação grava? (Server Action não falha calada)
2. Recarregar mantém o valor?
3. O banco local tem o valor? (`psql` no Supabase local)
4. Filtro/dropdown muda a lista de verdade?
5. Erro do servidor aparece na tela?

Item reprovado vira linha em "Achados" abaixo: `arquivo:linha`, sintoma, status.

## Fase 1: varredura estática (Haiku, paralelo, só leitura)

8 agentes, um por área. Procuram: botão sem `onClick` ou handler vazio,
`Dropdown` cujo `aoMudar` não chega a ação, filtro lido da URL e não aplicado
na consulta, Server Action que não grava o campo mostrado, erro engolido
(`catch` vazio, resultado ignorado), texto "em breve". Saída: `arquivo:linha` + suspeita.

| # | Área |
|---|---|
| 1 | Entrada: `cadastrar`, `criar-conta`, `entrar`, `esqueci-senha`, `redefinir-senha`, `ativar-duas-etapas`, `primeiro-acesso`, `confirmar-email` |
| 2 | `configurar/` + `ajustes/` (recursos, contexto, negocio, plano, horario, retomada) |
| 3 | `ajustes/` (integracoes, anuncios, chaves, api, equipe, distribuicao, etiquetas, acervo) |
| 4 | `fluxos/` (editor, publicar, simulador) |
| 5 | `inbox/` + `conversas/` |
| 6 | `leads/` (filtros, colunas, ficha e abas) |
| 7 | `quadros/` + `negocios/` |
| 8 | `atividades/`, `transmissoes/`, `respostas/`, `favoritas/`, `loja/`, `relatorios/`, Início |

Opus confirma cada suspeita lendo o código antes de corrigir.

## Fase 2: teste real no navegador (precisa do Docker)

Ordem de prioridade, um spec ou roteiro por vez:

1. **Entrada**: cadastro, login, esqueci a senha, duas etapas (specs já existem: rodar os 3).
2. **Configuração**: cada aba de `ajustes/` e o `configurar/`: salvar, recarregar, conferir no banco. Spec novo `configuracao.spec.ts`.
3. **Fluxos**: criar, editar, publicar, simulador responde.
4. **Inbox**: filtros (abertas, meus, não lidas, classificar), assumir, devolver, transferir (modal novo), finalizar, agendar, atividade, nota, etiqueta, favoritar, emoji, anexo.
5. **Contatos**: filtros, colunas, ficha (6 abas), "+ Atividade", apagar.
6. **Funil**: mover, ganhar, perder com motivo, atribuir, menu do cartão (portal novo).
7. **Atividades, transmissões, respostas, favoritas, loja.**
8. **Relatórios**: período, escopo, funil; Vendas não pode dar `permission denied`.
9. **Início**: fila da equipe, "Precisa de você" pela janela de 24h, negócios parados.

## Fase 3: prints do que entrou hoje (nunca visto)

1440 e 390: ficha do contato (6 abas, vazios ilustrados), modal transferir,
menu do cartão do funil, mapa de horários, Vendas, Início, estrela de favorita.

## Fase 4: correção

Inline no Opus, `tsc` + `eslint`, commit e push por frente. Migration de
`vendas` para `autofluxos_dados` só com autorização.

## Achados

| # | Onde | Sintoma | Status |
|---|---|---|---|
| 1 | `leads/page.tsx` paginação | Trocar de página com segmento ativo perdia o segmento | corrigido `adbc30c` |
| 2 | `anuncios/cartao-da-pagina.tsx` | Falha ao desligar Página não aparecia | corrigido `adbc30c` |
| 3 | `conta/distribuicao.tsx` | Falha ao gravar teto/rodízio deixava valor que não está no banco | corrigido `adbc30c` |
| 4 | `acoes-conta.ts` cadastro | Conta criada, login falha: tela de erro e "não deu para criar" na volta | corrigido `4c837c7` |
| 5 | `acoes.ts` horário | Salvar não revalidava `ajustes/horario` | corrigido `4c837c7` |
| 6 | `cliente/ficha.tsx` tirar logo | Sem retorno visível de sucesso/erro | aberto, baixo |
| 7 | `transmissoes` | Filtro aplicado no navegador, não na consulta (lento com volume) | aberto, baixo |

| 8 | Brevo `autofluxos.mail.4yu.com.br` | Domínio nunca autenticado: redefinição de senha e confirmação de e-mail davam erro em produção | corrigido: 4 registros DNS na Hostinger, domínio autenticado, teste entregue |
| 9 | `scripts/ux-local/cadastro.mjs` | Rótulo velho ("Nome da empresa") | corrigido |

Fase 1 concluída: 8 áreas lidas; fluxos e inbox sem achado real.

Fase 2 (local, 05/out): 43 páginas abrem sem erro 500, erro de console ou tela de erro.
Gravam, aparecem no banco e sobrevivem ao recarregar: Negócio (cadastro), Contexto,
Horário, Retomada, Recursos (objetivo, nicho, CRM), Distribuição (modo, rodízio, teto),
Equipe (função, inclusive troca de proprietário). Faltam: Etiquetas, Chaves/API, Acervo,
Configurar, e os specs e2e existentes (um por vez, sem o dev server).
