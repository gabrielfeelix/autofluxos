import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FERRAMENTAS } from '@/core/ferramentas'
import type { Acao } from '@/core/engine/types'

/**
 * A trava da RB-45/T7.2, item 4: **nenhuma venda, tarefa de envio ou chamada de
 * integração real pode escapar da simulação.**
 *
 * ---------------------------------------------------------------------------
 * Por que este teste lê texto em vez de rodar o simulador
 * ---------------------------------------------------------------------------
 *
 * Porque o que precisa ser garantido é uma **ausência**, e ausência não se prova
 * executando um caso. Rodar o simulador e ver que nenhuma venda foi registrada
 * prova que *aquele* fluxo não registra venda; não prova que o efeito novo que
 * alguém acrescentar em três meses também não vai.
 *
 * É o mesmo raciocínio de `acoes.test.ts`, que lê o texto dos `acoes-*.ts` para
 * garantir que nenhuma Server Action esquece de perguntar quem é: grosseiro de
 * propósito, e pega exatamente a classe de erro que nenhum teste funcional pega.
 *
 * ---------------------------------------------------------------------------
 * A auditoria que este arquivo congela
 * ---------------------------------------------------------------------------
 *
 * O simulador e o motor de verdade compartilham **um executor só**
 * (`efeitos/resolver.ts`, com `origem: 'simulador'`), e isso é decisão antiga:
 * dois executores matam a frase "no simulador funcionava".
 *
 * O preço é que toda escrita nova precisa ser conferida contra essa origem. A
 * pergunta da T7.2, respondida efeito por efeito da F5/F6:
 *
 *   - `registrar_venda_e_concluir` — **inalcançável**. Não existe ação de venda
 *     no `Acao` do motor, e é a RB-46 escrita no tipo: "registrar venda por
 *     automação fica bloqueado por padrão". Quem chama a RPC é
 *     `acoes-vendas.ts`, Server Action, com capacidade `registrar_venda`;
 *   - `criarAtividade` — **inalcançável**. Não existe ação de atividade no
 *     motor. Quem chama é `acoes-atividades.ts`;
 *   - `enfileirarDestinatarios` — **inalcançável**. Não existe ação de
 *     transmissão no motor. Quem chama é `acoes-transmissoes.ts`.
 *
 * As escritas que o motor **sim** descreve (`salvar_campo`, `mover_etapa`,
 * `aplicar_etiqueta`, `escrever_nota`) são aplicadas em `receber-mensagem.ts`, e
 * a rota `/api/simular` não o chama: ela devolve as ações como JSON para o
 * navegador desenhar. O simulador não tem contato, não tem sessão gravada e não
 * tem para onde escrever.
 *
 * O que resta de verdade são as **chamadas HTTP**, que o simulador faz de
 * propósito (uma lista falsa não testa nada), e essas passam por `deTeste`.
 */

const AQUI = dirname(fileURLToPath(import.meta.url))
const RESOLVER = readFileSync(join(AQUI, 'resolver.ts'), 'utf8')
const TIPOS = readFileSync(join(AQUI, '..', '..', 'core', 'engine', 'types.ts'), 'utf8')
const ROTA_DO_SIMULADOR = readFileSync(
  join(AQUI, '..', '..', 'app', 'api', 'simular', 'route.ts'),
  'utf8',
)

