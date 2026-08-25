import { NOMES } from '@/core/flow/blocos'
import { MAX_TENTATIVAS } from '@/core/engine/executar'
import { Cel, Cod, Duvida, Linha, Nota, Secao, Sub, Tabela, Var } from './pecas'

/**
 * As dúvidas — escritas a partir do que já foi errado de verdade.
 *
 * Cada pergunta daqui corresponde a um comentário de código que existe porque
 * alguém tropeçou: o `{{horario}}` no lugar do id, o "sem repetir" desalinhando
 * listas pareadas, a data sem ano, o preset que não é referência viva. Uma FAQ
 * inventada lista as perguntas que o autor imagina; esta lista as que custaram
 * uma tarde.
 *
 * Fechadas por padrão e sem JavaScript (`<details>`): a página é para varrer com
 * o olho e abrir uma.
 */

export function SecaoDuvidas() {
  return (
    <Secao
      id="duvidas"
      etiqueta="Dúvidas frequentes"
      titulo="O que costuma travar"
      chamada="Agrupadas pelo momento em que aparecem. Abra a que combina com o seu sintoma."
    >
      <Sub>Desenhar e publicar</Sub>
      <div className="space-y-2">
        <Duvida p="Desenhei tudo e o bot não responde. O que faltou?">
          <p>Confira nesta ordem, que é a ordem em que costuma faltar:</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>
              A automação foi <strong className="text-soft">publicada</strong>? Salvar não publica.
            </li>
            <li>
              O interruptor dela está <strong className="text-soft">ligado</strong>?
            </li>
            <li>
              O número tem essa automação em algum <strong className="text-soft">papel</strong> — ou
              uma palavra-chave apontando para ela?
            </li>
            <li>
              A conversa já está <strong className="text-soft">assumida</strong> por alguém da
              equipe? O bot cala quando alguém assume.
            </li>
          </ol>
        </Duvida>

        <Duvida p="Qual a diferença entre salvar e publicar?">
          <p>
            Salvar guarda o rascunho. Publicar cria uma{' '}
            <strong className="text-soft">versão congelada</strong>, e é ela que atende.
          </p>
          <p>
            Versão publicada é imutável de propósito: uma conversa que começou às 14h continua
            rodando o desenho de 14h até terminar. É por isso que publicar no meio do expediente não
            quebra quem está conversando.
          </p>
        </Duvida>

        <Duvida p="Publiquei uma versão ruim. Dá para voltar?">
          <p>
            Dá. No editor, em <strong className="text-soft">Versões</strong>, você vê o histórico e
            restaura uma anterior. Quem já está no meio de uma conversa termina pela versão em que
            começou.
          </p>
        </Duvida>

        <Duvida p="Mudei um preset de integração. Os fluxos antigos mudam junto?">
          <p>
            Não, e isso é intencional. O preset <strong className="text-soft">copia</strong> os
            valores para o bloco no momento em que você o escolhe; a partir dali é um bloco comum.
          </p>
          <p>
            Se fosse uma referência viva, mudar um endereço amanhã mudaria por baixo o que uma
            conversa em andamento vai chamar.
          </p>
        </Duvida>

        <Duvida p="Posso usar o mesmo desenho em dois clientes?">
          <p>
            Sim: no editor, <strong className="text-soft">Compartilhar</strong> gera um link com
            prazo, e quem abrir importa o desenho para a conta dele. As credenciais{' '}
            <strong className="text-soft">não vão junto</strong> — cada conta aponta os blocos para
            as suas.
          </p>
        </Duvida>
      </div>

      <Sub>Perguntas, datas e menus</Sub>
      <div className="space-y-2">
        <Duvida p="O bot marcou no horário errado. Como isso acontece?">
          <p>
            Quase sempre é <strong className="text-soft">“sem repetir” numa lista pareada</strong>.
            Se <Var>horarios</Var> tem “sem repetir” e <Var>horarios_id</Var> não, tirar um horário
            repetido de uma lista empurra os identificadores da outra — o segundo rótulo passa a
            valer o terceiro identificador.
          </p>
          <p>
            Marque “sem repetir” só em lista solta, como o menu de dias. Nunca nas que andam em par.
          </p>
        </Duvida>

        <Duvida p="Mandei {{horario}} para a API e o pedido falhou. Por quê?">
          <p>
            Porque <Cod>07:00</Cod> é o que a pessoa lê, e a agenda quer o identificador daquele
            horário. Use a variável de <strong className="text-soft">guardar o valor em</strong> —{' '}
            <Var>sessao_id</Var> na receita de marcar — e não a de guardar em.
          </p>
        </Duvida>

        <Duvida p="A pessoa escreveu “amanhã” e o bot não entendeu.">
          <p>
            Correto: o formato <strong className="text-soft">Data</strong> exige dia, mês e ano de
            quatro dígitos. O bot repete o pedido com um exemplo e continua parado na mesma pergunta.
          </p>
          <p>
            Se “amanhã” é comum no seu caso, ofereça botões — “Hoje”, “Amanhã”, “Escolher a data” — e
            resolva cada um por um caminho próprio.
          </p>
        </Duvida>

        <Duvida p="Dá para aceitar 21/08 sem o ano?">
          <p>
            Não, e o motivo é caro: quem remarca em dezembro e escreve <Cod>05/01</Cod> quer janeiro
            do ano seguinte. Adivinhar acerta metade das vezes, e a outra metade é um agendamento no
            ano errado que só aparece quando a pessoa não vem.
          </p>
        </Duvida>

        <Duvida p="O bot fica repetindo a pergunta para sempre?">
          <p>
            Não. Depois de {MAX_TENTATIVAS} respostas seguidas que ele não entendeu, a conversa vai
            para a fila do Inbox com esse motivo registrado. Vale tanto para formato quanto para
            menu que ninguém acerta.
          </p>
        </Duvida>

        <Duvida p="Meu menu tem 14 opções e a mensagem não chega.">
          <p>
            O WhatsApp aceita no máximo <strong className="text-soft">10 itens</strong> numa lista
            (e 3 quando são botões). Acima disso a Meta recusa a mensagem inteira — a pessoa não
            recebe nada.
          </p>
          <p>
            Quebre em dois passos: pergunte o período primeiro (manhã / tarde), depois o horário
            dentro dele.
          </p>
        </Duvida>

        <Duvida p="Meu rótulo aparece cortado.">
          <p>
            São 20 caracteres por opção. “Terça 07:00” cabe; “Terça-feira às 07:00 com a Carol” não.
            Ponha o detalhe no texto da pergunta, não no botão.
          </p>
        </Duvida>

        <Duvida p="Um dia sem vaga trava a conversa.">
          <p>
            Ligue a saída <Cod>veio vazia</Cod> da pergunta. Ela existe exatamente para isso, e o
            desenho certo é oferecer outro dia ou a fila de espera.
          </p>
        </Duvida>
      </div>

      <Sub>Verandi e integrações</Sub>
      <div className="space-y-2">
        <Duvida p="O bot está perguntando o nome de quem faz aula há dois anos.">
          <p>
            Falta o bloco de <strong className="text-soft">reconhecer quem está falando</strong> como
            primeiro passo — ou a condição está olhando a variável errada.
          </p>
          <p>
            Ela precisa olhar <Var>encontrado</Var>, que é uma contagem: quando ninguém é encontrado,
            a agenda responde normalmente com <Cod>0</Cod>. Não reconhecer{' '}
            <strong className="text-soft">não é falha</strong> — é o outro caminho da conversa.
          </p>
        </Duvida>

        <Duvida p="A chamada responde “não autorizado”.">
          <p>Três causas, nesta ordem de frequência:</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>O bloco não está apontando para nenhuma credencial.</li>
            <li>
              A credencial foi cadastrada com o tipo errado. A Verandi é <Cod>bearer</Cod>.
            </li>
            <li>A chave foi revogada ou trocada na Verandi. Cadastre a nova no mesmo lugar.</li>
          </ol>
        </Duvida>

        <Duvida p="Preciso cadastrar uma credencial por bloco da Verandi?">
          <p>
            Não — uma por conta. Todos os blocos apontam para a mesma. Ter várias significa vários
            lugares para revogar no dia em que a chave vazar, e é justamente o dia em que ninguém
            lembra de todos.
          </p>
        </Duvida>

        <Duvida p="A pessoa clicou no horário e ele já tinha enchido.">
          <p>
            Comportamento correto: a vaga é conferida{' '}
            <strong className="text-soft">na hora de gravar</strong>, não na hora de montar o menu. O
            bloco de marcar falha e passa a conversa para uma pessoa — quem responde por uma vaga é
            quem está no balcão.
          </p>
        </Duvida>

        <Duvida p="Onde vejo o que a API respondeu?">
          <p>
            Na aba <strong className="text-soft">Testar</strong> do editor: ela faz a chamada
            de verdade e mostra o resultado do mapeamento. É onde se descobre que o caminho é{' '}
            <Cod>livres[].hora</Cod> e não <Cod>horarios[].hora</Cod>.
          </p>
        </Duvida>

        <Duvida p="O AutoFluxos guarda a lista de alunos, presença ou turma?">
          <p>
            Não, e nunca vai guardar. Isso mora na Verandi. Aqui ficam a conversa, o contato e o que
            a conversa coletou. Os dois sistemas conversam por API, e nenhum lê o banco do outro.
          </p>
        </Duvida>

        <Duvida p="Posso ligar em outro sistema que não seja a Verandi?">
          <p>
            Sim. O bloco de {NOMES.http} fala com qualquer API que aceite JSON, e existe um preset de{' '}
            <strong className="text-soft">Webhook</strong> para começar. Se o sistema pedir token,
            cadastre em Credenciais como <Cod>bearer</Cod>.
          </p>
        </Duvida>
      </div>

      <Sub>Atendimento humano</Sub>
      <div className="space-y-2">
        <Duvida p="O bot continuou respondendo depois que assumi a conversa.">
          <p>
            Não deveria: assumir cala o bot naquele contato. Se ainda está falando, confira se o que
            chegou não abriu uma conversa nova por uma palavra-chave — e se a pessoa que assumiu
            ainda está marcada como responsável.
          </p>
        </Duvida>

        <Duvida p="Quero que o bot pare sem chamar ninguém.">
          <p>
            Use o pedaço <strong className="text-soft">Desligar o bot</strong> dentro de um
            bloco de {NOMES.mensagem}. Diferente de {NOMES.handoff}, ele não põe a conversa em fila
            nenhuma: o bot simplesmente para de responder aquele contato.
          </p>
        </Duvida>

        <Duvida p="A pessoa escreveu de madrugada e ficou no vácuo.">
          <p>
            Configure o <strong className="text-soft">horário de atendimento</strong> em
            Configurações. Fora dele, o bot avisa quando a equipe volta em vez de transferir para uma
            fila que ninguém está olhando.
          </p>
        </Duvida>

        <Duvida p="Tentei responder um contato antigo e o painel não deixou.">
          <p>
            É a janela de 24 horas do WhatsApp: texto livre só chega até 24h depois da{' '}
            <strong className="text-soft">última mensagem que a pessoa mandou</strong>. Passado
            disso, só um modelo aprovado pela Meta.
          </p>
        </Duvida>

        <Duvida p="Ninguém percebe quando cai alguém na fila.">
          <p>
            O aviso de fila aparece na barra lateral em qualquer tela do painel, não só no Inbox. E
            confira se quem deveria receber está marcado como{' '}
            <strong className="text-soft">Disponível</strong> — quem esqueceu de voltar de “ausente”
            some da lista de quem pode receber conversa.
          </p>
        </Duvida>
      </div>
    </Secao>
  )
}

