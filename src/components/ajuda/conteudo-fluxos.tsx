import { DESCRICOES, ICONES, NOMES } from '@/core/flow/blocos'
import { MAX_TENTATIVAS, PALAVRAS_ESCAPE } from '@/core/engine/executar'
import { EXPLICACAO_DO_PAPEL, PAPEIS_DO_NUMERO, ROTULO_DO_PAPEL } from '@/core/papeis-do-numero'
import { EXEMPLO_PADRONIZADO, NOME_DO_FORMATO, PEDIDO_PADRAO } from '@/core/flow/resposta'
import type { TipoNo } from '@/core/flow/schema'
import {
  Bloco,
  Campo,
  Cel,
  Cod,
  Codigo,
  Conversa,
  Espelho,
  Linha,
  Nota,
  Secao,
  Sub,
  Tabela,
  Var,
  Zap,
} from './pecas'

/**
 * As seções sobre automação — o miolo da Ajuda.
 *
 * **Quase nada aqui é escrito à mão duas vezes.** Os nomes dos blocos, as
 * palavras de escape, os quatro papéis do número, os formatos de resposta e as
 * frases padrão de erro são importados de `core/`. É a diferença entre uma
 * página de ajuda e uma página que fala de um produto que já mudou: quando
 * alguém acrescentar um formato de resposta, a tabela daqui cresce sozinha.
 */

/** A ordem da barra de blocos do editor, para a Ajuda listar na mesma ordem. */
const ORDEM_DOS_BLOCOS: TipoNo[] = [
  'mensagem',
  'midia',
  'pergunta',
  'condicao',
  'salvar-campo',
  'etapa',
  'ir-fluxo',
  'ia',
  'handoff',
  'http',
]

/** Quando usar cada bloco, em uma frase — o que a barra do editor não cabe. */
const QUANDO_USAR: Record<TipoNo, string> = {
  mensagem:
    'Falar sem esperar resposta. Um bloco só manda várias mensagens em sequência, com pausa, foto e "guardar" no meio.',
  midia: 'Mandar a tabela de preços, a foto do estúdio, o PDF do contrato.',
  pergunta:
    'Sempre que a conversa precisa de algo da pessoa: um texto livre, uma data, ou uma escolha entre botões.',
  condicao: 'Separar o caminho de quem já é cliente do caminho de quem chegou agora.',
  'salvar-campo': 'Marcar algo no contato sem perguntar nada — a origem, o plano, o interesse.',
  etapa: 'Empurrar o cartão da pessoa no quadro quando ela agenda, desmarca ou fecha.',
  'ir-fluxo':
    'Mandar quem falou de fisioterapia para o fluxo de fisioterapia, sem duplicar o desenho.',
  ia: 'Responder pergunta aberta usando o contexto do negócio. Nunca para dado que precisa estar certo.',
  handoff: 'Entregar a conversa para a equipe. É o final honesto de todo fluxo.',
  http: 'Consultar ou gravar no sistema do cliente: a agenda, o CRM, a planilha.',
}

