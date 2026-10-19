# Handoff 19/out/2026: revisão de segurança autorizada (AutoFluxos e Verandi)

**Contexto e autorização.** AutoFluxos e Verandi são produtos da 4YU, do
Gabriel Barbosa, dono dos repositórios (`gabrielfeelix/autofluxos`,
`gabrielfeelix/verandi`), dos domínios (`*.4yu.com.br`) e do projeto Supabase
(`xxxynoshwirupkdzwxbj`). Ele autoriza e pede esta revisão **defensiva** dos
próprios sistemas, para achar e corrigir falhas antes que alguém as explore.
Nada aqui é contra sistema de terceiros.

Gabriel não é dev: quer decisão tomada e implementada, resposta curta em
pt-BR, sem travessão em texto nenhum.

## Leia antes

1. `4yu-apps/CLAUDE.md`: segredos (`.secrets/4yu.env`), IDs, banco
   compartilhado entre os dois produtos.
2. `autofluxos/docs/BANCO-COMPARTILHADO.md` e `verandi/docs/BANCO-COMPARTILHADO.md`
   (regras no topo; o fim registra cada mudança de 19/out com números).
3. `autofluxos/docs/INCIDENTE-LGPD.md`: se algo expuser dado pessoal, é
   incidente, e o roteiro vale.

**Atenção ao commitar no AutoFluxos:** outra sessão tem alterações de e-mail
sem commit (`src/core/email/modelos.ts`, `src/server/avisos-por-email.ts` e
outras) e `tsconfig.json` modificado. Adicione só os seus arquivos, pelo nome.

## O que foi feito em 19/out (não refaça)

Banco (Supabase Pro desde 19/out):

- Funções `security definer` fechadas para `anon` (`0136`, `0078_vr`).
- Políticas da Verandi uma por ação, `(select auth.uid())` (`0080_vr`).
- Índice em toda chave estrangeira, 7 índices repetidos apagados (`0137`,
  `0138`, `0079_vr`, `0081_vr`); índices do sino da Verandi (`0082_vr`).
- Auth: proteção de senha vazada (HIBP) ligada; conexões em percentual.
- **SSL obrigatório** no banco. O SQL direto do AutoFluxos usa TLS com o
  certificado conferido contra a raiz do Supabase
  (`src/server/conexao-do-banco.ts`). Ligar ou desligar o SSL **reinicia o
  Postgres** (cerca de 1 min e meio fora, nos dois produtos).
- Backup: 8 diários conferidos; sem PITR por decisão do Gabriel.

Aplicação:

