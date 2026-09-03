# Pendências do dono

O que **só você** consegue fazer. Nada aqui está esperando código: ou depende
de uma credencial que só você cria, ou de uma decisão que envolve o outro
produto, ou de uma conta que é de uma pessoa de verdade.

Junte tudo e faça de uma vez ao fim das rodadas. Cada item diz o que trava
enquanto não for feito.

Atualizado em **03/set/2026**. As migrations `0023` a `0038` estão aplicadas em
produção — conferido objeto a objeto no banco nesta data, e não pela leitura de
um plano. As `0039` (alertas) e `0040` (canal do Instagram) estão escritas no
repositório e **ainda não aplicadas**: são o item 5 abaixo.

---

## 1. O primeiro administrador — ✅ **feito**

`gab.feelix@gmail.com` existe em `af_usuarios` com `role = 'admin'`, conferido
em produção em 19/ago/2026. A tela de primeiro acesso está fechada para sempre.

Fica registrado aqui porque a distinção que ela cria continua valendo, e não é
óbvia: **`owner` não é o mesmo que `admin`.**

| Papel | Onde mora | O que abre |
|---|---|---|
| `admin` | `af_usuarios.role` — plataforma | `/admin/*`, "entrar como", auditoria |
| `owner` | `af_membros."role"` — **dentro de uma conta** | tudo naquela conta, inclusive equipe |

Ser dono de três contas não dá acesso à área de administração da 4YU, e ser
administrador da plataforma não faz de ninguém membro de conta nenhuma — é por
isso que `exigirAcessoAoCliente` trata os dois casos em linhas separadas. Hoje
você tem os dois, então na prática alcança tudo.

## 2. Dar dono a cada cliente — ✅ **feito para os três de hoje**

`MGM Pilates`, `Estúdio de exemplo` e `Cliente 00 — Gabriel` têm `owner`.

Continua valendo para **cliente novo**: em `/admin/usuarios` → `+ Cadastrar
pessoa` (a senha é combinada por fora), e depois `/admin/contas` → `+ Ligar
pessoa` como **dono da conta**. Cliente sem membro aparece no topo da lista.

## 3. `ALERTA_WEBHOOK_URL` — ✅ **deixou de ser bloqueio**

**Trava:** nenhuma. Era o item mais perigoso desta lista e virou conveniência.

O problema não era a variável faltar — era o aviso de falha ter **uma cópia
só**, pendurada numa credencial que só você conseguia criar. Enquanto ela não
existisse, falha no webhook do WhatsApp, recusa da Cloud API e cofre que não
devolve credencial não avisavam ninguém, e a primeira notícia de qualquer
problema vinha do cliente.

Desde o commit `2879428`, todo alerta é gravado em `public.alertas` e aparece
em **`/admin/alertas`**, sem configurar nada. Retenção de 90 dias, na mesma
passada da limpeza que já existia.

Continua valendo **se você quiser ser avisado sem abrir o painel**: crie um
webhook de canal no Discord ou no Slack, guarde o valor em
`4yu-apps/.secrets/4yu.env` como `AUTOFLUXOS_ALERTA_WEBHOOK_URL` e adicione a
variável na Vercel. Nunca dentro do repositório — ele é público.

## 3.1 Dar resolução ao agendador — opcional, e barato

**Trava:** nada agora, mas o prazo de pergunta chega atrasado numa conta parada.

A Vercel **no plano Hobby dispara cron uma vez por dia**. O agendador contorna
isso pegando carona no webhook — a conta que tem prazo vencendo é a que está
recebendo mensagem —, e o cron diário é só o piso. Funciona.

Se quiser precisão de verdade (e a Transmissão, na Etapa C, vai querer), há dois
caminhos e os dois são seus:

1. **Subir para o plano Pro** da Vercel e trocar o `schedule` de
   `/api/manutencao/tarefas` para `*/5 * * * *` em `vercel.json`;
2. **Apontar um disparador externo** (cron-job.org, GitHub Actions) para
   `https://autofluxos.4yu.com.br/api/manutencao/tarefas` mandando
   `Authorization: Bearer <CRON_SECRET>`. Custa zero e não muda código nenhum.

## 3.2 As migrations `0030` a `0038` — ✅ **aplicadas**

Compartilhar fluxo por link (`0030`), sequências (`0031`), quadros (`0032`,
`0033`), o gatilho de sequência por etapa (`0034`), o `restrict` que travava
apagar cliente (`0035`), `flows.ativo` (`0036`), `flows.canal` (`0037`) e a
política de IA com o log de chamadas (`0038`) estão todas em produção.

Conferido em 03/set/2026 direto no banco pela Management API — as nove tabelas,
as três colunas, os seis constraints e a função `mover_cartao`, uma a uma. A
versão anterior deste documento dizia que `0030` e `0031` ainda esperavam
autorização, e isso estava errado havia semanas: **documento não é fonte de
verdade sobre o estado do banco, o banco é.**

## 3.3 O relógio do WSL2 — o que faz a suíte falhar sem motivo

**Trava:** nada em produção; atrapalha quem roda `npm test` na sua máquina.

Cerca de uma execução em oito falhava um arquivo inteiro com "não deu para criar
o cliente: **JWT issued at future**". A causa foi encontrada: depois que a
máquina suspende, o relógio do WSL2 fica adiantado em relação ao servidor, e o
`iat` da chave de serviço nasce no futuro. Não é o teto de tempo do Vitest nem
colisão de telefone, que eram as hipóteses antigas.

