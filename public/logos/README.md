# Logos de cliente, servidos publicamente

Existem por um motivo só: **o `=IMAGE()` do Google Sheets precisa de uma URL
pública.** Não há como pôr uma imagem dentro de uma célula por upload — a API do
Sheets nem enxerga imagem flutuante, que é como o cliente costuma colar o logo
dele (e é por isso que cada aba fica com um tamanho diferente).

Com o logo numa célula de tamanho fixo, ele fica **idêntico ao pixel em todas as
abas**, e trocá-lo depois é trocar um arquivo — não recolar seis imagens à mão.

Só entra aqui logo que já é público (o que está no site e na fachada do
cliente). Nada de documento, foto de pessoa ou material interno.

## `marcas/`: logos de terceiros, oficiais

Baixadas em 23/out/2026 da fonte oficial de cada empresa, sem redesenho; o
uso é nominativo (identificar a integração). `components/design/logos-de-marca.tsx`
as mostra em fundo branco nos dois temas.

| Arquivo | Fonte |
|---|---|
| `mercadopago.svg` | cabeçalho de mercadopago.com.br (`logo-v3-collapsed.svg`) |
| `asaas.png` | asaas.com, `apple-touch-icon.png` |
| `infinitepay.svg` | infinitepay.io, `logo_brlc_preto.svg`, recortado no símbolo |
| `pagbank.png` | github.com/pagseguro (perfil oficial) |
| `woovi.png` | woovi.com, `favicon.ico` (480px) |
| `paghiper.png` | paghiper.com, `favicon.png` |
| `efi.svg` | sejaefi.com.br, `logo-efi-bank-orange.svg`, recortado sem o "BANK" |
| `iugu.svg` | iugu.com, `favicon.svg` |
| `pagarme.png` | github.com/pagarme (perfil oficial) |

WhatsApp, Instagram, Meta, Telegram e Stripe não estão aqui: são desenhos
vetoriais do Simple Icons em `components/design/glifos-oficiais.ts`.
Para trocar uma logo, baixe de novo da mesma fonte; não redesenhe.