export function SecaoComoFunciona() {
  return (
    <Secao
      id="como-funciona"
      etiqueta="Comece por aqui"
      titulo="O caminho que uma mensagem faz"
      chamada={
        <>
          Alguém escreve no WhatsApp do seu cliente. O AutoFluxos decide qual automação atende,
          executa os blocos um a um, e — quando o desenho manda — entrega a conversa para uma
          pessoa. Tudo o que você vai ler aqui é um pedaço desse caminho.
        </>
      }
    >
      <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            titulo: 'Chega a mensagem',
            texto:
              'O número do cliente recebe. O AutoFluxos já sabe o telefone e o nome de perfil de quem escreveu.',
          },
          {
            titulo: 'Escolhe a porta',
            texto:
              'Campanha, palavra-chave ou papel do número: é aqui que se decide qual automação vai atender.',
          },
          {
            titulo: 'Roda os blocos',
            texto:
              'Pergunta, guarda, consulta a agenda, ramifica. Cada resposta vira variável para o bloco seguinte.',
          },
          {
            titulo: 'Passa adiante',
            texto:
              'A conversa vai para a fila do Inbox, ou termina com o horário marcado. Nunca fica no vácuo.',
          },
        ].map((etapa, i) => (
          <li key={etapa.titulo} className="app-card relative p-4">
            <span
              aria-hidden
              className="font-mono text-[11px] font-bold tracking-[0.1em] text-accent"
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <strong className="mt-1.5 block text-[13.5px] font-bold text-ink">{etapa.titulo}</strong>
            <p className="mt-1 text-[12.5px] leading-[1.6]">{etapa.texto}</p>
          </li>
        ))}
      </ol>

      <Nota tom="dica" titulo="O bot nunca fica com a conversa presa">
        <p>
          Estas {PALAVRAS_ESCAPE.length} frases tiram a pessoa de qualquer ponto do fluxo e chamam a
          equipe:{' '}
          {PALAVRAS_ESCAPE.map((palavra, i) => (
            <span key={palavra}>
              {i > 0 && ', '}
              <Cod>{palavra}</Cod>
            </span>
          ))}
          . Funcionam de dentro de qualquer pergunta, sem você desenhar nada, e ganham até de uma
          palavra-chave que você tenha cadastrado.
        </p>
      </Nota>
    </Secao>
  )
}

export function SecaoBlocos() {
  return (
    <Secao
      id="blocos"
      etiqueta="O vocabulário"
      titulo="Os dez blocos, e quando usar cada um"
      chamada={
        <>
          Você arrasta um bloco da barra da esquerda para o desenho e liga a bolinha de saída de um
          na entrada do outro. <strong className="text-soft">A setinha que você arrasta já é a
          ramificação</strong> — não existe tela escondida para configurar caminho.
        </>
      }
    >
      <ul className="grid gap-2.5 md:grid-cols-2">
        {ORDEM_DOS_BLOCOS.map((tipo) => (
          <li key={tipo} className="app-card p-4">
            <p className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex size-7 items-center justify-center rounded-lg bg-white/[0.05] text-[14px] text-soft"
              >
                {ICONES[tipo]}
              </span>
              <strong className="text-[14px] font-bold text-ink">{NOMES[tipo]}</strong>
              <span className="font-mono text-[10.5px] text-dim">{DESCRICOES[tipo]}</span>
            </p>
            <p className="mt-2 text-[12.5px] leading-[1.6]">{QUANDO_USAR[tipo]}</p>
          </li>
        ))}
      </ul>

      <Nota tom="atencao" titulo="A IA responde por probabilidade; horário é fato">
        <p>
          Use o bloco de <strong className="text-soft">IA</strong> para entender o que a pessoa
          quis dizer, nunca para informar o que existe. Perguntada sobre vaga, ela inventa uma que
          não existe — e o erro só aparece com a aluna já no estúdio. Quem responde “que horas tem
          livre” é o bloco de {NOMES.http} lendo a agenda.
        </p>
      </Nota>
    </Secao>
  )
}

