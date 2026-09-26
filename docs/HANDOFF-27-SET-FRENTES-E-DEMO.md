# Handoff: frentes e demonstração (fim de 26/set, para 27/set)

> Para o próximo agente. Continua `docs/HANDOFF-26-SET-NICHOS.md` (o plano
> das frentes, seção 4) e `docs/DEMO.md` (a demonstração, com ids, simulador
> e como voltar atrás). Leia os dois depois deste.
> Sempre `git fetch` e `git pull --rebase` antes: há outras sessões no repo.

## 1. Onde paramos, em uma frase

As quatro frentes (aulas, loja virtual, restaurante, comércio) existem no
produto e as contas pagantes já estão nelas; a demonstração roda num número
próprio com seis ramos, botões e IA, fotos geradas por IA e cardápios em PDF
desenhados. O que falta é polir a experiência da demo e as pendências abaixo.

## 2. O que ficou pronto (tudo em `main`, no ar)

### Frentes (tipo de negócio)

| O quê | Onde |
|---|---|
| Pacote por frente: nomes da barra, o que some, modelos, funil, ficha, passos do Início | `src/core/nichos.ts` (única fonte; teste recusa `if (nicho === ...)` fora dele) |
| Aulas: Alunos, Matrículas, seção **Planos** (Planos e modalidades) | pacote `aulas` |
| Galeria de fluxos e funis: conta com frente vê só os dela e os de qualquer negócio | `separarPeloRamo` |
| Ficha do assistente (perguntas do ramo, placar, Testar), gravando no mesmo `contexto_negocio` em blocos `== TÍTULO ==` | `src/core/ficha-do-assistente.ts`, `ajustes/contexto` |
| Trocar o tipo de negócio, com auditoria; admin mostra a frente | `ajustes/recursos`, `acaoDefinirNicho` |
| Onboarding pergunta a frente e cria bot e funil dela | `core/onboarding.ts`, `components/onboarding/assistente.tsx` |
| Primeiros passos do Início por frente | `app/clientes/[clienteId]/page.tsx` |
| Tabela tela a tela e pesquisa da troca de frente (RD Station) | `docs/NICHOS-REVISAO-POR-TELA.md`, `docs/NICHOS-TROCA-DE-FRENTE.md` |

Migrations `0108` e `0109` aplicadas na produção em 26/set, com autorização,
pela Management API (registro em `docs/BANCO-COMPARTILHADO.md`).

**Contas nas frentes (produção, com auditoria):** MGM Pilates, Academia de
Boxe e Estúdio de exemplo em `aulas`; PCYES em `ecommerce`. 4YU, Vitória
Guedes e Cliente 00 sem frente. O Gabriel autorizou a MGM explicitamente;
os fluxos, a integração e o texto da IA dela não mudaram.

### Demonstração

- Conta **4YU Tech Demonstração** `3a1d5ac8-369c-4373-856a-495468e7bad4`, sem
  frente, com o canal do número +55 44 7400-7438 (movido da PCYES).
- Seis ramos com botões e com IA, carrinho, resumo, acompanhamento e aviso de
  pronto; loja online com os produtos reais da PCYES (Magento); "inicio"
  recomeça de qualquer ponto; "quero isso no meu negócio" vira lead.
- **Fotos:** 58 fotos geradas por IA pelo Gabriel (prompts em
  `docs/demo/PROMPTS-DAS-FOTOS.md`), no acervo com os nomes `demo-*.jpg`. O
  zip `fotos-demo-4yu.zip` está na raiz, fora do git (excluído só na máquina
  do Gabriel, em `.git/info/exclude`): **não commite**, o repositório é público.
- **Cardápios:** seis PDFs desenhados, um por ramo, com a foto de cada item,
  gerados por `scripts/demo/cardapios.mjs` (a primeira página vira o PNG que o
  bot manda antes do PDF). Mesmos nomes `demo-cardapio-<ramo>.pdf/png`.
- QR em `docs/demo/qr-pizzaria.png` e `docs/demo/qr-demo.png`.
- Testada por 4 agentes no simulador (comprador, indeciso, IA e olhar de
  dono); o que acharam foi corrigido e publicado.

## 3. Vitrine da IA com foto e botão (feita no fim de 26/set)

