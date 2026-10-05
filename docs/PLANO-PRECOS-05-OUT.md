# Planos e preços: decisão de 05/out/2026 e como implementar

Decidido por Gabriel em 05/out/2026, depois de inventário do código
(`docs/FUNCIONALIDADES.md`) e pesquisa de 29 concorrentes. **Reverte** a decisão
de 16/set "atendente ilimitado" (`src/core/planos.ts:17`): 200 pessoas no
Essencial custam banco (cada Inbox aberto consulta 1x/s), storage e suporte, e a
conversa não cobre isso.

## A tabela

| | Essencial | Operação (id `operacao`) | Escala | Enterprise |
|---|---|---|---|---|
| Mensal | R$ 297 | R$ 597 | R$ 1.197 | a partir de R$ 2.500, sob consulta |
| Anual | 2.970 (247/mês) | 5.970 (497/mês) | 11.970 (997/mês) | contrato |
| Atendentes inclusos | 3 | 10 | 25 | acima de 50 |
| Atendente extra/mês | R$ 69 | R$ 59 | R$ 49 | negociado |
| Conversas/mês | 1.000 | 3.000 | 8.000 | sob medida |
| Excedente/conversa | 0,40 | 0,30 | 0,20 | negociado |
| Números | 1 | 2 | 5 | ilimitado |
| Respostas de IA/mês | 1.500 | 3.000 | 6.000 (sem teto com chave própria) | sob medida |
| Transmissões | 2.000 envios/mês | sem limite | sem limite | sem limite |

Recursos (`RECURSOS_DO_PLANO`):
- Essencial: `crm`, `ia`, `transcricao`, `transmissoes`
- Operação: + `ia_ferramentas`, `sequencias`, `integracoes`, `api`, `varios_numeros` (2 números)
- Escala: + `chave_propria`, `webhook`

**Id `operacao` fica**: `clients.plano` tem FK para `planos.id`. O nome foi
"Profissional" na 0128 e voltou a "Operação" na 0130.

## Regras novas
1. **Atendente conta**: membro da organização com capacidade `atender`, exceto
   suporte 4YU. Passar do incluso **não bloqueia**: avisa o custo extra antes de
   dar acesso e soma na estimativa da fatura (mesma lógica do excedente de
   conversa; não há gateway). Acima de 50: tela pede falar com a 4YU.
2. **Transcrição desconta do teto de IA**, exceto quando a conta usa chave
   própria. Com chave própria, a IA não tem teto.
3. **Teto de IA explícito por plano** (coluna nova), em vez de 5 por real.
4. **Transmissões no Essencial**: teto de 2.000 envios/mês.
5. **Teste de 14 dias**: plano Profissional, teto de 100 conversas, sem cartão,
   ativado pela 4YU (admin). Ao vencer, a conta fica só leitura até escolher
   plano (mesma regra de "perdeu recurso").

## Implementação (ordem)
1. Migration `0128_planos_out_2026.sql` (`set search_path = public, extensions`):
   colunas `atendentes_inclusos int`, `preco_atendente_extra numeric(10,2)`,
   `teto_ia int`, `teto_transmissoes int null`; update das 3 linhas;
   `clients.teste_ate date null`. **Aplicar em produção só com OK explícito.**
2. `src/core/planos.ts`: campos novos no tipo, `PLANOS` reserva igual à
   migration, `tetoDeIaDaConta` lê o plano, função `custoDeAtendentesExtras`,
   comentário do topo trocado (atendente conta, por quê).
3. `src/server/repos/planos.ts`: ler/gravar colunas novas.
4. Trava de atendente: `acaoDarAcessoNaOrganizacao` e `acaoTrocarFuncao`
   (`src/server/acoes-pessoas.ts`) devolvem aviso de custo; tela Pessoas confirma.
5. Transcrição no teto: `src/server/transcrever-audio.ts` registra em
   `ia_chamadas` (ou contador equivalente) quando a chave é da 4YU.
6. Teto de transmissões: `src/server/acoes-transmissoes.ts`.
7. Teste de 14 dias: admin ativa (`/admin/organizacoes/[id]/plano`), faixa na
   conta mostra dias restantes, `recursos-do-plano.ts` respeita `teste_ate`.
8. Tela Plano e consumo e admin: atendentes usados/inclusos e custo extra.
9. Site (`src/app/page.tsx`, lê `core/planos.ts`): itens novos, Enterprise
   "fale com a gente", sai "atendentes ilimitados", entra "sem implantação,
   sem fidelidade, taxa da Meta sem acréscimo".
10. `docs/DECISIONS.md`: registrar a reversão.
11. Validar com `tsc` + testes de `core/planos`; print de site e Plano em 1440
    e 390.

## Fora desta entrega
- Armazenamento por plano (5/20/50 GB): depende do Supabase Pro (nov/2026).
- Gating novo de loja, Lead Ads, sequências: hoje não são recurso de plano;
  a tabela os lista por plano só como comunicação.
- Comparação nominal com concorrente no site: conferir cada preço antes
  (pesquisa feita por agente Haiku teve dados contraditórios: SURI, Kommo).
- Preço de fundador, migração grátis, página por nicho: venda, não código.

## Planos v2 (05/out/2026, à tarde)

Mesma tabela, quatro pontos do documento do sócio (migrations `0129` e `0130`):

- **Leitor**: função nova, ilimitada e grátis. Vê Início, contatos, funis e
  relatórios com valores; não escreve nem abre a Inbox; não conta como
  atendente. Só administrador para cima atribui.
- **Autonomia sobe, modelo não**: `ia_ferramentas` (IA que consulta e age) e
  `sequencias` só do Operação para cima. No Essencial a IA conversa com
  contexto, sem ferramenta, e nenhuma sequência nova inscreve ninguém.
- **Nome**: o plano do meio voltou a ser **Operação**.
- **Narrativa**: Organizar (Essencial) / Automatizar (Operação) / Decidir
  (Escala), no `resumo` de cada plano.

## Quando o preço sobe

O Escala vende hoje só o que existe. Cada item abaixo, quando existir, entra no
card do Escala e justifica subir o preço dele:

| Recurso | O que é |
|---|---|
| Meta Conversions API | devolver a venda fechada para a Meta otimizar o anúncio |
| Atribuição campanha → venda → receita | quanto cada campanha trouxe em dinheiro, não só em lead |
| Copiloto de vendas | a IA sugerindo o próximo passo do negócio para o vendedor |
| Lead scoring | nota de chance de fechar em cada contato |
| Dashboards customizados | o dono monta o painel com os números dele |

Antes de mexer em preço, medir com as 15 primeiras empresas: adoção (quem usa
o quê), retenção, uso de IA, volume de conversa, chamados de suporte e custo
por conta. O preço sobe com dado, não com lista de recurso.
