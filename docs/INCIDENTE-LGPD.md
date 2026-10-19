# Incidente com dado pessoal: o que fazer, em ordem

Vale para AutoFluxos e Verandi, que dividem o mesmo banco e o mesmo Storage:
um incidente num produto quase sempre precisa ser avaliado nos dois.

Incidente é qualquer acesso, vazamento, perda ou alteração de dado pessoal sem
autorização: chave vazada, bucket aberto por engano, conta de cliente acessada
por outra pessoa, banco apagado, mensagem enviada para o contato errado em
massa.

## 1. Conter, na primeira hora

Fechar a porta vem antes de entender o que passou por ela.

- **Chave vazada:** revogar primeiro (ver `4yu-apps/CLAUDE.md`, seção "Se uma
  chave vazar"). Supabase: painel → Project Settings → API Keys. Meta: app →
  Configurações → Básico → redefinir a chave secreta. Vercel e GitHub: tokens
  nas configurações da conta.
- **Bucket ou tabela aberta:** fechar a permissão (política, `grant`,
  bucket público → privado) antes de qualquer outra coisa.
- **Conta de cliente acessada por terceiro:** encerrar as sessões dela e
  trocar a senha.

## 2. Guardar a evidência

Antes de apagar qualquer coisa, anotar num documento com data e hora:

- quando foi percebido e por quem (o prazo conta daqui);
- logs da Vercel e do Supabase do período (a retenção é curta: Supabase 7
  dias no Pro, Vercel menos), exportando o que interessar;
- o que foi exposto: quais tabelas, buckets, quais clientes, quantas pessoas.

## 3. Avaliar se precisa comunicar

Pela **Resolução CD/ANPD nº 15/2024**, a comunicação é obrigatória quando o
incidente pode causar **risco ou dano relevante**, o que se presume com pelo
menos um agravante: **dado sensível** (saúde, biometria, religião...), **dado
financeiro**, **dado de criança ou adolescente**, **credencial** (senha,
token), ou **larga escala**. Fonte oficial:
https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca

O que guardamos e pesa aqui: mídia recebida no WhatsApp (pode ter RG,
comprovante, exame), CPF e ficha de avaliação física na Verandi (dado de
saúde), telefones e conversas.

## 4. Comunicar: quem fala com quem

Nos dois produtos o **cliente** (o estúdio, a loja) é o controlador dos dados
dos alunos e contatos dele, e a 4YU é a operadora. A operadora avisa o
controlador **sem demora**, com o que se sabe; quem comunica a ANPD e as
pessoas afetadas é o controlador, e a 4YU ajuda com os fatos. Para dado das
próprias contas da 4YU (quem usa o painel), a 4YU é controladora e comunica
direto.

Prazo para comunicar a ANPD e os titulares: **3 dias úteis** a partir de
quando se soube que o incidente envolve dado pessoal. Com a dúvida sobre se é
caso de comunicar, conversar com advogado dentro desse prazo, não depois.

A comunicação diz: o que aconteceu, que dados e de quantas pessoas, o que já
foi feito para conter, o risco para as pessoas e o que elas podem fazer.

## 5. Depois

- Registrar o incidente mesmo que não precise comunicar: a resolução exige
  guardar o registro por 5 anos.
- Uma linha em `docs/DECISIONS.md` com a causa e o que mudou para não repetir.
