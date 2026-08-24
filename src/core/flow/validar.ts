import { mensagensDoHandoff, partesDaMensagem, textoDaMensagem } from './mensagem'
import {
  FORMATO_VARIAVEL,
  LIMITE_LEGENDA,
  LIMITE_LISTA,
  LIMITE_MENSAGENS_HANDOFF,
  LIMITE_ROTULO,
  LIMITE_TEXTO,
  LIMITE_TEXTO_INTERATIVO,
  SAIDA_ESCOLHEU,
  SAIDA_FALSO,
  SAIDA_TIMEOUT,
  SAIDA_VAZIO,
  SAIDA_VERDADEIRO,
  perguntaEhDinamica,
  type Fluxo,
  type No,
  type TipoDeMidia,
} from './schema'
import { contarCaracteres, temMetadeDeCaractere } from './texto'
import { variaveisCitadas } from '../engine/interpolar'

/**
 * `{{segredo.nome}}` — o namespace reservado para o cofre da v2.
 *
 * Ele atravessa o motor sem ser tocado (o regex de `interpolar()` não casa com
 * ponto), então hoje sairia literal na requisição. Por isso o aviso: é erro de
 * quem desenhou, mas não trava publicação de fluxo que não depende disso.
 */
const CITA_SEGREDO = /\{\{\s*segredo\.[a-zA-Z][a-zA-Z0-9_]*\s*\}\}/

export type Problema = {
  codigo: string
  mensagem: string
  noId?: string
}

export type ResultadoValidacao = {
  /** `false` bloqueia a publicação. */
  ok: boolean
  erros: Problema[]
  avisos: Problema[]
}

/**
 * O que o dono do fluxo tem direito de usar.
 *
 * Repare que é uma **capacidade**, não um cliente: o `core/` continua sem saber
 * que existe tabela `clients` ou coluna `ia_habilitada`. Ele só sabe responder
 * "com IA disponível, este desenho pode ir ao ar?". Quem traduz contrato em
 * capacidade é a camada de fora.
 */
export type Capacidades = {
  /**
   * IA é plano à parte (Etapa 2). O padrão é `false` — **falha fechado**: quem
   * esquecer de dizer que o cliente contratou vê a publicação ser recusada, que
   * é o erro barulhento. O contrário seria vender IA por descuido.
   */
  iaHabilitada?: boolean
  /**
   * Ids das conexões que existem para este cliente.
   *
   * `undefined` significa "não sei" e o validador não cobra — é o caso do
   * editor validando enquanto digita, sem ter ido ao banco. Quando a lista vem,
   * bloco apontando para conexão que não existe mais vira impedimento: publicar
   * assim entrega um fluxo que chama sem credencial, e a conversa morre em
   * handoff sem ninguém entender por quê.
   */
  conexoes?: string[]
  /**
   * O cliente escreveu o contexto do negócio?
   *
   * `undefined` = não sei, e aí não se cobra (é o editor validando sem ter ido
   * ao banco). Quando vem `false`, bloco de IA vira impedimento: o prompt manda
   * responder só com o que está no contexto, então com ele vazio a IA responde
   * "não sei" a tudo e a conversa vai para uma pessoa toda vez. Publicar assim
   * entrega um bot que parece funcionar e nunca responde.
   */
  temContextoDeNegocio?: boolean
  /**
   * Ids das etapas de quadro que existem para este cliente (C1b).
   *
   * `undefined` significa "não sei" e o validador não cobra — é o editor
   * validando enquanto alguém desenha, sem ter ido ao banco. Quando a lista
   * vem, bloco apontando para etapa apagada vira impedimento.
   *
   * **É a contrapartida de o bloco guardar referência em vez de cópia.** Etapa
   * é estado vivo e precisa ser referenciada; o preço é ela poder sumir depois
   * de publicada, e este é o lugar onde esse preço é cobrado antes de a
   * conversa de alguém pagar por ele.
   */
  etapas?: string[]
  /**
   * As outras automações deste cliente, para o bloco "Ir para outro fluxo".
   *
   * `undefined` = não sei, e aí não se cobra (o editor validando sem ter ido ao
   * banco). Quando a lista vem, o destino é conferido pelos dois critérios que
   * decidem se o salto funciona **na hora da conversa**: existir com versão
   * publicada e estar ligado.
   *
   * É a contrapartida de o bloco guardar referência em vez de cópia, igual à
   * etapa de quadro: quem salta quer o fluxo de hoje, e o preço é ele poder
   * sumir depois. Este é o lugar onde o preço é cobrado antes de a conversa de
   * alguém pagar por ele.
   */
  fluxos?: { id: string; nome: string; publicado: boolean; ativo: boolean }[]
  /** Qual é este fluxo, para avisar sobre salto para ele mesmo. */
  fluxoAtualId?: string
}

/**
 * Confere se o fluxo pode ir ao ar.
 *
 * A regra que mais importa aqui é a do handoff alcançável: o sistema se recusa
 * a publicar um bot que não tem como passar a conversa para um humano. É a
 * diferença entre um produto que previne o "hello loop" e um produto que confia
 * na memória de quem desenhou o fluxo.
 */