export function SecaoEntrada() {
  return (
    <Secao
      id="entrada"
      etiqueta="A porta"
      titulo="Como o sistema decide qual automação atende"
      chamada={
        <>
          Um número pode ter várias automações ligadas. Quando chega mensagem, esta ordem decide — e
          ela é fixa, não depende de qual você cadastrou primeiro.
        </>
      }
    >
      <ol className="space-y-2.5">
        {[
          {
            nome: 'Palavra de escape',
            texto:
              'Ganha de tudo. Quem pediu uma pessoa recebe uma pessoa, mesmo no meio de uma pergunta.',
          },
          {
            nome: 'Campanha',
            texto:
              'A frase do anúncio, comparada com a mensagem inteira. Vem antes da palavra-chave para que um “contém” do cliente não sequestre a porta que ele está pagando para manter aberta.',
          },
          {
            nome: 'Palavra-chave',
            texto:
              'A frase que você cadastrou em Automações → Palavras-chave. Desempate: “É” ganha de “Contém”, e a frase mais longa ganha da mais curta.',
          },
          {
            nome: 'Papel do número',
            texto: 'Não casou nada acima? Então vale o papel configurado na tela do número.',
          },
        ].map((porta, i) => (
          <li key={porta.nome} className="app-card flex gap-3.5 p-4">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] font-mono text-[12px] font-bold text-dim"
            >
              {i + 1}
            </span>
            <p className="min-w-0">
              <strong className="text-[13.5px] font-bold text-ink">{porta.nome}</strong>
              <span className="mt-0.5 block text-[12.5px] leading-[1.6]">{porta.texto}</span>
            </p>
          </li>
        ))}
      </ol>

      <Sub>Os quatro papéis de um número</Sub>
      <Tabela cabecalho={['Papel', 'Quando roda']}>
        {PAPEIS_DO_NUMERO.map((papel) => (
          <Linha key={papel}>
            <Cel forte>{ROTULO_DO_PAPEL[papel]}</Cel>
            <Cel>{EXPLICACAO_DO_PAPEL[papel]}</Cel>
          </Linha>
        ))}
      </Tabela>

      <Nota tom="atencao" titulo="Automação sem versão publicada não atende">
        <p>
          Desenhar não põe nada no ar. Enquanto você não clicar em{' '}
          <strong className="text-soft">Publicar</strong>, o número continua respondendo pela versão
          anterior — ou não respondendo, se nunca houve uma. E o interruptor de cada automação
          desliga o desenho sem apagá-lo.
        </p>
      </Nota>
    </Secao>
  )
}

export function SecaoVariaveis() {
  return (
    <Secao
      id="variaveis"
      etiqueta="A memória da conversa"
      titulo="Variáveis: o que o fluxo já sabe, e o que ele aprende"
      chamada={
        <>
          Uma variável é um valor que a conversa guardou e que você reusa escrevendo{' '}
          <Var>nome</Var> em qualquer campo de texto — mensagem, endereço de API, corpo do pedido.
          Use o botão de variável ao lado do campo em vez de digitar: ele lista o que existe
          <em> naquele ponto</em> do desenho.
        </>
      }
    >
      <Sub>Duas nascem antes da primeira pergunta</Sub>
      <Tabela cabecalho={['Variável', 'De onde vem', 'Cuidado']}>
        <Linha>
          <Cel forte>
            <Var>telefone</Var>
          </Cel>
          <Cel>
            O número de quem está escrevendo, com país e DDD e sem máscara —{' '}
            <Cod>5544998887766</Cod>.
          </Cel>
          <Cel>É o formato que a Verandi e a Cloud API esperam. Não formate antes de mandar.</Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Var>nome</Var>
          </Cel>
          <Cel>
            O nome do perfil do WhatsApp. Se alguém da equipe corrigiu o nome no contato, vence o
            corrigido.
          </Cel>
          <Cel>
            Vem em branco com frequência, e às vezes vem “iPhone de Ana”. Não confie nele para
            identificar ninguém.
          </Cel>
        </Linha>
      </Tabela>

      <p>
        Todo o resto você cria: uma <strong className="text-soft">{NOMES.pergunta}</strong> guardando
        a resposta, um <strong className="text-soft">{NOMES['salvar-campo']}</strong> registrando um
        valor fixo, ou um <strong className="text-soft">{NOMES.http}</strong> mapeando um pedaço da
        resposta da API. O nome não tem espaço nem acento: <Cod>valor_estimado</Cod> serve,{' '}
        <Cod>valor estimado</Cod> não.
      </p>

      <Nota tom="atencao" titulo="Variável escrita antes de existir chega vazia">
        <p>
          Se o bloco que preenche <Var>pessoa_id</Var> está <em>depois</em> do bloco que a usa, a
          chamada sai com o campo em branco, a API responde 200, e nada estoura em lugar nenhum. É o
          erro mais caro do produto porque ele não faz barulho: confira sempre se a seta vem antes.
        </p>
      </Nota>
    </Secao>
  )
}