O Gabriel mandou print: no modo IA da hamburgueria, a lista de hambúrgueres
saiu em texto corrido. Agora sai frase curta, **uma mensagem por produto**
(foto, nome, descrição, preço e botão "Pedir", ou "Agendar" em serviços), e a
pergunta final só depois das fotos. O toque volta para a IA como "Quero
pedir: <nome>". Mudança no motor, só para produto **sem link** e só no
WhatsApp: a PCYES (produto com link) continua com "Ver na loja", com teste.
Testado no simulador na hamburgueria e no salão; ninguém tocou o botão no
WhatsApp de verdade ainda.

Ficou de fora, e é o próximo passo natural:
- até **3 fotos por vez** (subir o limite mudaria a ferramenta da PCYES);
- aulas dizem "Agendar", e não "Quero este plano";
- a pergunta final é texto, sem botões das outras partes do cardápio;
- no salão a IA ainda repete uma listinha de texto antes das fotos (ajuste de
  instrução nos blocos de IA, em `scripts/demo/fluxos.mts`).

## 4. O que falta, em ordem

1. **Experiência da demo, pelo olhar de quem recebe** (pedido do Gabriel,
   com ênfase): catálogo, imagem, ações, nunca parágrafo. Revisar cada
   resposta da IA e de cada fluxo perguntando "isso é bonito e fácil no
   celular?". Testar com agentes (Haiku serve) no simulador, economizando a
   cota da IA.
2. **"inicio" quando a conversa já está com uma pessoa.** Precisa de coluna
   nova (migration): o Gabriel ainda não respondeu. Hoje o bot volta sozinho
   em 5 minutos.
3. **Cota da IA.** A chave grátis do Gemini acaba depois de algumas conversas
   seguidas, e ela é a mesma de todas as contas (MGM e PCYES atendem gente de
   verdade). Na Vercel existem `GEMINI_API_KEY` e `GROQ_API_KEY`. Criar
   chaves grátis de Cerebras, Cloudflare e Mistral (a cadeia já as usa, ver
   `src/server/ia/`) é tarefa do Gabriel; o agente só pede.
4. **Teste do celular** pelo Gabriel (QR), e a troca de nome e foto do número
   no Business Manager (ele disse que já fez).
5. **Frentes, pendências menores** (lista em `docs/NICHOS-REVISAO-POR-TELA.md`,
   "O que ficou para as próximas etapas"): estado vazio de Contatos e do
   catálogo com a palavra da frente, título do negócio aberto
   ("Matrícula", "Pedido"), sugestões de respostas rápidas por frente,
   perguntas extras do onboarding (faz entrega? aceita reserva?).
6. **Troca de frente no topo, estilo RD** (4.4): pesquisa pronta, decisão do
   Gabriel pendente. Recomendação: seletor de módulos no topo e a troca de
   frente em Configurações.

## 5. Regras que já custaram caro

- **Sem travessão** em tela, comentário, commit e doc: use dois pontos.
- **Nada de `git stash`, `git reset` nem `git add -A`**: há outras sessões no
  mesmo diretório. `git add` por caminho.
- **Banco:** nunca `supabase db push`/`reset` contra produção. Migration pelo
  número do diretório, ensaio em transação, Management API, Verandi conferida
  antes e depois, registro em `docs/BANCO-COMPARTILHADO.md`, e **antes** do
  push do código que lê. Só com autorização explícita.
- **Motor:** mudança em `src/core/flow` ou `src/server` vale para todas as
  contas. Teste, e diga no commit o efeito na MGM e na PCYES.
- **MGM:** fluxos só por `publicar_fluxo`; nada de mudar integração.
- **Scratchpad compartilhado entre agentes:** use prefixo próprio nos nomes.
- Consulta à produção por script `.cjs` com `pg` ou heredoc; nunca imprimir
  segredo.
- Tela nova: abrir no navegador. O ambiente local sobe com
  `PORTA=3107 bash scripts/ux-local/dev.sh` e `scripts/ux-local/entrar.mjs`
  (Docker precisa estar ligado; o banco local pode estar atrás: aplicar as
  migrations que faltam só nele).
- Com o Gabriel: respostas curtas, sem jargão, conclusão primeiro.
