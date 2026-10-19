# Handoff 19/out/2026: teste de invasão de fora (AutoFluxos e Verandi)

Para o próximo agente. Gabriel não é dev: quer decisão tomada e implementada,
resposta curta em pt-BR. Tudo até aqui foi conferido **por dentro** (código,
banco, configuração). Falta olhar **de fora**, como um atacante olharia.

## Leia antes

1. `4yu-apps/CLAUDE.md` (segredos, IDs, banco compartilhado).
2. `autofluxos/docs/BANCO-COMPARTILHADO.md` e `verandi/docs/BANCO-COMPARTILHADO.md`
   (regras; o fim de cada um registra o que mudou em 19/out).
3. `autofluxos/docs/INCIDENTE-LGPD.md`: se o teste achar dado exposto, é
   incidente, e o roteiro vale.

## O que já foi feito em 19/out (não refaça)

- Banco: RLS em todas as tabelas, nenhuma função `security definer` executável
  por `anon`, políticas da Verandi por ação, índices, SSL obrigatório
  (`ESSLREQUIRED` sem TLS).
- SQL direto do AutoFluxos com TLS e certificado conferido
  (`src/server/conexao-do-banco.ts`).
- Next 16.4.2, `sharp` 0.35.5, `npm audit` zerado nos dois; Dependabot ligado
  nos dois.
- Cabeçalhos nos dois: HSTS, `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `nosniff`, Referrer-Policy,
  Permissions-Policy.
- Auditoria de IDOR nas Server Actions e rotas dos dois produtos: ver a seção
  "Auditoria de 19/out" no fim deste arquivo.

## O teste: o que fazer

**Regra de ouro: produção tem cliente pagante (MGM nos dois produtos).** Varredura
**ativa** (que tenta injetar, cadastrar, enviar formulário) só contra o
ambiente **local** (Docker, `npx supabase start` + `next dev`). Contra produção,
só varredura **passiva**, que lê respostas sem atacar. Nunca rodar dois
processos pesados juntos na WSL (derruba a máquina).

1. **Passivo em produção** (seguro):
   - OWASP ZAP baseline:
     `docker run --rm -t zaproxy/zap-stable zap-baseline.py -t https://autofluxos.4yu.com.br -I`
     e o mesmo para `https://verandi.4yu.com.br`. Um de cada vez.
   - TLS: `testssl.sh` (ou `docker run --rm drwetter/testssl.sh <host>`).
   - Cabeçalhos: conferir com `curl -sI` que os da lista acima saem em toda
     rota, inclusive `/api/*`.
   - Exposição: `/.env`, `/.git/config`, `/_next/static/**/*.map`
     (source map de produção não deveria sair), `/api-docs` da Verandi (o que
     ela mostra sem login?).
2. **Ativo no local** (Docker):
   - ZAP full scan contra `http://localhost:<porta>` de cada app.
   - IDOR manual com **duas organizações de teste**: logado na A, chamar as
     Server Actions e rotas com ids da B. Telefone de teste é sempre DDD 44.
   - API pública da Verandi (`/api/v1/*`): chave da conta A tentando ler dado
     da conta B; chave revogada; chave errada repetida (há limite?).
   - Webhooks (`/api/webhook/whatsapp`, `instagram`, `leadgen`, `entrada`):
     corpo sem assinatura e assinatura errada devem dar 401.
   - Upload: arquivo com extensão de imagem e conteúdo de HTML/SVG com script;
     arquivo acima do limite; caminho com `../`.
   - Prompt injection na IA do AutoFluxos: mensagem de contato pedindo para
     ignorar instruções, revelar o prompt, ou chamar ferramenta de escrita.
     A escrita nasce em "confirmar" (`src/server/ia/politica.ts`); confirmar
     que nenhuma ferramenta grava sem isso.

## Entrega esperada

- Achados confirmados, mais graves primeiro, com como reproduzir e a correção.
- Corrigir o que for código, com teste; o que for decisão, levar ao Gabriel
  em uma linha cada.