export function SecaoPerguntas() {
  return (
    <Secao
      id="perguntas"
      etiqueta="O bloco mais importante"
      titulo="Pergunta: rótulo, valor e padrão são três coisas"
      chamada={
        <>
          Uma pergunta pode guardar <strong className="text-soft">três variáveis diferentes</strong>{' '}
          da mesma resposta. Parece exagero até a primeira vez que você manda “07:00” para uma API
          que queria um identificador — e o pedido falha com tudo parecendo certo na tela.
        </>
      }
    >
      <Tabela cabecalho={['Campo do painel', 'O que guarda', 'Para que serve']}>
        <Linha>
          <Cel forte>Guardar em</Cel>
          <Cel>
            O <strong className="text-soft">rótulo</strong>: o texto do botão clicado, ou o que a
            pessoa digitou. <Cod>07:00</Cod>
          </Cel>
          <Cel>Escrever de volta na conversa: “Sua aula está marcada para as {'{{horario}}'}”.</Cel>
        </Linha>
        <Linha>
          <Cel forte>Guardar o valor em</Cel>
          <Cel>
            O <strong className="text-soft">valor</strong> pareado com aquele rótulo.{' '}
            <Cod>a41f-…-9c2b</Cod>
          </Cel>
          <Cel>Mandar para a API. É o que a agenda entende; o rótulo, não.</Cel>
        </Linha>
        <Linha>
          <Cel forte>Guardar padronizado em</Cel>
          <Cel>
            A resposta livre <strong className="text-soft">normalizada</strong>: a pessoa escreveu{' '}
            <Cod>21/08/2026</Cod> e aqui fica <Cod>2026-08-21</Cod>.
          </Cel>
          <Cel>Mandar para a API sem depender de como a pessoa digitou.</Cel>
        </Linha>
      </Tabela>

      <Espelho
        conversa={
          <Conversa titulo="Ana · 44 99888-7766">
            <Zap botoes={['07:00', '10:00', '15:00']}>
              Estes são os horários livres em 21/08/2026. Qual fica melhor?
            </Zap>
            <Zap de="pessoa">07:00</Zap>
            <Zap>Prontinho! ✅ Sua aula está marcada para *21/08/2026 às 07:00*.</Zap>
          </Conversa>
        }
        desenho={
          <>
            <Bloco tipo="pergunta" titulo="Pergunta · o horário" saidas={['escolheu', 'veio vazia']}>
              <Campo rotulo="texto">Estes são os horários livres em {'{{dia_escrito}}'}…</Campo>
              <Campo rotulo="opções de">horarios</Campo>
              <Campo rotulo="valores de">horarios_id</Campo>
              <Campo rotulo="guardar em">horario</Campo>
              <Campo rotulo="guardar o valor em">sessao_id</Campo>
            </Bloco>
            <Bloco tipo="http" titulo="Serviços externos · marcar">
              <Campo rotulo="método">POST /participacoes</Campo>
              <Campo rotulo="corpo">{'{ "sessaoId": "{{sessao_id}}" }'}</Campo>
            </Bloco>
          </>
        }
        nota={
          <>
            A mensagem final usa <Var>horario</Var>, que a pessoa reconhece. O pedido usa{' '}
            <Var>sessao_id</Var>, que a agenda reconhece. Trocar os dois é o erro clássico.
          </>
        }
      />

      <Sub>As saídas de uma pergunta</Sub>
      <p>
        Com opções desenhadas por você, cada opção vira uma saída — arraste dali para onde aquele
        botão leva. Com opções que vêm de uma variável, as saídas são fixas:{' '}
        <Cod>escolheu</Cod> e <Cod>veio vazia</Cod>. E toda pergunta com prazo ganha a saída{' '}
        <Cod>timeout</Cod>.
      </p>
      <Nota tom="dica" titulo="Ligue sempre a saída “veio vazia”">
        <p>
          Lista que vem de fora vem vazia com frequência: o dia não tem vaga, a API não respondeu
          nada. Sem essa saída ligada, a conversa para numa pergunta sem resposta possível.
        </p>
      </Nota>
    </Secao>
  )
}