export function validar(fluxo: Fluxo, capacidades: Capacidades = {}): ResultadoValidacao {
  const {
    iaHabilitada = false,
    conexoes,
    temContextoDeNegocio,
    etapas,
    fluxos,
    fluxoAtualId,
  } = capacidades
  const erros: Problema[] = []
  const avisos: Problema[] = []

  const porId = new Map<string, No>()
  for (const no of fluxo.nodes) {
    if (porId.has(no.id)) {
      erros.push({ codigo: 'ID_DUPLICADO', mensagem: `Existe mais de um nó com o id "${no.id}".`, noId: no.id })
    }
    porId.set(no.id, no)
  }

  if (!porId.has(fluxo.inicio)) {
    erros.push({
      codigo: 'SEM_INICIO',
      mensagem: `O fluxo aponta para o nó de início "${fluxo.inicio}", que não existe.`,
    })
  }

  for (const aresta of fluxo.edges) {
    if (!porId.has(aresta.source)) {
      erros.push({ codigo: 'ARESTA_SOLTA', mensagem: `A ligação "${aresta.id}" sai de um nó que não existe.` })
    }
    if (!porId.has(aresta.target)) {
      erros.push({ codigo: 'ARESTA_SOLTA', mensagem: `A ligação "${aresta.id}" chega num nó que não existe.` })
    }
  }

  const saidas = (noId: string) => fluxo.edges.filter((a) => a.source === noId)

  for (const no of fluxo.nodes) {
    const minhasSaidas = saidas(no.id)
    conferirConteudo(no, erros, avisos)

    if (no.type === 'pergunta' && perguntaEhDinamica(no)) {
      if (no.data.opcoes.length > 0) {
        erros.push({
          codigo: 'OPCOES_MISTURADAS',
          mensagem: `"${no.data.texto}" tira as opções de {{${no.data.opcoesDe}}} e também tem opções desenhadas. Escolha um dos dois: as desenhadas seriam ignoradas.`,
          noId: no.id,
        })
      }

      for (const saida of [SAIDA_ESCOLHEU, SAIDA_VAZIO]) {
        if (!minhasSaidas.some((a) => a.sourceHandle === saida)) {
          erros.push({
            codigo: 'PERGUNTA_DINAMICA_SEM_SAIDA',
            mensagem:
              saida === SAIDA_VAZIO
                ? `"${no.data.texto}" não diz o que fazer quando {{${no.data.opcoesDe}}} vem vazia. Ligue a saída "vazio" — lista que vem de fora vem vazia.`
                : `"${no.data.texto}" não continua depois da escolha. Ligue a saída "escolheu".`,
            noId: no.id,
          })
        }
      }
    } else if (no.type === 'pergunta') {
      const { opcoes } = no.data

      if (opcoes.length > LIMITE_LISTA) {
        erros.push({
          codigo: 'OPCOES_DEMAIS',
          mensagem: `"${no.data.texto}" tem ${opcoes.length} opções. O WhatsApp aceita no máximo ${LIMITE_LISTA}.`,
          noId: no.id,
        })
      }

      const vistas = new Set<string>()
      for (const opcao of opcoes) {
        if (vistas.has(opcao.id)) {
          erros.push({
            codigo: 'OPCAO_DUPLICADA',
            mensagem: `A opção "${opcao.rotulo}" está repetida.`,
            noId: no.id,
          })
        }
        vistas.add(opcao.id)

        if (!minhasSaidas.some((a) => a.sourceHandle === opcao.id)) {
          erros.push({
            codigo: 'OPCAO_SEM_SAIDA',
            mensagem: `A opção "${opcao.rotulo}" não leva a lugar nenhum. Ligue ela a outro bloco.`,
            noId: no.id,
          })
        }
      }

      // A aresta de timeout não conta como continuação: ela é o caminho de
      // quem **não** respondeu. Contá-la deixaria passar uma pergunta que só
      // sabe o que fazer com o silêncio, e não com a resposta.
      const continuacoes = minhasSaidas.filter((a) => a.sourceHandle !== SAIDA_TIMEOUT)
      if (opcoes.length === 0 && continuacoes.length === 0) {
        erros.push({
          codigo: 'PERGUNTA_SEM_SAIDA',
          mensagem: `"${no.data.texto}" espera uma resposta mas não continua para lugar nenhum.`,
          noId: no.id,
        })
      }
    }

    // O portão comercial da Etapa 2. Sem ele, um fluxo com nó de IA publica
    // para quem não contratou e a conversa vira handoff silencioso em produção
    // — o cliente vê o bot "desistindo" sem ninguém entender por quê.
    if (no.type === 'ia' && !iaHabilitada) {
      erros.push({
        codigo: 'IA_NAO_CONTRATADA',
        mensagem: `${descrever(no)} usa IA, que é um plano à parte e não está contratado para este cliente.`,
        noId: no.id,
      })
    }

    if (no.type === 'ia' && temContextoDeNegocio === false) {
      erros.push({
        codigo: 'SEM_CONTEXTO_DE_NEGOCIO',
        mensagem:
          'Este cliente não tem o contexto do negócio escrito, e é só com ele que a IA pode responder. Do jeito que está, ela responderia "não sei" a tudo.',
        noId: no.id,
      })
    }

    if (no.type === 'http' && no.data.conexaoId && conexoes && !conexoes.includes(no.data.conexaoId)) {
      erros.push({
        codigo: 'CONEXAO_INEXISTENTE',
        mensagem: `${descrever(no)} usa uma credencial que não existe mais neste cliente. Escolha outra, ou tire a credencial.`,
        noId: no.id,
      })
    }

    if (no.type === 'etapa') {
      if (!no.data.quadroId || !no.data.colunaId) {
        erros.push({
          codigo: 'ETAPA_NAO_ESCOLHIDA',
          mensagem:
            'Este bloco move o contato no quadro, mas nenhuma etapa foi escolhida. Do jeito que está ele não faria nada.',
          noId: no.id,
        })
      } else if (etapas && !etapas.includes(no.data.colunaId)) {
        erros.push({
          codigo: 'ETAPA_INEXISTENTE',
          mensagem:
            'Este bloco aponta para uma etapa que não existe mais neste cliente. Escolha outra — publicar assim entrega um fluxo que não move ninguém.',
          noId: no.id,
        })
      }
    }

    if (no.type === 'ir-fluxo') {
      const destino = fluxos?.find((f) => f.id === no.data.fluxoId)

      if (!no.data.fluxoId) {
        erros.push({
          codigo: 'DESTINO_NAO_ESCOLHIDO',
          mensagem:
            'Este bloco manda a conversa para outra automação, mas nenhuma foi escolhida. Do jeito que está, a conversa pararia aqui.',
          noId: no.id,
        })
      } else if (fluxoAtualId && no.data.fluxoId === fluxoAtualId) {
        // Aviso, e não impedimento: recomeçar o próprio fluxo é desenho
        // legítimo ("quer ver de novo?"). Quem protege contra o laço infinito
        // é a trava de saltos do servidor, não esta lista.
        avisos.push({
          codigo: 'DESTINO_EH_ELE_MESMO',
          mensagem:
            'Este bloco manda a conversa para esta mesma automação, do começo. Se isso não for de propósito, escolha outra.',
          noId: no.id,
        })
      } else if (fluxos && !destino) {
        erros.push({
          codigo: 'DESTINO_SUMIU',
          mensagem:
            'Este bloco aponta para uma automação que não existe mais neste cliente. Escolha outra — publicar assim deixaria a conversa sem para onde ir.',
          noId: no.id,
        })
      } else if (destino && !destino.publicado) {
        erros.push({
          codigo: 'DESTINO_SEM_PUBLICACAO',
          mensagem: `A automação "${destino.nome}" nunca foi publicada, então não há o que executar do outro lado. Publique ela antes de mandar conversa para lá.`,
          noId: no.id,
        })
      } else if (destino && !destino.ativo) {
        // Aviso: desligar é reversível num clique, e bloquear a publicação daqui
        // faria o interruptor de uma automação travar a publicação de outra.
        avisos.push({
          codigo: 'DESTINO_DESLIGADO',
          mensagem: `A automação "${destino.nome}" está desligada. Enquanto ficar assim, quem chegar neste bloco vai para uma pessoa em vez de continuar lá.`,
          noId: no.id,
        })
      }
    }

    if (no.type === 'condicao') {
      for (const saida of [SAIDA_VERDADEIRO, SAIDA_FALSO]) {
        if (!minhasSaidas.some((a) => a.sourceHandle === saida)) {
          erros.push({
            codigo: 'CONDICAO_SEM_SAIDA',
            mensagem: `A condição sobre "${no.data.variavel}" não tem saída para "${saida}".`,
            noId: no.id,
          })
        }
      }
    }
  }

  const alcancaveis = alcancaveisA_partirDe(fluxo)

  for (const no of fluxo.nodes) {
    if (!alcancaveis.has(no.id)) {
      avisos.push({
        codigo: 'NO_ORFAO',
        mensagem: `${descrever(no)} está solto: a conversa nunca chega nele.`,
        noId: no.id,
      })
    }
  }

  /**
   * O salto para outro fluxo **conta como saída humana**.
   *
   * Não é frouxidão: o destino só pode ser um fluxo publicado, e nenhum fluxo
   * publica sem ter caminho até uma pessoa. A escapatória continua garantida —
   * ela só passou a estar do outro lado da porta. Sem isto, um fluxo de triagem
   * que só distribui para os fluxos especializados seria obrigado a ter um
   * handoff decorativo que ninguém alcança.
   */
  const temSaidaHumana = [...alcancaveis].some((id) => {
    const tipo = porId.get(id)?.type
    return tipo === 'handoff' || tipo === 'ir-fluxo'
  })
  if (!temSaidaHumana) {
    erros.push({
      codigo: 'SEM_SAIDA_HUMANA',
      mensagem:
        'Nenhum caminho do fluxo chega a um bloco "Falar com humano". Todo fluxo precisa ter como escapar para uma pessoa.',
    })
  }

  for (const problema of conferirVariaveis(fluxo)) avisos.push(problema)

  return { ok: erros.length === 0, erros, avisos }
}