- Next 16.4.2, `sharp` 0.35.5, `npm audit` zerado; Dependabot ligado nos dois.
- Cabeçalhos nos dois: HSTS, `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `nosniff`, Referrer-Policy,
  Permissions-Policy (câmera só na Verandi, para a foto da avaliação).
- Mídia nova do acervo com cache de um ano; leituras por coluna em vez de
  `to_jsonb(linha)`.

Revisão de autorização no código (~310 ações e 47 rotas no AutoFluxos; 111
ações, 11 rotas e 6 páginas de admin na Verandi). Nenhum vazamento entre
organizações. Corrigido:

- **Verandi, crítico:** convite do tipo `senha` gravado pela API trocava a
  senha de qualquer pessoa. Fechado no aceite e no banco (`0083_vr`). Sem uso
  encontrado. Testes de regressão em `verandi/tests/usuarios.test.ts`.
- Verandi: sessão não reativa conta suspensa nem se dá papel `suporte`
  (`0083_vr`); cada página de `/admin` confere `exigirSuporte`; API v1 com
  limite de pedidos (300/min por chave, 30/min sem chave válida); falta
  reposta conferida por conta.
- AutoFluxos (`26e07264`): `/api/simular` exige `configurar_operacao`
  (mandava credencial de integração para a URL do corpo); canais
  WhatsApp/Instagram e `whatsapp/concluir` exigem `configurar_operacao`;
  resolver/reabrir atividade conferem o dono; atribuir cartão confere a equipe.

## Parte 1: correções de código que ficaram (fazer primeiro)

Trabalho normal de desenvolvimento, com teste.

1. **AutoFluxos: alcance do Atendente nas ações de conversa.** As rotas
   `inbox/conversa`, `midia` e `aberta` filtram por `acharLead(..., alcance)`;
   estas ações não: `acaoAtribuirPara` e `acaoLiberarAtendimento`
   (`src/server/acoes.ts`), `acaoAtribuirContato` e `acaoAbrirPainelDoContato`
   (`src/server/acoes-crm.ts`), `acaoLerAtividades`
   (`src/server/acoes-atividades.ts`), `acaoBuscarNasMensagens`
   (`src/server/acoes-busca.ts`). Com escopo `proprios`, aplicar o mesmo
   filtro. **Antes, perguntar ao Gabriel** em uma linha: atendente vê só as
   próprias conversas, ou a equipe vê tudo? (`src/server/distribuir-atendimento.ts`
   diz "todo mundo vê tudo"; as rotas dizem o contrário.)
2. **Verandi: papel no banco para financeiro, recibo, plano e contrato.** As
   políticas aceitam qualquer membro da conta; quem restringe por papel é o
   código (`exigirCaixa`, `exigirDono`, `exigirOperacional`). Antes de fechar
   no banco, mover para o servidor (`clienteAdmin` depois de conferir conta e
   papel) as gravações que usam a sessão de qualquer papel:
   `src/server/agenda/avulsa.ts`, `src/server/financeiro/materializar.ts`
   (roda ao abrir a agenda) e `src/server/licencas/prorrogacao.ts`. Depois,
   migration trocando a escrita para `tem_papel(conta_id, ...)`.
3. **Menores:** webhook de saída da Verandi (`src/core/webhook/endereco.ts`)
   confere só o texto do host, não o IP para onde o nome resolve;
   `aceitarConvite` confere senha a partir do servidor, então o limite do Auth
   não conta por quem tenta; o segredo do webhook da Brevo vai na query string.

## Parte 2: verificação externa (depois da Parte 1)

Conferir de fora, sempre nos nossos domínios. **Produção tem cliente pagante
(MGM nos dois produtos):** em produção, só leitura passiva; o que enviar
formulário ou gravar dado roda no ambiente local. Um processo pesado por vez
na WSL (dois juntos derrubam a máquina).

- Produção, só leitura: OWASP ZAP no modo baseline (passivo) em
  `autofluxos.4yu.com.br` e `verandi.4yu.com.br`, um de cada vez; `testssl.sh`;
  cabeçalhos em todas as rotas, inclusive `/api/*`; se `/.env`,
  `/.git/config` ou source map de produção ficam acessíveis; o que
  `/api-docs` da Verandi mostra sem login.
- Local, com duas organizações de teste (telefone de teste é DDD 44):
  uma não lê nem grava dado da outra pelas ações e rotas; webhook sem
  assinatura válida recebe 401; upload recusa tipo e tamanho fora do
  permitido; a IA do AutoFluxos não grava nada sem a confirmação
  (`src/server/ia/politica.ts`).

## Como o ambiente local foi montado em 19/out

Um stack só, o da Verandi (portas `5642x`), para não pesar a WSL:

```bash
cd verandi && npx supabase db reset --local   # replay da Verandi, só no Docker
cd ../autofluxos && for f in supabase/migrations/*.sql; do
  docker exec -i supabase_db_verandi psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$f"
done
```

Testes de banco da Verandi: `node_modules/.bin/vitest run tests/<arquivo>`
com o CLI do Supabase no `PATH` (ele lê as chaves por `supabase status`).
Nunca a suíte inteira de uma vez.

## Armadilhas aprendidas

- O classificador do Claude Code barra escrita em produção mesmo com o
  "autorizo" no chat: peça ao Gabriel para aprovar o aviso.
- `POST .../database/backups/restore` e `restore-pitr` restauram **por cima**
  da produção, nos dois produtos. Nunca usar.
- `GET .../postgrest` da Management API devolve o segredo JWT antigo em texto
  puro. Não imprima a resposta inteira.
- Reiniciar o banco zera o `pg_stat_statements`.
- Default de privilégio por schema não tira o `EXECUTE` de `PUBLIC`: toda
  função nova escreve `revoke all on function ... from public, anon, authenticated`.

## Pendências do Gabriel (`4yu-apps/PENDENCIAS-DO-GABRIEL.md`)

- Verificação em duas etapas: Supabase está **sem**; conferir Vercel, Google,
  Meta, Hostinger.
- Troca do segredo JWT antigo (HS256): adiada por decisão dele.

## Fora do escopo, já decidido

PITR, compute maior, teste de restauração em projeto novo, backup do Storage
em outro provedor, CSP completa com nonce.
