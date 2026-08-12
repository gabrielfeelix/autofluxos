# AutoFluxos

Automação de atendimento no WhatsApp. Você desenha o fluxo, o bot conduz a
conversa, o lead cai numa tela. IA é opcional.

Produto da [4YU](https://4yu.com.br).

## Estado

**Etapa 1 construída, os 7 passos.** Dá para desenhar o fluxo arrastando
blocos, testar a conversa ao lado, publicar (versão numerada e imutável), receber
mensagem pelo webhook e ver o lead cair na tela com o que o bot coletou. O que
falta não é código: a Meta precisa liberar a verificação do número, que é onde
estamos travados (ver ESTADO.md).

No ar em **https://autofluxos.4yu.com.br** (painel protegido por senha).

**Retomando o trabalho — humano ou agente?** Comece por
[docs/ESTADO.md](docs/ESTADO.md). A primeira seção diz exatamente o que fazer
em seguida, o que **não** perseguir, e as regras que não podem ser quebradas.

Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md) para o desenho completo e as
decisões por trás dele.

## Rodando

```bash
npm install
cp .env.example .env    # valores em 4yu-apps/.secrets/4yu.env (prefixo AUTOFLUXOS_)
npm run dev             # http://localhost:3000
npm test                # 168 testes
npm run typecheck
```

Não precisa de Docker. O banco é Supabase na nuvem (projeto `autofluxos`,
região São Paulo).

Sem `.env` os testes que falam com o banco se pulam sozinhos, e o resto roda
normal — dá para clonar e rodar `npm test` sem credencial nenhuma.

## Banco

Migrations em [supabase/migrations/](supabase/migrations/), aplicadas pela
Management API do Supabase.

`clients`, `flows` e `flow_versions` (passos 3 e 5); `channels`, `contacts`,
`sessions`, `messages` e `handoffs` (passo 6, criadas só quando já se sabia o
formato real do que o WhatsApp manda — tabela criada "por garantia" e nunca
usada só acumula divergência entre o desenho e o código).

A tela de leads lê a view `leads` (0004), que junta o contato com a última
mensagem e o handoff aberto. Ela é **`security_invoker = true`**: view é o jeito
clássico de furar RLS sem perceber, e sem isso a chave que vai para o navegador
leria a conversa de todo mundo.

**RLS está ligada e sem nenhuma política, de propósito.** A chave `publishable`
(que pode chegar ao navegador) não lê nem escreve nada; todo acesso passa pelo
servidor com a chave `secret`. Enquanto não existir login, esse é o estado
seguro. As políticas entram junto com o login, e não antes.

## O editor

Abra um cliente → um fluxo. A tela tem três partes: a barra de blocos à
esquerda, o desenho no meio, e à direita duas abas — **Bloco** (editar o que
está selecionado) e **Testar** (conversar com o fluxo).

Para ramificar, arraste a bolinha ao lado de uma opção até o bloco de destino.
**A setinha que você arrasta É a ramificação** — não existe tela de configurar
branch em lugar nenhum.

Salva sozinho depois de uma pausa na digitação. Rascunho pela metade pode ser
salvo; o que o validador barra é a publicação.

## Publicar

O rascunho é mutável e é o que você edita. **Publicar tira uma foto dele** e
guarda numa linha de `flow_versions` numerada que o banco se recusa a alterar —
não por convenção, por gatilho.

Por que isso importa: sem versão, você edita o fluxo às 15h e a conversa que
começou às 14h se vê num bloco que não existe mais. Quebra silenciosa, difícil de
reproduzir, e quem descobre é o cliente.

O botão só habilita se o validador deixar, mas **a checagem de verdade está no
servidor** (`publicar()` no repo). Botão desabilitado é conveniência; um fluxo
sem saída para humano tem que ser recusado venha a chamada de onde vier.

A aba **Testar** conversa com o fluxo **em memória**, então dá para experimentar
uma mudança antes de ela ser salva. Coisas que vale testar:

- escrever “quero falar com um atendente” a qualquer momento
- clicar no 🎤 para ver o que acontece quando a pessoa manda áudio
- responder “2” em vez de clicar no botão
- digitar besteira três vezes seguidas

## Integrar com o sistema do cliente