/**
 * Como chamar um bloco dentro de uma mensagem para quem desenhou.
 *
 * Existe porque as listas de impedimento e de aviso são do **fluxo inteiro**,
 * não do bloco selecionado. Sem isto, dois blocos soltos viravam duas linhas
 * idênticas dizendo "Este bloco está solto" — e "este" não respondia qual, que
 * é exatamente o que a pessoa precisa saber para consertar.
 *
 * O texto do bloco é o que identifica melhor, porque é o que se lê no desenho.
 * Quando ele está vazio sobra o tipo, que ao menos estreita a busca.
 */
function descrever(no: No): string {
  const curto = (texto: string) => {
    const limpo = texto.trim().replace(/\s+/g, ' ')
    if (limpo === '') return ''
    return limpo.length > 38 ? `"${limpo.slice(0, 38)}…"` : `"${limpo}"`
  }
  const rotular = (tipo: string, detalhe: string) =>
    detalhe === '' ? `O bloco de ${tipo}` : `${tipo} ${detalhe}`

  switch (no.type) {
    case 'mensagem':
      return rotular('Mensagem', curto(textoDaMensagem(no)))
    case 'pergunta':
      return rotular('Pergunta', curto(no.data.texto))
    case 'condicao':
      return rotular('Condição sobre', curto(no.data.variavel))
    case 'salvar-campo':
      return rotular('Guardar em', curto(no.data.campo))
    case 'ia':
      return rotular('IA', curto(no.data.instrucao))
    case 'handoff':
      return rotular('Falar com humano', curto(no.data.motivo))
    case 'http':
      return rotular('Serviços externos', curto(no.data.url))
    case 'midia':
      return rotular('Mídia', curto(no.data.legenda ?? no.data.url))
    case 'etapa':
      // O bloco de etapa não tem texto nenhum para citar — os dois campos são
      // ids. Sobra o tipo, que é o que já acontece com qualquer bloco vazio.
      return 'O bloco de etapa do quadro'
    case 'ir-fluxo':
      // `rotulo` é o nome do fluxo de destino guardado na hora da escolha. É
      // exatamente o que identifica o bloco para quem lê a lista de problemas.
      return rotular('Ir para', curto(no.data.rotulo))
  }
}