export function SecaoDatas() {
  return (
    <Secao
      id="datas"
      etiqueta="A dúvida número um"
      titulo="Como fazer o bot entender datas e horários"
      chamada={
        <>
          Escolha um <strong className="text-soft">formato</strong> na pergunta. A partir daí o bot
          só aceita resposta que cabe naquele formato, e guarda uma versão padronizada pronta para
          mandar à agenda.
        </>
      }
    >
      <Espelho
        conversa={
          <Conversa titulo="Ana · 44 99888-7766">
            <Zap>{'Para quando você quer agendar?\nMe manda a data — por exemplo: *21/08/2026*'}</Zap>
            <Zap de="pessoa">semana que vem</Zap>
            <Zap>
              Desculpe, pode escrever novamente citando dia / mês / ano? Exemplo: *21/08/2026*
            </Zap>
            <Zap de="pessoa">21/08/2026</Zap>
          </Conversa>
        }
        desenho={
          <Bloco tipo="pergunta" titulo="Pergunta · a data" saidas={['segue', 'timeout']}>
            <Campo rotulo="formato">Data</Campo>
            <Campo rotulo="guardar em">dia_escrito → 21/08/2026</Campo>
            <Campo rotulo="guardar padronizado em">dia → 2026-08-21</Campo>
            <Campo rotulo="quando não entender">Desculpe, pode escrever novamente…</Campo>
            <Campo rotulo="prazo">60 minutos</Campo>
          </Bloco>
        }
        nota={
          <>
            Recusar não é erro: o bot fica parado na mesma pergunta, dizendo o que espera. Depois de{' '}
            {MAX_TENTATIVAS} tentativas seguidas sem entender, a conversa vai para uma pessoa.
          </>
        }
      />

      <Sub>O que cada formato aceita</Sub>
      <Tabela cabecalho={['Formato', 'A pessoa pode escrever', 'Fica guardado como']}>
        <Linha>
          <Cel forte>{NOME_DO_FORMATO.data}</Cel>
          <Cel>
            <Cod>21/08/2026</Cod>, <Cod>21-08-2026</Cod>, <Cod>21.08.2026</Cod>,{' '}
            <Cod>2026-08-21</Cod>
          </Cel>
          <Cel>
            <Cod>{EXEMPLO_PADRONIZADO.data}</Cod>
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>{NOME_DO_FORMATO.hora}</Cel>
          <Cel>
            <Cod>7h</Cod>, <Cod>7h00</Cod>, <Cod>07:00</Cod>, <Cod>7 00</Cod>, <Cod>19h30</Cod>
          </Cel>
          <Cel>
            <Cod>{EXEMPLO_PADRONIZADO.hora}</Cod>
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>{NOME_DO_FORMATO.numero}</Cel>
          <Cel>
            <Cod>1.250,50</Cod>, <Cod>1250.5</Cod>, <Cod>R$ 1.250</Cod>
          </Cel>
          <Cel>
            <Cod>{EXEMPLO_PADRONIZADO.numero}</Cod>
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>{NOME_DO_FORMATO.telefone}</Cel>
          <Cel>
            <Cod>(44) 99888-7766</Cod>, <Cod>44998887766</Cod>
          </Cel>
          <Cel>
            <Cod>{EXEMPLO_PADRONIZADO.telefone}</Cod>
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>{NOME_DO_FORMATO.email}</Cel>
          <Cel>Precisa ter arroba, domínio com ponto e nenhum espaço.</Cel>
          <Cel>
            <Cod>{EXEMPLO_PADRONIZADO.email}</Cod> (minúsculo)
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>{NOME_DO_FORMATO.cpf}</Cel>
          <Cel>Com ou sem pontuação. O dígito verificador é conferido de verdade.</Cel>
          <Cel>
            <Cod>{EXEMPLO_PADRONIZADO.cpf}</Cod>
          </Cel>
        </Linha>
      </Tabela>

      <Nota tom="atencao" titulo="O ano de quatro dígitos é obrigatório, de propósito">
        <p>
          <Cod>21/08</Cod> é recusado. Quem remarca aula em dezembro e escreve <Cod>05/01</Cod> quer
          janeiro do ano que vem, e adivinhar acerta metade das vezes — a outra metade é um
          agendamento no mês errado que ninguém vê até a pessoa aparecer. Pedir o ano custa uma
          frase na conversa.
        </p>
        <p>
          Pelo mesmo motivo, <strong className="text-soft">“amanhã” não é data</strong>. Se você
          quiser oferecer atalhos, desenhe-os como botões (“Hoje”, “Amanhã”, “Escolher a data”) e
          resolva cada um com o seu próprio caminho.
        </p>
      </Nota>

      <Nota tom="dica" titulo="Escreva o exemplo na própria pergunta">
        <p>
          A frase padrão do sistema já traz um: “{PEDIDO_PADRAO.data}”. Você pode trocá-la no campo{' '}
          <strong className="text-soft">quando não entender</strong> — mas mantenha a forma: diga o
          que falta e mostre um exemplo. “Formato inválido” não ensina ninguém a responder certo.
        </p>
      </Nota>

      <Sub>E o 31 de fevereiro?</Sub>
      <p>
        Recusado. O dia é conferido contra o mês, e ano bissexto é levado em conta — <Cod>29/02/2028</Cod>{' '}
        passa, <Cod>29/02/2027</Cod> não.
      </p>
    </Secao>
  )
}

