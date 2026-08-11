# AutoFluxos

Automação de atendimento no WhatsApp. Você desenha o fluxo, o bot conduz a
conversa, o lead cai numa tela. IA é opcional.

Produto da [4YU](https://4yu.com.br).

## Estado

**Etapa 1, passo 2 de 7:** o motor está testado e já dá para **conversar com um
fluxo** no navegador. Ainda não tem editor visual, banco, nem WhatsApp.

Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md) para o desenho completo e as
decisões por trás dele.

## Rodando

```bash
npm install
npm run dev       # http://localhost:3000 — o simulador
npm test          # 35 testes, ~400ms
npm run typecheck
```

Não precisa de Docker, banco, nem chave de API.

## O simulador

`/` abre um chat onde você escreve como se fosse o cliente e vê o bot responder,
com os botões que apareceriam no WhatsApp. Ao lado, o estado da conversa ao vivo:
nó atual, variáveis coletadas e o resultado da validação do fluxo.

Ele não imita o motor — ele **chama o motor**. `/api/simular` roda a mesma
`executar()` que o webhook do WhatsApp vai rodar, e o endpoint é sem estado: quem
guarda a sessão é o navegador, que devolve ela a cada mensagem.

Coisas que vale testar lá:

- escrever “quero falar com um atendente” a qualquer momento
- clicar no 🎤 para ver o que acontece quando a pessoa manda áudio
- responder “2” em vez de clicar no botão
- digitar besteira três vezes seguidas

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

Seis tipos de nó: `mensagem`, `pergunta`, `condicao`, `salvar-campo`, `ia`,
`handoff`.

## Garantias que o motor dá de graça

Ninguém precisa lembrar de desenhar isso — o sistema faz sozinho:

- **Escape global:** "atendente", "humano", "falar com alguém" transferem de
  qualquer ponto do fluxo
- **Anti hello-loop:** na 3ª resposta que o bot não entende, vai para uma pessoa
- **Áudio, imagem e documento** vão direto para uma pessoa — nunca "não entendi"
- **Ciclo no desenho** estoura uma trava e chama humano, em vez de prender alguém
- **O validador recusa publicar** fluxo que não tenha nenhum caminho até um humano

## Segredo

Este repositório é **público**. `.env` está no `.gitignore` e chave nenhuma entra
aqui — nem temporariamente. Em produção a chave de IA é do cliente (BYOK) e mora
no Supabase Vault; o banco guarda só uma referência.

Veja `.env.example` para os nomes das variáveis.