/**
 * As regras de um arquivo que o bot manda — **as mesmas** para o bloco de mídia
 * e para o pedaço de mídia dentro de uma mensagem.
 *
 * Ela existe porque agora há dois lugares que descrevem o mesmo envio, e cada
 * uma destas quatro regras já custou caro em algum lugar: a Meta recusa a
 * mensagem **inteira** quando qualquer uma é quebrada, e quem descobre é o
 * cliente conversando. Duas cópias divergiriam na primeira mudança.
 */
function conferirMidia(
  dados: { midia: TipoDeMidia; url: string; legenda?: string },
  noId: string,
  erros: Problema[],
): void {
  const vazio = (texto: string) => texto.trim() === ''

  if (vazio(dados.url)) {
    erros.push({
      codigo: 'MIDIA_SEM_ARQUIVO',
      mensagem: 'Este bloco não diz qual arquivo enviar.',
      noId,
    })
  } else if (temVariavelNoHost(dados.url)) {
    // Mesma regra do bloco de serviços externos, e pelo mesmo motivo: as
    // variáveis vêm do que a pessoa digita no WhatsApp. Com o host vindo
    // delas, quem conversa escolheria de qual servidor a Meta baixa — e o
    // arquivo entregue em nome do cliente passaria a ser escolha de um
    // estranho.
    erros.push({
      codigo: 'HOST_VARIAVEL',
      mensagem:
        'O endereço do servidor não pode vir de {{variavel}}. Use variável só depois da primeira barra.',
      noId,
    })
  } else if (!dados.url.trim().startsWith('https://')) {
    erros.push({
      codigo: 'MIDIA_INSEGURA',
      mensagem:
        'O arquivo precisa vir de um endereço https:// — a Meta recusa buscar de qualquer outro.',
      noId,
    })
  }

  // Áudio com legenda não é campo ignorado: a Meta recusa a mensagem. Vale
  // recusar aqui para ninguém descobrir com cliente de verdade conversando.
  if (dados.midia === 'audio' && !vazio(dados.legenda ?? '')) {
    erros.push({
      codigo: 'AUDIO_COM_LEGENDA',
      mensagem:
        'Áudio não aceita legenda no WhatsApp. Escreva a legenda num pedaço de texto antes ou depois dele.',
      noId,
    })
  }

  const legenda = contarCaracteres(dados.legenda ?? '')
  if (legenda > LIMITE_LEGENDA) {
    erros.push({
      codigo: 'TEXTO_LONGO',
      mensagem: `São ${legenda} caracteres. A legenda de mídia aceita ${LIMITE_LEGENDA} — acima disso o WhatsApp recusa a mensagem inteira.`,
      noId,
    })
  }
}