export function SecaoListas() {
  return (
    <Secao
      id="listas"
      etiqueta="Da API para o menu"
      titulo="Transformar uma lista da API em botões"
      chamada={
        <>
          Toda agenda, todo CRM e toda planilha devolvem lista. O bloco de {NOMES.http} achata essa
          lista numa variável, e a {NOMES.pergunta} transforma a variável em menu.
        </>
      }
    >
      <Codigo titulo="o que a agenda respondeu">{`{
  "livres": [
    { "data": "2026-08-21", "hora": "07:00", "sessaoId": "a41f…", "profissional": "Carol" },
    { "data": "2026-08-21", "hora": "10:00", "sessaoId": "b83c…", "profissional": "Carol" },
    { "data": "2026-08-21", "hora": "15:00", "sessaoId": "c92d…", "profissional": "Rafa"  }
  ]
}`}</Codigo>

      <p>
        No bloco de {NOMES.http}, em <strong className="text-soft">mapear</strong>, o caminho{' '}
        <Cod>livres[].hora</Cod> quer dizer <em>entre na lista e pegue a hora de cada item</em>. O
        resultado é uma variável com os valores juntos por ponto e vírgula:
      </p>

      <Tabela cabecalho={['Caminho', 'Variável', 'Valor guardado']}>
        <Linha>
          <Cel forte>
            <Cod>livres[].hora</Cod>
          </Cel>
          <Cel>
            <Var>horarios</Var>
          </Cel>
          <Cel>
            <Cod>07:00;10:00;15:00</Cod>
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Cod>livres[].sessaoId</Cod>
          </Cel>
          <Cel>
            <Var>horarios_id</Var>
          </Cel>
          <Cel>
            <Cod>a41f…;b83c…;c92d…</Cod>
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Cod>livres[].profissional</Cod>
          </Cel>
          <Cel>
            <Var>horarios_prof</Var>
          </Cel>
          <Cel>
            <Cod>Carol;Carol;Rafa</Cod>
          </Cel>
        </Linha>
      </Tabela>

      <p>
        Na {NOMES.pergunta} seguinte: <strong className="text-soft">opções de</strong> ={' '}
        <Var>horarios</Var> (o que a pessoa lê) e <strong className="text-soft">valores de</strong> ={' '}
        <Var>horarios_id</Var> (o que a API entende). O casamento é <em>por posição</em>: o primeiro
        rótulo vale o primeiro valor.
      </p>

      <Nota tom="erro" titulo="“Sem repetir” desalinha listas pareadas">
        <p>
          A opção <strong className="text-soft">sem repetir</strong> existe para um caso só: montar
          um menu de <em>dias</em>, onde <Cod>livres[].data</Cod> devolve a mesma data uma vez por
          horário e “21/08” apareceria três vezes.
        </p>
        <p>
          Nunca a marque numa lista pareada com outra. Tirar um item de um lado empurra os valores
          do outro, e o agendamento vai para o horário de outra pessoa — sem erro nenhum aparecer.
        </p>
      </Nota>

      <Nota tom="dica" titulo="“Contar quantos” guarda o número, e não a lista">
        <p>
          Marque <strong className="text-soft">contar quantos</strong> quando a conversa precisar
          dizer <em>quantos</em>, e não <em>quais</em>: “você tem <Var>3</Var> aulas para repor”.
          Sem ele a variável traz a lista inteira, e a mensagem sai com as datas todas no meio da
          frase.
        </p>
        <p>
          Ele também serve para ramificar: uma {NOMES.condicao} com{' '}
          <strong className="text-soft">igual</strong> <Cod>0</Cod> separa quem não tem nada de quem
          tem, sem o bot precisar perguntar.
        </p>
      </Nota>

      <Nota tom="atencao" titulo="Limites do WhatsApp que o desenho precisa respeitar">
        <p>
          Até 3 opções, a Meta entrega como botões; de 4 a 10, como lista suspensa. Acima de 10 a
          mensagem é recusada inteira. E o rótulo tem 20 caracteres — “Terça-feira às 07:00 com a
          Carol” não cabe.
        </p>
      </Nota>
    </Secao>
  )
}