O bloco **API** chama um endereço durante a conversa, guarda pedaços da resposta
em variáveis e segue o fluxo. É um bloco só, e é de propósito: ele cobre planilha
do Sheets (via Apps Script publicado), qualquer webhook, e n8n/Make/Zapier — que
sozinhos carregam os milhares de apps que nunca vamos integrar na mão.

Ele nasce chamando o ViaCEP, então dá para arrastar o bloco e ver a integração
respondendo na aba Testar antes de configurar qualquer coisa.

Três coisas que o produto garante, e que não dependem de quem desenha lembrar:

- **A aba Testar chama de verdade.** É o mesmo código da produção. Os disparos
  vindos dali levam o cabeçalho `X-AutoFluxos-Teste: 1`, para o sistema do
  cliente separar teste de movimento real.
- **Endereço interno é recusado no servidor**, olhando o IP resolvido e não o
  nome, inclusive a cada redirecionamento. Um domínio público apontando para
  `127.0.0.1` é como esse ataque costuma ser escrito.
- **Falha não pendura ninguém.** Por padrão a conversa vai para uma pessoa com o
  motivo real; `continua mesmo assim` é escolha explícita, para enriquecimento
  que pode faltar sem prejuízo.

**Não há cofre de segredos ainda**, então token de CRM não tem onde morar com
segurança — para esses, o caminho é passar por um intermediário. O desenho está
em [docs/NO-API.md](docs/NO-API.md), incluindo por que a expansão para cofre é
aditiva.

## A regra que sustenta o projeto

`src/core/` **não sabe o nome de nenhum cliente**, não importa nada de Next, do
WhatsApp ou do banco, e não faz chamada de rede. Tudo que ele precisa entra por
parâmetro; tudo que ele decide sai no retorno.

```ts
executar(fluxo, sessao, entrada) → { acoes, sessao }
```

Consequências práticas:

- o simulador e a produção rodam **o mesmo código** — não existe "no teste funcionava"
- o motor tem teste unitário rodando em milissegundos, sem WhatsApp e sem banco
- roda em serverless, porque não existe estado vivo na memória

Quando alguém pedir uma feature, o teste é: **isso é um nó/configuração, ou é
um cliente específico?** Se for cliente específico, vai para o JSON do fluxo —
nunca para o `src/`.

## Como um fluxo se parece

O formato é o nativo do React Flow, sem camada de tradução. A aresta que você
arrasta no editor **é** a ramificação:

```json
{
  "inicio": "boas-vindas",
  "nodes": [
    { "id": "boas-vindas", "type": "mensagem", "position": { "x": 0, "y": 0 },
      "data": { "texto": "Oi! Sou o assistente virtual 👋" } },
    { "id": "assunto", "type": "pergunta", "position": { "x": 0, "y": 160 },
      "data": { "texto": "O que você procura?", "salvarEm": "assunto",
                "opcoes": [{ "id": "orcamento", "rotulo": "Orçamento" }] } }
  ],
  "edges": [
    { "id": "e1", "source": "boas-vindas", "target": "assunto" },
    { "id": "e2", "source": "assunto", "sourceHandle": "orcamento", "target": "..." }
  ]
}
```

Sete tipos de nó: `mensagem`, `pergunta`, `condicao`, `salvar-campo`, `ia`,
`handoff`, `http`.

## Garantias que o motor dá de graça

Ninguém precisa lembrar de desenhar isso — o sistema faz sozinho:

- **Escape global:** "atendente", "humano", "falar com alguém" transferem de
  qualquer ponto do fluxo
- **Anti hello-loop:** na 3ª resposta que o bot não entende, vai para uma pessoa
- **Áudio, imagem e documento** vão direto para uma pessoa — nunca "não entendi"
- **Ciclo no desenho** estoura uma trava e chama humano, em vez de prender alguém
- **O validador recusa publicar** fluxo que não tenha nenhum caminho até um humano
- **Integração que falha** não deixa ninguém pendurado: por padrão a conversa vai
  para uma pessoa, com o motivo real já escrito no painel de leads

## Segredo

Este repositório é **público**. `.env` está no `.gitignore` e chave nenhuma entra
aqui — nem temporariamente. Em produção a chave de IA é do cliente (BYOK) e mora
no Supabase Vault; o banco guarda só uma referência.

Veja `.env.example` para os nomes das variáveis.