/**
 * As regras de conteúdo que o Zod não faz mais.
 *
 * O schema garante que o objeto tem o formato certo; aqui a gente cobra que ele
 * faça sentido. A separação existe porque o rascunho passa por estados
 * incompletos enquanto alguém digita — o que não pode é isso ir ao ar.
 */
function conferirConteudo(no: No, erros: Problema[], avisos: Problema[]): void {
  const vazio = (texto: string) => texto.trim() === ''

  const conferirVariavel = (nome: string | undefined, campo: string) => {
    if (nome === undefined || nome === '') return
    if (!FORMATO_VARIAVEL.test(nome)) {
      erros.push({
        codigo: 'VARIAVEL_INVALIDA',
        mensagem: `"${nome}" não serve como nome de ${campo}: comece com letra e use só letras, números e _ (sem espaço nem acento).`,
        noId: no.id,
      })
    }
  }

  /**
   * O corpo cabe no que a Meta aceita? Qual limite vale depende de a mensagem
   * sair como texto puro ou como interativa — a mesma decisão que o
   * `executar.ts` toma pela quantidade de opções.
   */
  const conferirTamanho = (texto: string, interativa: boolean) => {
    const limite = interativa ? LIMITE_TEXTO_INTERATIVO : LIMITE_TEXTO
    // Por caractere, e não por unidade UTF-16: emoji ocupa duas, e a Meta conta
    // uma. Ver `core/flow/texto.ts`.
    const usados = contarCaracteres(texto)
    if (usados > limite) {
      erros.push({
        codigo: 'TEXTO_LONGO',
        mensagem: interativa
          ? `São ${usados} caracteres. Mensagem com botões ou lista aceita ${limite} — acima disso o WhatsApp recusa a mensagem inteira, e a pessoa não recebe nada.`
          : `São ${usados} caracteres. O WhatsApp aceita ${limite}.`,
        noId: no.id,
      })
    }
  }

  switch (no.type) {
    case 'mensagem': {
      /**
       * O bloco é uma pilha, e o vazio dela é o que importa recusar.
       *
       * "Sem texto" deixou de ser a pergunta certa: um bloco que só manda uma
       * foto é legítimo. O que não pode ir ao ar é um bloco que **não faz
       * nada** — nenhum pedaço, ou só pedaços que não entregam coisa alguma.
       */
      const partes = partesDaMensagem(no)
      const entrega = partes.some(
        (parte) =>
          (parte.tipo === 'texto' && !vazio(parte.texto)) ||
          parte.tipo === 'midia' ||
          parte.tipo === 'salvar' ||
          parte.tipo === 'auto-off',
      )

      if (!entrega) {
        erros.push({
          codigo: 'TEXTO_VAZIO',
          mensagem: 'Esta mensagem está vazia: ela não manda nem guarda nada.',
          noId: no.id,
        })
      }

      for (const parte of partes) {
        switch (parte.tipo) {
          case 'texto':
            // Cada pedaço vira **uma mensagem própria** no WhatsApp, então o
            // limite é por pedaço e não pela soma. Somar recusaria uma pilha
            // perfeitamente válida de três textos de 2.000 caracteres.
            conferirTamanho(parte.texto, false)
            break
          case 'midia':
            conferirMidia(parte, no.id, erros)
            break
          case 'salvar':
            conferirVariavel(parte.campo, 'variável')
            if (vazio(parte.campo)) {
              erros.push({
                codigo: 'CAMPO_SEM_NOME',
                mensagem: 'Um pedaço "guardar" não diz em qual variável gravar.',
                noId: no.id,
              })
            }
            break
          case 'atraso':
          case 'auto-off':
            break
        }
      }

      /**
       * Atraso no fim da pilha não atrasa nada: ele adia a **próxima** entrega,
       * e não existe próxima. É aviso e não impedimento — o fluxo funciona, só
       * que aquele pedaço é decorativo, e quem desenhou merece saber.
       */
      if (partes.length > 0 && partes[partes.length - 1]!.tipo === 'atraso') {
        avisos.push({
          codigo: 'ATRASO_NO_FIM',
          mensagem: `${descrever(no)} termina com um atraso, que não atrasa nada: ele adia a entrega seguinte, e não há nenhuma depois dele.`,
          noId: no.id,
        })
      }
      break
    }

    case 'midia':
      conferirMidia(no.data, no.id, erros)
      break

    case 'pergunta': {
      if (vazio(no.data.texto)) {
        erros.push({ codigo: 'TEXTO_VAZIO', mensagem: 'Esta pergunta está sem texto.', noId: no.id })
      }
      // Pergunta dinâmica também vira interativa: as opções chegam na hora, mas
      // chegam.
      conferirTamanho(no.data.texto, no.data.opcoes.length > 0 || perguntaEhDinamica(no))
      conferirVariavel(no.data.salvarEm, 'variável')
      conferirVariavel(no.data.opcoesDe, 'variável das opções')
      for (const opcao of no.data.opcoes) {
        if (vazio(opcao.rotulo)) {
          erros.push({ codigo: 'ROTULO_VAZIO', mensagem: 'Uma das opções está sem rótulo.', noId: no.id })
        } else if (contarCaracteres(opcao.rotulo) > LIMITE_ROTULO) {
          erros.push({
            codigo: 'ROTULO_LONGO',
            mensagem: `"${opcao.rotulo}" tem ${contarCaracteres(opcao.rotulo)} caracteres. O WhatsApp corta em ${LIMITE_ROTULO}.`,
            noId: no.id,
          })
        }
        /*
         * Meio caractere não é texto — e não é problema de estilo.
         *
         * Um substituto sem par sobrevive na memória do navegador e no
         * `JSON.stringify`, mas o Postgres recusa `\ud83d` dentro de `jsonb`:
         * o rascunho para de gravar e quem digitou vê a opção sumir sem
         * explicação. Recusar aqui transforma um salvamento que falha em
         * silêncio num impedimento com nome.
         */
        if (temMetadeDeCaractere(opcao.rotulo)) {
          erros.push({
            codigo: 'ROTULO_QUEBRADO',
            mensagem: `A opção "${opcao.rotulo.replace(/\p{Surrogate}/gu, '')}" tem um emoji pela metade. Apague-o e ponha de novo.`,
            noId: no.id,
          })
        }
      }
      break
    }

    case 'condicao':
      conferirVariavel(no.data.variavel, 'variável')
      if (vazio(no.data.variavel)) {
        erros.push({ codigo: 'CONDICAO_SEM_VARIAVEL', mensagem: 'A condição não diz qual variável olhar.', noId: no.id })
      }
      break

    case 'salvar-campo':
      conferirVariavel(no.data.campo, 'campo')
      if (vazio(no.data.campo)) {
        erros.push({ codigo: 'CAMPO_VAZIO', mensagem: `${descrever(no)} não diz em qual campo guardar.`, noId: no.id })
      }
      break

    case 'ia':
      if (vazio(no.data.instrucao)) {
        erros.push({ codigo: 'IA_SEM_INSTRUCAO', mensagem: 'A IA está sem instrução.', noId: no.id })
      }
      conferirVariavel(no.data.salvarEm, 'variável')
      break

    case 'handoff': {
      const mensagens = mensagensDoHandoff(no)

      if (mensagens.every((mensagem) => vazio(mensagem))) {
        erros.push({
          codigo: 'TEXTO_VAZIO',
          mensagem: 'Sem mensagem, a pessoa é passada para um humano sem aviso nenhum.',
          noId: no.id,
        })
      } else if (mensagens.some((mensagem) => vazio(mensagem))) {
        // Uma vazia no meio de outras não some sozinha: o motor pula, mas quem
        // desenhou está olhando para um campo que parece que vai falar.
        erros.push({
          codigo: 'TEXTO_VAZIO',
          mensagem: `${descrever(no)} tem uma mensagem em branco. Escreva nela ou tire.`,
          noId: no.id,
        })
      }

      if (mensagens.length > LIMITE_MENSAGENS_HANDOFF) {
        erros.push({
          codigo: 'MENSAGENS_DEMAIS',
          mensagem: `${descrever(no)} manda ${mensagens.length} mensagens antes de transferir. O limite é ${LIMITE_MENSAGENS_HANDOFF} — acima disso é fila chegando no celular de quem já quer falar com alguém.`,
          noId: no.id,
        })
      }

      for (const mensagem of mensagens) conferirTamanho(mensagem, false)
      break
    }

    case 'http': {
      if (vazio(no.data.url)) {
        erros.push({ codigo: 'URL_VAZIA', mensagem: `${descrever(no)} não diz qual endereço chamar.`, noId: no.id })
      } else if (temVariavelNoHost(no.data.url)) {
        erros.push({
          codigo: 'HOST_VARIAVEL',
          mensagem:
            'O endereço do servidor não pode vir de {{variavel}}. As variáveis são o que a pessoa digita no WhatsApp — quem conversa escolheria para onde a chamada vai. Use variável só depois da primeira barra.',
          noId: no.id,
        })
      } else if (!no.data.url.trim().startsWith('https://')) {
        // Exigir o `https://` **literal** no começo é de propósito, e o efeito
        // colateral é que a URL não pode começar com `{{variavel}}`.
        //
        // Isso não é limitação a corrigir: as variáveis da sessão vêm do que a
        // pessoa digita no WhatsApp. Se o começo da URL saísse delas, quem está
        // conversando escolheria para onde o nosso servidor faz requisição. A
        // recusa de endereço interno (`server/efeitos/rede.ts`) ainda barraria
        // rede privada, mas um estranho passaria a apontar o servidor para
        // qualquer host externo que quisesse.
        //
        // Se um dia fizer falta ter endereço-base por cliente, o caminho é uma
        // lista de hosts permitidos — não afrouxar isto aqui.
        erros.push({
          codigo: 'URL_INSEGURA',
          mensagem: 'O endereço precisa começar com https:// — o servidor recusa qualquer outro.',
          noId: no.id,
        })
      }

      for (const item of no.data.mapear) {
        conferirVariavel(item.variavel, 'variável')
        if (vazio(item.variavel)) {
          erros.push({
            codigo: 'VARIAVEL_INVALIDA',
            mensagem: 'Um dos mapeamentos não diz em qual variável guardar.',
            noId: no.id,
          })
        }
        // Sem caminho, `extrair()` devolve string vazia para sempre e o fluxo
        // publica parecendo certo — a variável só nunca é preenchida. É o tipo
        // de defeito que só aparece com cliente conversando.
        if (vazio(item.caminho)) {
          erros.push({
            codigo: 'CAMINHO_VAZIO',
            mensagem: `O mapeamento de "${item.variavel || 'uma variável'}" não diz qual campo da resposta ler.`,
            noId: no.id,
          })
        }
      }

      if (no.data.metodo === 'POST' && !vazio(no.data.corpo)) {
        const problema = conferirCorpo(no.data.corpo)
        if (problema === 'VARIAVEL_FORA_DE_ASPAS') {
          erros.push({
            codigo: 'VARIAVEL_FORA_DE_ASPAS',
            mensagem:
              'Toda {{variavel}} no corpo precisa estar entre aspas: o que a conversa coleta é sempre texto, e sem as aspas o JSON quebra na hora do envio.',
            noId: no.id,
          })
        } else if (problema === 'CORPO_INVALIDO') {
          erros.push({
            codigo: 'CORPO_INVALIDO',
            mensagem: 'O corpo não é JSON válido.',
            noId: no.id,
          })
        }
      }
      break
    }
  }
}