`sudo hwclock -s` ressincroniza. É da máquina, não do repositório — por isso
está aqui.

## 4. SMTP — decisão que envolve a Verandi

**Trava:** convite por e-mail e recuperação de senha. A tabela `af_convites`
existe e nada a preenche; hoje toda senha é combinada fora do sistema.

SMTP é **global ao projeto Supabase**, compartilhado com a Verandi. Ligar afeta
os dois produtos, então é decisão sua, não do código. Ver
[BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md).

## 5. Provar a mídia no WhatsApp de verdade

**Trava:** nada, mas é um risco aberto — e maior a cada frente: a A6 deu ao
número um papel dedicado a mídia, e agora o bloco aceita o arquivo arrastado,
que sobe para o Storage e vira URL pública. O caminho é testado ponta a ponta
com o canal mock, e **nenhuma foto saiu pela Cloud API de verdade**.

São cinco minutos com o Cliente 00: um fluxo com bloco de arquivo, arrastar uma
imagem, publicar, mandar uma mensagem, e conferir se a foto chega.

## 6. A senha única — ✅ **aposentada**

`/login`, `PAINEL_SENHA`, `PAINEL_SEGREDO` e o cookie do painel saíram.
`/entrar` é a porta, e é a única.

**As duas variáveis podem sair da Vercel** — nada as lê. Deixá-las não quebra
nada; é limpeza.

**O que sobrou, e é decisão sua:** o administrador da plataforma ainda alcança
qualquer conta **sem ser membro dela**, em `exigirAcessoAoCliente`. É a última
forma de abrir a conta de um cliente sem deixar rastro na auditoria. A saída é
"entrar como", que registra.

Fechar é uma linha. O que ela custa: no dia em que fechar, você precisa ser
membro de toda conta que quiser abrir direto — inclusive as que criar depois.
Hoje você é `owner` das três, então fechar agora não te tira de lugar nenhum; o
cuidado é com cliente novo.

## 5.1 As migrations `0039` e `0040` — escritas, **não aplicadas**

**Trava:** a tela `/admin/alertas` responde erro (a tabela não existe) e 25
testes de repositório falham. O resto do produto está de pé — nenhuma das duas
mexe em nada que já roda.

- **`0039_alertas.sql`** cria `public.alertas`. É o que faz o item 3 acima
  deixar de ser bloqueio.
- **`0040_canal_instagram.sql`** acrescenta `ig_user_id`, `token_ref`,
  `token_expira_em` e `ig_username` em `channels`, deixa `phone_number_id`
  aceitar nulo e cria o gatilho que apaga o token do Vault junto com a linha.

As duas são aditivas: nenhuma apaga dado, nenhuma altera coluna existente além
de afrouxar um `not null`, e o `check` novo foi conferido contra as 4 linhas
que existem hoje (todas `cloud-api` com número). Nada encosta em `app_verandi`.

**Por que não foram aplicadas:** o classificador de permissões desta sessão
recusou o `POST` de DDL na Management API do Supabase, duas vezes. Não é falta
de credencial nem de autorização sua — é a proteção do próprio agente contra
alteração de esquema em produção sem confirmação interativa.

Para aplicar, com o cofre carregado:

```bash
set -a && . /home/gabrielbarbosa/dev/gabriel/4yu-apps/.secrets/4yu.env && set +a
for f in supabase/migrations/0039_alertas.sql supabase/migrations/0040_canal_instagram.sql; do
  python3 -c "import json,sys;print(json.dumps({'query':open(sys.argv[1]).read()}))" "$f" \
    | curl -s -X POST "https://api.supabase.com/v1/projects/xxxynoshwirupkdzwxbj/database/query" \
        -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
        -H "Content-Type: application/json" --data-binary @-
  echo
done
```

Depois, `npm test` volta a passar inteiro.

## 7. Modelos de mensagem aprovados pela Meta

**Trava:** a janela de 24 horas dentro do bloco de mensagem (`Dentro de` /
`Fora de`, do desenho da A3) ficou de fora, e vai ficar até isto existir. Fora
da janela, o WhatsApp só aceita **modelo aprovado** — sem eles, o interruptor
não teria o que fazer além de mentir. Trava também a Transmissão inteira.

**E agora trava o alcance das sequências.** Cada passo tem teto de 24h, e o teto
não é escolha nossa: quem responde sai da sequência, então a última mensagem da
pessoa é sempre anterior ao evento que a inscreveu — o relógio da janela já está
correndo quando o acompanhamento começa. Com modelos aprovados, o teto sobe e
"3 dias depois" passa a existir. Sem eles, um passo mais longo seria desenhado e
nunca entregue, e a tela diz isso em vez de deixar a pessoa descobrir sozinha.

Depende de verificação da empresa e App Review na Meta. Não é código nosso que
destrava.

## 8. `BETTER_AUTH_URL` — opcional, e talvez nunca

Sem ela a origem sai da requisição, o que basta para e-mail e senha na mesma
origem; o custo é um aviso a cada `next dev`. Preenchida errado, quebra o login
inteiro. Só mexa se aparecer problema de redirecionamento.

## 9. Os prints do painel do cliente

O painel "eu entro e vejo meus lucros" está em espera a seu pedido, aguardando
mais prints. Não temos dado de dinheiro, e inventar por multiplicação vira
mentira no relatório do cliente — o caminho honesto é ler valor fechado do CRM
na Etapa B.
