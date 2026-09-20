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
