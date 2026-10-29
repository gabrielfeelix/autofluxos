# Handoff 29/out/2026: o chat do AutoFluxos no site do AutoFluxos

## O pedido do Gabriel

Usar o nosso próprio produto no nosso site: o balão de chat que já
oferecemos aos clientes (canal Site), configurado numa organização nossa
(**4YU Tech Demonstração**, `3a1d5ac8-369c-4373-856a-495468e7bad4`), e
embutido em `autofluxos.4yu.com.br`. Quem tira dúvida é atendido pela nossa
IA; o Gabriel assume no Inbox quando quiser. Mudar texto, fluxo ou IA é pelo
painel da organização, sem deploy.

## Já feito nesta data

`49e4abcd`: "Fale conosco" e "Testar grátis" do site abrem o WhatsApp da 4YU
(`WHATSAPP_DA_4YU`, `src/components/ajuda/moldura.tsx`) com a frase pronta.

## Passos

1. Ler como o canal Site funciona: `src/components/canais/configurar-chat-do-site.tsx`,
   `src/core/chat-do-site.ts`, o script em `public/chat/` e a rota
   `src/app/api/site/[chave]/route.ts`.
2. Criar o canal Site na 4YU Tech Demonstração e pegar o trecho de instalação.
3. Embutir o script em `src/app/(site)/pagina-do-site.tsx` (todas as páginas
   do site, não o painel). Conferir CSP em `next.config.ts`/`src/proxy.ts`.
4. **Base de conhecimento da IA**: montar a partir do que é verdade no repo,
   não de plano antigo. Fontes, nesta ordem: `docs/vantagens/VANTAGENS-AUTOFLUXOS.md`,
   `docs/FUNCIONALIDADES.md`, os artigos da Ajuda (`src/components/ajuda/`),
   preços e planos (`src/app/(site)/precos-pagina.tsx`, tabela de planos no
   banco). Ver como a IA da organização recebe conhecimento (Configurações da
   IA) antes de inventar formato.
5. Regras da IA: não prometer o que não existe, preço só da tabela vigente,
   passar para humano quando pedirem contrato, demonstração ou algo fora da base.
6. Texto que o visitante lê (saudação, menu) passa pelo ok do Gabriel antes
   de publicar.
7. Print em 1440 e 390 com o balão aberto.
