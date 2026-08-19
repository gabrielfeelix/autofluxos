# Pendências do dono

O que **só você** consegue fazer. Nada aqui está esperando código: ou depende
de uma credencial que só você cria, ou de uma decisão que envolve o outro
produto, ou de uma conta que é de uma pessoa de verdade.

Junte tudo e faça de uma vez ao fim das rodadas. Cada item diz o que trava
enquanto não for feito.

Atualizado em 18/ago/2026.

---

## 1. O primeiro administrador — destrava a A1 inteira

**Trava:** hoje não existe **nenhum** usuário. Todo o login por usuário está no
ar e dormindo; o painel segue funcionando pela senha única.

1. `https://autofluxos.4yu.com.br/login` — entre com a `PAINEL_SENHA`.
2. Vá para `/criar-conta`. Como não há ninguém, ela mostra **"Primeiro acesso"**.
3. Nome, e-mail e senha de **pelo menos 10 caracteres**. Quem sai daí é
   administrador da plataforma, e a tela se fecha sozinha para sempre.

Não fizemos por você porque a conta é sua, com o seu e-mail e a sua senha — e
nem uma coisa nem a outra se inventa.

## 2. Dar dono a cada cliente

**Trava:** nenhum cliente tem membro. Ninguém entra neles com login próprio.

Em `/admin/usuarios` → `+ Cadastrar pessoa` (a senha é combinada por fora), e
depois `/admin/contas` → `+ Ligar pessoa` como **dono da conta**. Cliente sem
membro aparece no topo da lista.

## 3. `ALERTA_WEBHOOK_URL` — a única variável que falta

**Trava:** `alertar()` é no-op. Falha no processamento do webhook, recusa da
Cloud API e cofre que não devolve credencial **não avisam ninguém**.

Crie um webhook de canal no Discord ou no Slack, guarde o valor em
`4yu-apps/.secrets/4yu.env` como `AUTOFLUXOS_ALERTA_WEBHOOK_URL` e adicione a
variável na Vercel. Nunca dentro do repositório — ele é público.

## 4. SMTP — decisão que envolve a Verandi

**Trava:** convite por e-mail e recuperação de senha. A tabela `af_convites`
existe e nada a preenche; hoje toda senha é combinada fora do sistema.

SMTP é **global ao projeto Supabase**, compartilhado com a Verandi. Ligar afeta
os dois produtos, então é decisão sua, não do código. Ver
[BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md).

## 5. Provar a mídia no WhatsApp de verdade

**Trava:** nada, mas é um risco aberto. O bloco de mídia é testado ponta a ponta
com o canal mock, e **nenhuma foto saiu pela Cloud API de verdade**.

São cinco minutos com o Cliente 00: um fluxo com bloco de imagem, uma mensagem,
e conferir se a foto chega.

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