export function SecaoDepoisDoFluxo() {
  return (
    <Secao
      id="depois"
      etiqueta="O resto do painel"
      titulo="O que acontece depois que a conversa termina"
      chamada="A automação não é o fim: ela alimenta as telas onde o negócio acompanha a pessoa."
    >
      <Tabela cabecalho={['Onde', 'Para que serve', 'Como o fluxo alimenta']}>
        <Linha>
          <Cel forte>Inbox</Cel>
          <Cel>A fila de quem precisa de gente. Assumir cala o bot naquele contato.</Cel>
          <Cel>
            Todo bloco de {NOMES.handoff}, toda falha marcada como “passa para uma pessoa”, toda
            palavra de escape.
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>Contatos</Cel>
          <Cel>Quem existe, o que se sabe de cada um, o histórico da conversa.</Cel>
          <Cel>
            Cada variável guardada vira campo do contato — pelo {NOMES.pergunta} ou pelo{' '}
            {NOMES['salvar-campo']}.
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>Quadros</Cel>
          <Cel>Em que ponto cada pessoa está: novo, agendado, compareceu, virou aluno.</Cel>
          <Cel>
            O bloco {NOMES.etapa} move o cartão sozinho. Quadro que depende de digitação manual é
            quadro que mente com cara de dado.
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>Etiquetas</Cel>
          <Cel>Marcas soltas para filtrar depois.</Cel>
          <Cel>Aplicadas pela equipe no Inbox, ou pelo fluxo.</Cel>
        </Linha>
        <Linha>
          <Cel forte>Sequências</Cel>
          <Cel>Acompanhar sozinho quem parou no meio.</Cel>
          <Cel>
            Inscrevem por três eventos: atendimento encerrado, etiqueta aplicada, ou o contato
            chegando numa etapa do quadro.
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>Campanhas</Cel>
          <Cel>Saber qual anúncio trouxe qual pessoa.</Cel>
          <Cel>
            A frase que vem preenchida do anúncio abre a automação daquela campanha e fica gravada no
            contato.
          </Cel>
        </Linha>
      </Tabela>

      <Nota tom="dica" titulo="O caso que junta tudo">
        <p>
          O fluxo marca a aula e move o cartão para <em>Aula agendada</em>. Uma sequência escuta essa
          etapa e, se a pessoa não comparecer, manda a mensagem de retomada sozinha — sem ninguém
          lembrar dela.
        </p>
      </Nota>
    </Secao>
  )
}
