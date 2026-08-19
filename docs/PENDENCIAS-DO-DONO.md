# Pendências do dono

O que **só você** consegue fazer. Nada aqui está esperando código: ou depende
de uma credencial que só você cria, ou de uma decisão que envolve o outro
produto, ou de uma conta que é de uma pessoa de verdade.

Junte tudo e faça de uma vez ao fim das rodadas. Cada item diz o que trava
enquanto não for feito.

Atualizado em 19/ago/2026, com a Etapa A e a Etapa B inteiras no ar — agora
**sem recorte**: compartilhar fluxo por link e sequências entraram. As
migrations `0023` a `0029` foram aplicadas em produção com autorização; a `0030`
e a `0031` esperam a sua.

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

## 3. `ALERTA_WEBHOOK_URL` — a única variável que falta

**Trava:** `alertar()` é no-op. Falha no processamento do webhook, recusa da
Cloud API e cofre que não devolve credencial **não avisam ninguém**.

Crie um webhook de canal no Discord ou no Slack, guarde o valor em
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

## 3.2 As migrations `0030` a `0033` — ✅ **aplicadas**

Compartilhar fluxo por link (`0030`), sequências (`0031`) e quadros (`0032`,
`0033`) estão em produção, com a conferência do §9.3 feita: RLS ligada em tudo,
nenhum `grant` para `anon`/`authenticated` nas tabelas novas, nenhuma política em
`public`, e `app_verandi` com as mesmas **40 tabelas**.

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

## 6. Aposentar a senha única — depois do item 1

**Trava:** enquanto ela existir, o administrador da 4YU alcança qualquer conta
sem impersonar, e portanto sem rastro na auditoria.

Quando você quiser fechar: uma linha em `exigirAcessoAoCliente` (parar de deixar
o administrador passar sem ser membro) e remover `PAINEL_SENHA` da Vercel. É
trabalho nosso — o que depende de você é decidir a hora, e ter o item 1 feito.

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