- Registrar em `docs/DECISIONS.md` e nos dois `BANCO-COMPARTILHADO.md` se
  tocar banco. Migration: regras do runbook (ensaio em transação, aplicador da
  Verandi, autorização explícita para produção).

## Fora do escopo, já decidido pelo Gabriel

- Troca do segredo JWT antigo (HS256): adiada (ver `PENDENCIAS-DO-GABRIEL.md`).
- PITR, compute maior, teste de restauração em projeto novo: não.
- Backup dos arquivos do Storage em outro provedor: não agora. Nenhum código
  apaga em massa; volta a valer se o Storage passar a guardar documento
  crítico.
- CSP completa com `script-src` e nonce: tarefa própria, só com teste real no
  navegador.

## Auditoria de 19/out

Feita por leitura de código (~310 ações e 47 rotas no AutoFluxos; 111 ações,
11 rotas da API e 6 páginas de admin na Verandi). Nenhum vazamento **entre
organizações/contas** no código. O que apareceu:

**Corrigido em 19/out** (Verandi `c51617f` + `0083_vr`; AutoFluxos `26e07264`):

- Verandi, **crítico**: dono gravava pela API convite do tipo `senha` com o
  e-mail de qualquer pessoa e trocava a senha dela ao aceitar. Fechado no
  aceite (`aceitarConvite`) e no banco (gatilho da `0083`). Nenhum uso
  encontrado: só um convite existia, legítimo.
- Verandi: sessão reativava conta suspensa e se dava papel `suporte`
  (gatilhos da `0083`); páginas de `/admin` passam a conferir `ehSuporte` cada
  uma; API v1 com limite de pedidos (`app_verandi.consumir_limite`);
  `reposicaoDeId` conferido por conta.
- AutoFluxos: `/api/simular` mandava credencial de integração para URL do
  corpo com qualquer membro (agora exige `configurar_operacao`); canais
  WhatsApp/Instagram e `whatsapp/concluir` exigem `configurar_operacao`;
  resolver/reabrir atividade conferem o dono; atribuir cartão confere a equipe.

**Ficou para corrigir, com teste** (não foi feito por mexer em regra que a
MGM usa todo dia):

- **AutoFluxos, Atendente vê conversa de colega.** `acaoAtribuirPara`
  (`acoes.ts:3241`), `acaoAtribuirContato` (`acoes-crm.ts:532`) e
  `acaoLiberarAtendimento` (`acoes.ts:3207`) aceitam qualquer contato com
  escopo `proprios`; `acaoAbrirPainelDoContato` (`acoes-crm.ts:344`) e
  `acaoLerAtividades` (`acoes-atividades.ts:313`) leem qualquer contato;
  `acaoBuscarNasMensagens` (`acoes-busca.ts:13`) devolve ids da conta inteira.
  As rotas `inbox/conversa`, `midia` e `aberta` já usam `acharLead(..., alcance)`:
  aplicar o mesmo nas ações. Decidir antes com o Gabriel se "atendente vê só os
  próprios" é regra (o comentário de `distribuir-atendimento.ts` diz o
  contrário).
- **Verandi, papel só no código para financeiro, recibo, plano e contrato.**
  As políticas dessas tabelas aceitam qualquer membro; quem restringe é
  `exigirCaixa`/`exigirDono`/`exigirOperacional`, e a profissional contornaria
  pela API. Não dá para fechar só no banco: `agenda/avulsa.ts`,
  `financeiro/materializar.ts` (roda ao abrir a agenda) e
  `licencas/prorrogacao.ts` gravam `contrato`/`cobranca` com a sessão de
  qualquer papel. Primeiro mover essas gravações para o servidor
  (`clienteAdmin` depois de conferir), depois trocar as políticas para
  `tem_papel(...)`.
- Suspeitos: SSRF do webhook de saída da Verandi por DNS que resolve para IP
  interno (`core/webhook/endereco.ts` confere só o texto); `aceitarConvite`
  tenta senha a partir do IP do servidor, então o limite do Auth não pega o
  atacante; o segredo do webhook da Brevo viaja na query string.