/**
 * O mesmo padrão que `interpolar()` reconhece. Precisa ser o mesmo, e não um
 * parecido: o que este arquivo aprova é enviado depois de passar por lá, então
 * qualquer diferença entre os dois vira corpo que publica e quebra na conversa.
 *
 * `{{1abc}}` é o exemplo: não é nome de variável válido, `interpolar()` não
 * troca, e o texto sai literal na requisição. Com um regex mais frouxo aqui,
 * isso passaria na validação.
 */
const VARIAVEL_NO_TEXTO = /\{\{\s*[a-zA-Z][a-zA-Z0-9_]*\s*\}\}/g

/**
 * Confere o corpo do POST sabendo que as variáveis ainda não viraram nada.
 *
 * Duas regras, e a segunda é a que salva de um bug que só aparece com cliente
 * real conversando:
 *
 * 1. **Toda variável tem que estar entre aspas.** As variáveis da sessão são
 *    sempre texto (`Record<string, string>`), então `{"nome": {{nome}}}` vira
 *    `{"nome": João}` no envio — JSON quebrado. Variável fora de aspas num
 *    corpo JSON é sempre engano, nunca intenção.
 * 2. **Com as aspas garantidas, trocar por `1` e tentar `JSON.parse`.** Como
 *    toda variável está dentro de uma string, a troca não muda a estrutura, e o
 *    que sobrar de errado é erro de sintaxe de verdade.
 */
