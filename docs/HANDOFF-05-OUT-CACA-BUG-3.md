# Handoff 05/out/2026 (3): ficha, negócios, funis, modelos

Continua `docs/HANDOFF-05-OUT-CACA-BUG-2.md`. Leia antes: `AGENTS.md`,
`docs/BANCO-COMPARTILHADO.md`. Gabriel é designer, não dev: decisão tomada e
implementada, resposta curta, commit e push na hora (push na `main` publica na
Vercel), print local 1440 e 390 antes de entregar UI. Sem travessão em arquivo
nenhum. Validar com `tsc` + `eslint` (e o teste do arquivo tocado); suíte
inteira não. **Outra sessão mexe em paralelo** em planos/preços (commits
`feat(plano...)`, migrations 0128 a 0130): não toque nesses arquivos.

## O que entrou nesta sessão (tudo no ar)

| Commit | O quê |
|---|---|
| `a9e41e1` | Ficha: barra de edição vai ao `body` por portal (ficava parada no meio); Informações ganha Indicado por, E-mail, Empresa, Cidade (`InformacoesExtras`/`ExtrasEditaveis` em `lead-crm/campos-editaveis.tsx`) |
| `974d640` | Ficha: faixa de atendimento saiu; selo ao lado do nome (`SeloDoAtendimento aoLadoDoNome`) e botões na célula do topo (`CartaoDoAtendimento compacto`). Registrar venda: item com datalist do catálogo, títulos sem nome da pessoa |
| `c1fc082` | Negócio: cartão Anotações (lista + vazio ilustrado), Anotar abre modal; notas saem do Histórico recente |
| `e7e3e60` | **Migration 0127** (aplicada): `quadro_cartoes.avulso` e `.origem`, `negocio_arquivos`, bucket privado `autofluxos-negocios`. Ficha: "+ Nova negociação" (avulsa, pode repetir no mesmo funil). Negócio: Origem do negócio, cartão Arquivos (upload direto ao Storage por URL assinada, `server/repos/arquivos-do-negocio.ts`). Configurações > Vendas > Funis de venda (`quadros/funis-de-venda.tsx`) |
| `caca035`, `0954f75` | Texto cortado com "…" mostra o inteiro ao repousar o mouse (`design/dica-do-truncado.tsx`, montado no layout raiz); não age dentro de `Dica` (`data-dica`) |
| `1722acb` | Gabriel quer Funis de venda **só** em Configurações, não no menu do quadro |
| `dbef123` | Modelo da Meta: botão no balão, link conferido (`problemaDoBotao`, `linkParaAMeta`), telefone BR ganha 55 |
| `fafaaef`, `c0e02be`, `eb0974b` | Nomes de modelos em português (`core/titulo-da-biblioteca.ts`: `tituloDoModelo`, `categoriaLegivel`, `idiomaLegivel`) em toda tela que lista modelo |
| `a91d4aa` | Modelos aprovados em tabela; texto do modelo da biblioteca lido de volta da Meta; botão de link vai **sem** `url_suffix_example` (com ele a Meta cria `{{1}}` e o envio, que não manda variável de botão, falharia) |
| `62c570e`, `75959dd`, `87a5271`, `f1fa885` | Retomar janela: modelo aparece na caixa de escrever, travado, nome destacado nas lacunas, "Vai com o botão", botão **Enviar** |
| `833d635` | Mensagens guardadas em tabela (contato, telefone, mensagem, quem falou, quando) |
| `9bf8dc4` | Agendar mensagem: Dropdown com título legível, aviso amarelo só sem modelo, prévia travada |

`completarTextos` (`server/textos-dos-modelos.ts`) preenche o texto de modelos
antigos lendo da Meta na primeira leitura da lista.

## Decisões que valem daqui para a frente

- **Negócio avulso** (criado à mão) fica fora do índice "um aberto por contato
  e funil"; automação só procura `avulso = false` (`porNoQuadro`,
  `jaAbertosNoQuadro`, mover por contato em `repos/quadros.ts`).
- **Arquivo do negócio nunca passa pelo servidor** (Vercel corta ~4,5 MB):
  preparar, PUT direto, registrar.
- **Botão de modelo da Meta é obrigatório** quando o modelo da biblioteca tem;
  não oferecer como opcional. "Verificar a conta" é botão que o cliente recebe,
  não pendência de quem atende.
- Equipes por funil ficou de fora (não existe o conceito).

## Pendências abertas

- **PCYES**: o modelo `account_creation_confirmation_3_202610051827` tem link
  `https://www.pcyes.com.br/{{1}}`; Gabriel vai apagar e recriar. Até lá,
  transmissão com ele falha.
- Envio de modelo troca **todas** as lacunas pelo nome do contato
  (`{{2}}` = e-mail vira nome). Próximo passo sugerido: preencher cada
  variável antes de enviar/agendar.
- Upload de arquivo do negócio **não foi testado em produção** (só local).
- Do handoff anterior: lápis do nome ao lado do Editar; "Negócios" em
  Relatórios/Início; preço de plano sem `CampoDeDinheiro`; Fase 2 do plano de
  teste; permissão `vendas` para `autofluxos_dados`.

## Ambiente local: o que custou tempo

- **Storage local dá `42P10` no upload**: o container é mais velho que o schema
  `storage`. Contorno só local, como `supabase_admin`:
  `create unique index on storage.objects (name, bucket_id)`.
- `pkill -f "next dev"` mata o próprio shell da ferramenta; mate por PID.
- Dois `next dev` juntos corrompem o cache do Turbopack: mate todos e apague
  `.next/dev/cache`.
- Biblioteca de modelos da Meta não carrega local (tokens desligados); para
  ver tela que depende dela, rota temporária em `src/app/` que nunca entra no
  commit.
- Seeds locais desta sessão: templates e favoritas na conta de teste
  (`ab7ec604-...`), sessões humanas removidas.
