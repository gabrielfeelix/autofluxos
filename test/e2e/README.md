# A jornada pelo navegador

Estes testes sobem o painel de verdade (`next dev` na porta 3100) contra o
**Postgres local em Docker**, e percorrem a tela como uma pessoa percorre.

```bash
npx supabase start          # o banco que eles usam
npm run test:e2e:local
```

## Por que eles não rodam no CI

O `.github/workflows/ci.yml` não recebe a chave secreta do Supabase, e a decisão
está escrita lá: este repositório é público, e um workflow de um PR de fora
leria o segredo. Sem banco, não há jornada para percorrer. Eles rodam na
máquina, antes do push, como os de integração.

## O que eles provam, e o que não

Provam o que módulo puro não alcança: teclado, foco, `Esc` num `<dialog>`,
clique no fundo, e a tela reagindo ao que o servidor respondeu de verdade.

Não substituem os testes de integração: aqueles conferem regra de negócio
contra o banco, com fixture montado à mão, e são muito mais rápidos. Quando a
pergunta é "a regra está certa", o teste é lá.

## O guarda

O `playwright.config.ts` lê o `.env.teste-local` e **nunca** o `.env`, e passa o
ambiente pelo mesmo `conferirAmbienteLocal` dos testes de integração: endereço
remoto é recusado mesmo com o consentimento preenchido. AutoFluxos e Verandi
dividem o projeto de produção, e um e2e que criasse conta lá mexeria no banco
que atende cliente de verdade.

## O limite de tentativas, e por que a conta é criada uma vez só

`acaoCriarPrimeiroAdministrador` passa por `consumirLimite`, com teto de **5
tentativas em 5 minutos por IP** (`src/server/limite.ts`). Todos os testes saem
do mesmo IP, então cadastrar uma conta por teste faz o terceiro ou quarto
receber "Muitas tentativas" e falhar por uma proteção que está funcionando.

Por isso o `beforeAll` cadastra **uma** conta e os testes reusam a sessão por
`storageState`. Isso também é mais fiel ao uso real: a pessoa cadastra uma vez e
depois trabalha na conta dela.

**Se você rodar a suíte várias vezes seguidas** enquanto desenvolve, vai bater no
limite mesmo assim: cada rodada gasta uma tentativa. Espere os 5 minutos. O
sintoma engana, porque o teste falha adiante com 404 ou com um seletor que não
aparece, e a mensagem do limite fica na tela anterior.