function conferirCorpo(corpo: string): 'CORPO_INVALIDO' | 'VARIAVEL_FORA_DE_ASPAS' | null {
  const dentroDeTexto = mapaDeTexto(corpo)

  for (const achado of corpo.matchAll(VARIAVEL_NO_TEXTO)) {
    if (achado.index !== undefined && !dentroDeTexto[achado.index]) {
      return 'VARIAVEL_FORA_DE_ASPAS'
    }
  }

  try {
    JSON.parse(corpo.replace(VARIAVEL_NO_TEXTO, '1'))
    return null
  } catch {
    return 'CORPO_INVALIDO'
  }
}

/** Para cada posição do texto, se ela está dentro de uma string JSON. */
function mapaDeTexto(corpo: string): boolean[] {
  const dentro: boolean[] = []
  let emTexto = false
  let escapado = false

  for (let i = 0; i < corpo.length; i++) {
    dentro[i] = emTexto

    if (escapado) {
      escapado = false
      continue
    }
    if (corpo[i] === '\\') {
      escapado = true
      continue
    }
    if (corpo[i] === '"') emTexto = !emTexto
  }

  return dentro
}

function alcancaveisA_partirDe(fluxo: Fluxo): Set<string> {
  const vistos = new Set<string>()
  const fila = [fluxo.inicio]

  while (fila.length > 0) {
    const atual = fila.shift() as string
    if (vistos.has(atual)) continue
    vistos.add(atual)
    for (const aresta of fluxo.edges) {
      if (aresta.source === atual) fila.push(aresta.target)
    }
  }

  return vistos
}