export function SecaoQuandoDaErrado() {
  return (
    <Secao
      id="erros"
      etiqueta="O plano B"
      titulo="Quando a chamada falha, o prazo estoura ou a vaga acaba"
      chamada={
        <>
          Nenhum desses casos é defeito: são partes normais de uma conversa real. O que muda é o que
          você desenhou para eles.
        </>
      }
    >
      <Sub>Se a chamada falhar</Sub>
      <p>
        Todo bloco de {NOMES.http} tem o campo <strong className="text-soft">se falhar</strong>, com
        duas escolhas:
      </p>
      <Tabela cabecalho={['Escolha', 'O que acontece', 'Quando usar']}>
        <Linha>
          <Cel forte>Passar para uma pessoa</Cel>
          <Cel>A conversa entra na fila do Inbox com o motivo registrado.</Cel>
          <Cel>
            Sempre que o resultado da chamada <em>é o assunto</em>: marcar, desmarcar, buscar
            horário. Sem ele não há o que dizer.
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>Seguir em frente</Cel>
          <Cel>O fluxo continua com a variável vazia.</Cel>
          <Cel>
            Enriquecimento opcional: mandar o lead para o CRM, escrever numa planilha. O dado já está
            aqui; não ter chegado lá é problema de sincronia, não de atendimento.
          </Cel>
        </Linha>
      </Tabela>

      <Sub>Se a vaga encher entre o menu e o clique</Sub>
      <p>
        Acontece, e é o motivo de a vaga ser conferida <strong className="text-soft">na hora de
        gravar</strong> e não na hora de montar o menu. O bloco de marcar falha, e o certo é{' '}
        <strong className="text-soft">passar para uma pessoa</strong>: prometer um horário que
        encheu é o pior desfecho possível, e quem responde por uma vaga é quem está no balcão.
      </p>

      <Sub>Se a pessoa sumir no meio</Sub>
      <p>
        Toda pergunta aceita um <strong className="text-soft">prazo</strong> em minutos, até 24
        horas. Estourado o prazo, a conversa sai pela saída <Cod>timeout</Cod>. Se você não ligar
        nada nessa saída, a conversa vai para uma pessoa em vez de encerrar calada — quem parou de
        responder no meio de uma triagem é justamente o lead que vale resgatar.
      </p>

      <Nota tom="atencao" titulo="Por que o teto é 24 horas">
        <p>
          É a janela do WhatsApp: a Meta só deixa mandar texto livre até 24h depois da{' '}
          <em>última mensagem que a pessoa mandou</em>. Um prazo maior não seria atrasado — seria
          nunca entregue. Vale igual para os passos de uma sequência de acompanhamento.
        </p>
      </Nota>

      <Sub>Como testar sem gastar conversa de verdade</Sub>
      <p>
        Use a aba <strong className="text-soft">Testar</strong> do editor. Ela roda exatamente
        o mesmo motor da produção — mesmas regras de escape, de tentativa e de formato — mas sem
        mandar nada para o WhatsApp de ninguém.
      </p>
    </Secao>
  )
}
