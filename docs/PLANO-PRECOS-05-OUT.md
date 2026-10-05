# Planos e preços: decisão de 05/out/2026 e como implementar

Decidido por Gabriel em 05/out/2026, depois de inventário do código
(`docs/FUNCIONALIDADES.md`) e pesquisa de 29 concorrentes. **Reverte** a decisão
de 16/set "atendente ilimitado" (`src/core/planos.ts:17`): 200 pessoas no
Essencial custam banco (cada Inbox aberto consulta 1x/s), storage e suporte, e a
conversa não cobre isso.

## A tabela

| | Essencial | Profissional (id `operacao`) | Escala | Enterprise |
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
- Profissional: + `integracoes`, `api`, `varios_numeros` (2 números)
- Escala: + `chave_propria`, `webhook`

**Id `operacao` fica**: `clients.plano` tem FK para `planos.id`. Só o **nome**
muda para "Profissional".

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