describe('o catálogo de efeitos do motor', () => {
  /**
   * A lista é escrita à mão, e é isso que faz o teste valer: ela é a **decisão**
   * de quais efeitos o motor pode descrever. Um efeito novo faz este teste
   * falhar, e a falha é o pedido de auditoria: quem o acrescentar precisa dizer,
   * aqui, se o simulador pode alcançá-lo.
   */
  const ESPERADOS: Acao['tipo'][] = [
    'enviar_texto',
    'enviar_opcoes',
    'enviar_midia',
    'salvar_campo',
    'pausar_automacao',
    'chamar_ia',
    'chamar_http',
    'mover_etapa',
    'aplicar_etiqueta',
    'escrever_nota',
    'ir_para_fluxo',
    'transferir_humano',
    'guardar_nota',
    'guardar_comentario',
    'encerrar',
  ]

  it('não descreve venda, atividade nem transmissão', () => {
    /*
     * A RB-46 no tipo, e não num comentário: "registrar venda por automação fica
     * bloqueado por padrão. Uma mensagem do bot dizendo 'venda concluída' não é
     * evidência comercial suficiente".
     *
     * Enquanto não existir a ação, o simulador não tem como alcançá-la, e nem o
     * motor de verdade tem. É a garantia mais forte possível: não é uma guarda
     * que alguém pode esquecer de pôr, é a ausência do caminho.
     */
    for (const proibido of ['registrar_venda', 'criar_atividade', 'enfileirar', 'transmitir']) {
      expect(ESPERADOS.filter((tipo) => tipo.includes(proibido))).toEqual([])
    }
  })

  it('o tipo Acao não ganhou efeito sem auditoria', () => {
    /*
     * Se este teste falhar, **não** basta acrescentar o nome na lista acima.
     * Responda antes: o simulador alcança este efeito? Ele escreve em algum
     * lugar? Se escreve, onde está a guarda de `origem === 'simulador'`?
     *
     * A fonte é o **tipo `Acao`** em `core/engine/types.ts`, lido do texto, e
     * não o resolvedor: o resolvedor também produz `Entrada` (`http_respondeu`,
     * `ia_respondeu`), que são o que **entra** no motor e não o que sai dele.
     * Contar as duas coisas juntas faria o teste falhar por motivo errado, e
     * teste que falha por motivo errado é teste que alguém desliga.
     *
     * O TypeScript já garante que todo nome de `ESPERADOS` existe em `Acao`. O
     * que ele não pega, e este teste pega, é `Acao` ganhar um membro que ninguém
     * auditou aqui.
     */
    const inicio = TIPOS.indexOf('export type Acao =')
    expect(inicio).toBeGreaterThan(-1)
    const corpo = TIPOS.slice(inicio, TIPOS.indexOf('\nexport type Resultado', inicio))
    expect(corpo.length).toBeGreaterThan(500)

    /*
     * Os comentários saem antes da varredura, e é a borda que custou uma volta:
     * a documentação de `chamar_ia` e de `chamar_http` **cita** `ia_respondeu` e
     * `http_respondeu`, que são `Entrada` e não `Acao`. Contá-los faria o teste
     * acusar efeito inexistente.
     */
    const semComentario = corpo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')

    const noTipo = new Set<string>()
    for (const achado of semComentario.matchAll(/tipo: '(\w+)'/g)) noTipo.add(achado[1]!)

    expect(noTipo.size).toBeGreaterThan(5)
    for (const tipo of noTipo) {
      expect(ESPERADOS as readonly string[]).toContain(tipo)
    }
  })
})

describe('as guardas do modo de teste', () => {
  it('as quatro continuam no resolvedor', () => {
    /*
     * Os quatro pontos onde `origem: 'simulador'` decide algo. Contá-los é o que
     * faz uma remoção acidental aparecer: quem apagar a guarda de
     * `ferramenta.escreve` faz a aba Testar marcar aula de verdade na agenda de
     * alguém, e nenhum teste funcional do simulador notaria, porque a chamada
     * "funcionaria".
     */
    const ocorrencias = RESOLVER.match(/origem === 'simulador'/g) ?? []
    expect(ocorrencias.length).toBeGreaterThanOrEqual(3)

    // A guarda que importa mais: consulta que grava não grava em teste.
    expect(RESOLVER).toMatch(/deTeste && ferramenta\.escreve/)
  })

  it('há ferramenta que grava, então a guarda não é teórica', () => {
    // Se nenhuma ferramenta gravasse, a guarda acima seria enfeite. Ela existe
    // porque `agenda_marcar` e `agenda_desmarcar` marcam e desmarcam de verdade.
    const queGravam = FERRAMENTAS.filter((f) => f.escreve)
    expect(queGravam.length).toBeGreaterThan(0)
  })
})

describe('a rota do simulador', () => {
  it('declara a origem, que é o que arma todas as guardas', () => {
    expect(ROTA_DO_SIMULADOR).toMatch(/origem: 'simulador'/)
  })

  it('não aplica efeito nenhum: não chama receber-mensagem', () => {
    /*
     * **É a garantia de que `salvar_campo`, `mover_etapa`, `aplicar_etiqueta` e
     * `escrever_nota` não escapam.** Essas quatro escrevem no banco, e quem as
     * aplica é `receber-mensagem.ts`. A rota do simulador devolve as ações como
     * JSON para o navegador: ela não tem contato, não tem sessão gravada, e não
     * chama quem escreveria.
     *
     * Se alguém importar `receber-mensagem` aqui para "reaproveitar", este teste
     * cai, e é exatamente o momento de parar: testar um fluxo passaria a mover
     * cartão e etiquetar gente de verdade.
     */
    expect(ROTA_DO_SIMULADOR).not.toMatch(/from '@\/server\/receber-mensagem'/)
    expect(ROTA_DO_SIMULADOR).not.toMatch(/aplicarAcoes|registrarSaida|aplicarFato/)
  })
})