/** Avisa sobre `{{variavel}}` que o fluxo nunca preenche. */
function conferirVariaveis(fluxo: Fluxo): Problema[] {
  const definidas = new Set<string>()
  for (const no of fluxo.nodes) {
    if (no.type === 'pergunta' && no.data.salvarEm) definidas.add(no.data.salvarEm)
    if (no.type === 'salvar-campo') definidas.add(no.data.campo)
    if (no.type === 'ia' && no.data.salvarEm) definidas.add(no.data.salvarEm)
    if (no.type === 'http') {
      for (const item of no.data.mapear) definidas.add(item.variavel)
    }
  }

  const problemas: Problema[] = []
  for (const no of fluxo.nodes) {
    for (const citada of variaveisDoNo(no)) {
      if (!definidas.has(citada)) {
        problemas.push({
          codigo: 'VARIAVEL_DESCONHECIDA',
          mensagem: `${descrever(no)} usa {{${citada}}}, mas nenhum bloco preenche essa informação.`,
          noId: no.id,
        })
      }
    }
  }

  for (const no of fluxo.nodes) {
    if (no.type !== 'http') continue
    const textos = [no.data.url, no.data.corpo, ...no.data.cabecalhos.map((c) => c.valor)]
    if (textos.some((t) => CITA_SEGREDO.test(t))) {
      problemas.push({
        codigo: 'SEGREDO_INEXISTENTE',
        mensagem: `${descrever(no)} usa {{segredo.…}}, e o cofre de segredos ainda não existe. Hoje isso sai literal na chamada.`,
        noId: no.id,
      })
    }
  }

  return problemas
}

function variaveisDoNo(no: No): string[] {
  switch (no.type) {
    case 'mensagem':
      return partesDaMensagem(no).flatMap((parte) => {
        switch (parte.tipo) {
          case 'texto':
            return variaveisCitadas(parte.texto)
          case 'midia':
            return [
              ...variaveisCitadas(parte.url),
              ...variaveisCitadas(parte.legenda ?? ''),
              ...variaveisCitadas(parte.nomeArquivo ?? ''),
            ]
          case 'salvar':
            return variaveisCitadas(parte.valor)
          default:
            return []
        }
      })
    case 'pergunta':
      // `opcoesDe` é citação como qualquer outra: apontar para variável que
      // nenhum bloco preenche entrega uma pergunta que nasce sempre vazia.
      return [
        ...variaveisCitadas(no.data.texto),
        ...(perguntaEhDinamica(no) ? [no.data.opcoesDe as string] : []),
      ]
    case 'salvar-campo':
      return variaveisCitadas(no.data.valor)
    case 'midia':
      return [
        ...variaveisCitadas(no.data.url),
        ...variaveisCitadas(no.data.legenda ?? ''),
        ...variaveisCitadas(no.data.nomeArquivo ?? ''),
      ]
    case 'ia':
      return variaveisCitadas(no.data.instrucao)
    case 'handoff':
      return mensagensDoHandoff(no).flatMap((mensagem) => variaveisCitadas(mensagem))
    case 'condicao':
      return [no.data.variavel]
    case 'http':
      return [
        ...variaveisCitadas(no.data.url),
        ...variaveisCitadas(no.data.corpo),
        ...no.data.cabecalhos.flatMap((c) => variaveisCitadas(c.valor)),
      ]
    case 'etapa':
      // Ids, não variáveis. Interpolar `{{}}` aqui seria deixar a conversa
      // escolher em que etapa a pessoa cai, e o id não é coisa que se digite.
      return []
    case 'ir-fluxo':
      // Mesmo motivo da etapa: o destino é um id escolhido no editor. Deixar a
      // conversa escolher para qual automação ela pula seria entregar o roteiro
      // do atendimento para quem está do outro lado.
      return []
  }
}

/**
 * A variável está no pedaço da URL que decide **para qual servidor** a chamada
 * vai (esquema, usuário, host, porta)?
 *
 * Exigir `https://` literal já barrava `{{base}}/x`, mas deixava passar
 * `https://{{host}}/x` — que é o mesmo problema com outra roupa: o destino
 * saindo do que a pessoa digitou no WhatsApp. A recusa de endereço interno do
 * servidor ainda barraria rede privada, mas quem conversa passaria a apontar a
 * nossa infraestrutura para qualquer host externo que quisesse.
 *
 * Depois da primeira barra é caminho e consulta, e ali variável é o uso normal
 * e desejado — `/pedido/{{codigo}}`.
 */
function temVariavelNoHost(url: string): boolean {
  const limpa = url.trim()
  const depoisDoEsquema = limpa.indexOf('://')

  // Sem `://`, a URL inteira ainda é candidata a host. `URL_INSEGURA` cobre o
  // caso, mas variável aqui também é problema — e este erro explica melhor.
  const inicio = depoisDoEsquema === -1 ? 0 : depoisDoEsquema + 3
  const fim = limpa.slice(inicio).search(/[/?#]/)
  const autoridade = fim === -1 ? limpa.slice(inicio) : limpa.slice(inicio, inicio + fim)

  return limpa.slice(0, inicio).includes('{{') || autoridade.includes('{{')
}
