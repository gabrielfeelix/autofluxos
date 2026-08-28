import { NOMES } from '@/core/flow/blocos'
import { NOME_DO_GRUPO, PRESETS } from '@/core/presets'
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
  Passo,
  Passos,
  Secao,
  Sub,
  Tabela,
  Var,
  Zap,
} from './pecas'

/**
 * Tudo sobre a Verandi — e a tabela que ninguém tinha onde ler.
 *
 * **A lista de presets e o que cada um traz saem de `core/presets.ts`.** Era a
 * informação mais pedida e a que existia só dentro do código: para saber que
 * `verandi-catalogo` devolve `professores` e `servicos`, era preciso arrastar o
 * bloco, aplicar o preset e ler o campo de mapeamento. Aqui ela é uma tabela, e
 * ela não pode divergir — quem acrescentar um preset acrescenta uma linha aqui
 * sem escrever nada.
 */

const DA_AGENDA = PRESETS.filter((preset) => preset.grupo === 'agenda')

export function SecaoVerandiLigar() {
  return (
    <Secao
      id="verandi"
      etiqueta="A agenda"
      titulo="Ligar a automação na Verandi"
      chamada={
        <>
          A Verandi é a agenda da 4YU — e, do ponto de vista do AutoFluxos, é{' '}
          <strong className="text-soft">um sistema do cliente como qualquer outro</strong>. Nada de
          turma, matrícula ou presença mora aqui: o bot lê e escreve pela API, e o dado fica lá.
        </>
      }
    >
      <Passos>
        <Passo n={1} titulo="Pegue a chave da API na Verandi">
          <p>
            Na Verandi, em <strong className="text-soft">Configurações → Integrações</strong>. É uma
            chave que começa com <Cod>vr_</Cod>. Copie de uma vez: ela costuma não aparecer duas
            vezes.
          </p>
        </Passo>

        <Passo n={2} titulo="Cadastre a chave em Credenciais">
          <p>
            Aqui no AutoFluxos: <strong className="text-soft">Configurações → Credenciais → Nova
            credencial</strong>. Dê um nome que você reconheça (“Agenda”), escolha o tipo{' '}
            <Cod>bearer</Cod> e cole a chave.
          </p>
          <p>
            <strong className="text-soft">Uma credencial por conta, não uma por bloco.</strong> Todos
            os blocos da Verandi usam a mesma — cadastrar várias seria ter vários lugares para
            revogar no dia em que a chave vazar.
          </p>
        </Passo>

        <Passo n={3} titulo="Arraste um bloco de Serviços externos e escolha o preset">
          <p>
            No editor, arraste o bloco <strong className="text-soft">{NOMES.http}</strong>, abra{' '}
            <strong className="text-soft">Usar uma integração pronta</strong> e escolha a gaveta{' '}
            <strong className="text-soft">{NOME_DO_GRUPO.agenda}</strong>. Escolher um preset
            preenche método, endereço, corpo e mapeamento de uma vez.
          </p>
          <p>
            Depois disso é um bloco comum e editável. O preset não fica “ligado”: ele copia os
            valores e sai de cena.
          </p>
        </Passo>

        <Passo n={4} titulo="Aponte o bloco para a credencial">
          <p>
            No campo <strong className="text-soft">credencial</strong> do bloco, escolha a que você
            cadastrou. Não existe campo para digitar o token dentro do fluxo — de propósito: o valor
            nunca entra no desenho, e o desenho publicado é imutável.
          </p>
        </Passo>

        <Passo n={5} titulo="Teste na aba Testar antes de publicar">
          <p>
            A aba <strong className="text-soft">Testar</strong>, no editor, faz as chamadas de verdade. Se a credencial estiver errada, você descobre ali
            — e não com uma aluna esperando resposta.
          </p>
        </Passo>
      </Passos>

      <Nota tom="dica" titulo="Atalho: comece pelo modelo pronto">
        <p>
          Em <strong className="text-soft">Automações → Criar fluxo</strong> existe o modelo{' '}
          <strong className="text-soft">Agendar e remarcar na agenda</strong>, com o fluxo inteiro já
          desenhado: reconhecer quem chegou, cadastrar quem é novo, perguntar o dia, listar
          horários, marcar, e o caminho de quando não há vaga. Falta só apontar a credencial e
          trocar as palavras das mensagens.
        </p>
      </Nota>
    </Secao>
  )
}

export function SecaoVerandiDados() {
  return (
    <Secao
      id="verandi-dados"
      etiqueta="O contrato"
      titulo="Quais informações da Verandi o bot usa"
      chamada={
        <>
          Cada preset é uma chamada com um mapeamento pronto — ele já sabe onde estão os campos na
          resposta e em quais variáveis colocá-los. Esta é a lista completa do que existe hoje.
        </>
      }
    >
      <Tabela cabecalho={['Bloco pronto', 'O que faz', 'Variáveis que ele cria', 'Se falhar']}>
        {DA_AGENDA.map((preset) => (
          <Linha key={preset.id}>
            <Cel forte>{preset.nome.replace('Verandi · ', '')}</Cel>
            <Cel>{preset.resumo}</Cel>
            <Cel>
              {preset.dados.mapear.length === 0 ? (
                <span className="text-dim">nenhuma</span>
              ) : (
                <span className="flex flex-wrap gap-1">
                  {preset.dados.mapear.map((mapa) => (
                    <Var key={mapa.variavel}>{mapa.variavel}</Var>
                  ))}
                </span>
              )}
            </Cel>
            <Cel>{preset.dados.aoFalhar === 'humano' ? 'passa para uma pessoa' : 'segue'}</Cel>
          </Linha>
        ))}
      </Tabela>

      <Sub>O que cada variável carrega</Sub>
      <Tabela cabecalho={['Variável', 'O que é', 'Onde usar']}>
        <Linha>
          <Cel forte>
            <Var>encontrado</Var>
          </Cel>
          <Cel>
            Quantas pessoas com aquele telefone existem na agenda. É <Cod>0</Cod> quando ninguém foi
            encontrado.
          </Cel>
          <Cel>
            Numa {NOMES.condicao}: <Cod>encontrado</Cod> é igual a <Cod>1</Cod> separa quem já é
            aluno de quem chegou agora.
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Var>pessoa_id</Var>
          </Cel>
          <Cel>O identificador da pessoa na agenda.</Cel>
          <Cel>Em todo bloco que marca, desmarca, lê a agenda dela ou entra na fila.</Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Var>nome_na_agenda</Var>
          </Cel>
          <Cel>Como a pessoa está cadastrada na Verandi.</Cel>
          <Cel>
            Nas mensagens. É mais confiável que <Var>nome</Var>, que vem do perfil do WhatsApp.
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Var>dias_livres</Var>
          </Cel>
          <Cel>As datas com alguma vaga no intervalo, sem repetir.</Cel>
          <Cel>Como “opções de” numa pergunta “para quando você quer?”.</Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Var>horarios</Var> · <Var>horarios_id</Var> · <Var>horarios_prof</Var>
          </Cel>
          <Cel>
            Os horários livres de um dia: o que se lê, o identificador de cada um, e quem atende.
            Três listas do mesmo conjunto, na mesma ordem.
          </Cel>
          <Cel>
            Menu de horário: “opções de” = <Var>horarios</Var>, “valores de” ={' '}
            <Var>horarios_id</Var>.
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Var>professores</Var> · <Var>professores_id</Var>
          </Cel>
          <Cel>Quem atende neste negócio, e o identificador de cada um.</Cel>
          <Cel>
            Menu “com qual professor?”. O nome vira botão; o identificador vai para o filtro da
            consulta.
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Var>servicos</Var> · <Var>servicos_id</Var>
          </Cel>
          <Cel>O que se oferece — aula, avaliação, sessão — com os identificadores.</Cel>
          <Cel>Menu “o que você quer marcar?”, quando o negócio tem mais de um serviço.</Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Var>proximas</Var> · <Var>proximas_id</Var>
          </Cel>
          <Cel>O que a pessoa já tem marcado pela frente, e o identificador de cada marcação.</Cel>
          <Cel>
            “Quero desmarcar”: o menu oferece o que ela tem, em vez de pedir um número que ela não
            sabe.
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Var>horario_fixo</Var>
          </Cel>
          <Cel>Os horários recorrentes dela — o mesmo dia e hora toda semana.</Cel>
          <Cel>Responder “quais são os meus horários?”.</Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Var>reposicoes_abertas</Var>
          </Cel>
          <Cel>As faltas avisadas que ainda têm reposição em aberto.</Cel>
          <Cel>Responder “quantas aulas tenho para repor?”.</Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Var>participacao_id</Var>
          </Cel>
          <Cel>O identificador da marcação que acabou de ser criada.</Cel>
          <Cel>Guardar para desmarcar depois, sem precisar procurar de novo.</Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Var>situacao</Var>
          </Cel>
          <Cel>Como a marcação ficou depois de desmarcada — falta avisada, cancelada.</Cel>
          <Cel>
            Confirmar na mensagem o que foi registrado. Desmarcar não apaga nada: a marcação fica no
            histórico, e é isso que preserva a reposição.
          </Cel>
        </Linha>
        <Linha>
          <Cel forte>
            <Var>posicao_na_fila</Var>
          </Cel>
          <Cel>Em que lugar a pessoa ficou na lista de espera daquele horário.</Cel>
          <Cel>Dizer na mensagem. Entrar na fila não reserva nada, e a frase precisa dizer isso.</Cel>
        </Linha>
      </Tabela>

      <Nota tom="atencao" titulo="A Verandi fala o vocabulário de cada conta">
        <p>
          O bloco de <strong className="text-soft">catálogo</strong> traz também como aquele negócio
          chama as coisas: um estúdio diz “aula”, uma clínica diz “sessão”, um salão diz
          “atendimento”. Escreva as mensagens com a palavra da conta — não com a nossa.
        </p>
      </Nota>

      <Nota tom="dica" titulo="A fronteira, em uma frase">
        <p>
          O AutoFluxos guarda o <strong className="text-soft">estado da conversa</strong>: o que foi
          perguntado, o que foi respondido, em que bloco a pessoa está. A Verandi guarda o{' '}
          <strong className="text-soft">estado do negócio</strong>: turma, matrícula, presença,
          reposição. Nenhum dos dois lê o banco do outro.
        </p>
      </Nota>
    </Secao>
  )
}

export function SecaoReceitas() {
  return (
    <Secao
      id="receitas"
      etiqueta="Receitas"
      titulo="Cinco conversas montadas, bloco a bloco"
      chamada="Cada uma é uma sequência curta. Monte na ordem — em todas, o primeiro bloco é reconhecer quem está falando."
    >
      <Sub>1. Marcar uma aula</Sub>
      <Espelho
        conversa={
          <Conversa titulo="Ana · 44 99888-7766">
            <Zap>Oi, *Ana*! 👋 Vamos marcar sua aula?</Zap>
            <Zap>{'Para quando você quer agendar?\nMe manda a data — por exemplo: *21/08/2026*'}</Zap>
            <Zap de="pessoa">21/08/2026</Zap>
            <Zap botoes={['07:00', '10:00', '15:00']}>
              Estes são os horários livres em 21/08/2026. Qual fica melhor?
            </Zap>
            <Zap de="pessoa">07:00</Zap>
            <Zap>Prontinho! ✅ Sua aula está marcada para *21/08/2026 às 07:00*.</Zap>
          </Conversa>
        }
        desenho={
          <>
            <Bloco tipo="http" titulo="1 · reconhecer quem está falando">
              <Campo rotulo="cria">
                <Var>encontrado</Var> <Var>pessoa_id</Var> <Var>nome_na_agenda</Var>
              </Campo>
            </Bloco>
            <Bloco tipo="condicao" titulo="2 · já é aluno?" saidas={['sim', 'não']}>
              <Campo rotulo="condição">encontrado é igual a 1</Campo>
            </Bloco>
            <Bloco tipo="pergunta" titulo="3 · qual dia" saidas={['segue', 'timeout']}>
              <Campo rotulo="formato">Data → guarda dia e dia_escrito</Campo>
            </Bloco>
            <Bloco tipo="http" titulo="4 · horários livres de um dia">
              <Campo rotulo="cria">
                <Var>horarios</Var> <Var>horarios_id</Var>
              </Campo>
            </Bloco>
            <Bloco tipo="pergunta" titulo="5 · qual horário" saidas={['escolheu', 'veio vazia']}>
              <Campo rotulo="valores de">horarios_id → guarda sessao_id</Campo>
            </Bloco>
            <Bloco tipo="http" titulo="6 · marcar no horário escolhido" />
          </>
        }
        nota={
          <>
            O ramo <strong className="text-soft">não</strong> da condição pergunta o nome e usa o
            bloco <em>cadastrar quem ainda não existe</em>, que devolve o mesmo{' '}
            <Var>pessoa_id</Var> — e daí os dois caminhos se juntam no passo 3.
          </>
        }
      />

      <Sub>2. Remarcar</Sub>
      <p>
        Remarcar é <strong className="text-soft">desmarcar e marcar de novo</strong>. Leia a agenda
        da pessoa, ofereça <Var>proximas</Var> como menu com <Var>proximas_id</Var> como valores,
        desmarque a escolhida, e caia no mesmo caminho da receita 1. A falta fica registrada como
        avisada, o que é o que preserva o crédito de reposição.
      </p>

      <Sub>3. “Quais são os professores?”</Sub>
      <Espelho
        conversa={
          <Conversa titulo="Bruno · 44 99777-1122">
            <Zap de="pessoa">quem dá aula de manhã?</Zap>
            <Zap botoes={['Carol', 'Rafa', 'Tanto faz']}>
              Nossos profissionais são a *Carol* e o *Rafa*. Com quem você prefere?
            </Zap>
          </Conversa>
        }
        desenho={
          <>
            <Bloco tipo="http" titulo="catálogo">
              <Campo rotulo="cria">
                <Var>professores</Var> <Var>professores_id</Var> <Var>servicos</Var>{' '}
                <Var>servicos_id</Var>
              </Campo>
            </Bloco>
            <Bloco tipo="pergunta" titulo="com quem?" saidas={['escolheu', 'veio vazia']}>
              <Campo rotulo="opções de">professores</Campo>
              <Campo rotulo="valores de">professores_id</Campo>
              <Campo rotulo="guardar o valor em">profissional_id</Campo>
            </Bloco>
          </>
        }
        nota={
          <>
            Nunca responda isso com o bloco de {NOMES.ia}: a lista de quem atende muda, e a IA
            responderia com o que estava no contexto no dia em que foi escrito.
          </>
        }
      />

      <Sub>4. “Quais são os meus horários?”</Sub>
      <p>
        Um bloco só: <strong className="text-soft">a agenda de uma pessoa</strong>, depois de
        reconhecer. Ele traz <Var>horario_fixo</Var>, <Var>proximas</Var> e{' '}
        <Var>reposicoes_abertas</Var> — e a mensagem seguinte escreve os três. Repare que as listas
        vêm separadas por ponto e vírgula; se quiser uma por linha na mensagem, monte a frase em volta
        delas em vez de esperar formatação.
      </p>

      <Sub>5. Lotou — entrar na fila</Sub>
      <p>
        Ligue a saída <Cod>veio vazia</Cod> da pergunta de horário a uma mensagem que ofereça a fila,
        e use o bloco <strong className="text-soft">entrar na fila de um horário cheio</strong>. Ele
        devolve <Var>posicao_na_fila</Var>. Quando alguém desmarcar, é a Verandi que dispara o aviso.
      </p>
      <Nota tom="erro" titulo="Fila não é reserva — e a mensagem tem que dizer isso">
        <p>
          “Te aviso se abrir” é honesto. “Sua vaga está garantida” não é, e produz a pior conversa
          possível: alguém aparecendo para uma aula em que não está marcada.
        </p>
      </Nota>
    </Secao>
  )
}

export function SecaoOutrosSistemas() {
  const foraDaAgenda = PRESETS.filter((preset) => preset.grupo !== 'agenda')

  return (
    <Secao
      id="outros-sistemas"
      etiqueta="Além da agenda"
      titulo="Planilha, CRM e qualquer outro sistema"
      chamada={
        <>
          O mesmo bloco de {NOMES.http} fala com qualquer coisa que aceite JSON. Estes presets tiram
          da frente o endereço, os cabeçalhos e o mapeamento.
        </>
      }
    >
      <Tabela cabecalho={['Bloco pronto', 'O que faz', 'O que você precisa ter em mãos']}>
        {foraDaAgenda.map((preset) => (
          <Linha key={preset.id}>
            <Cel forte>{preset.nome}</Cel>
            <Cel>{preset.resumo}</Cel>
            <Cel>{preset.exige}</Cel>
          </Linha>
        ))}
      </Tabela>

      <Sub>Se o cliente opera em planilha</Sub>
      <p>
        A planilha precisa ter uma aba chamada <Cod>AutoFluxos</Cod> e um intervalo nomeado por
        consulta, com os valores juntos numa célula, separados por ponto e vírgula:
      </p>
      <Codigo titulo="a célula do intervalo “quarta”">{`07:00;10:00;15:00`}</Codigo>
      <p>
        É exatamente o formato que a pergunta dinâmica lê. Quem escolhe entre o Apps Script e a API
        do Google é a privacidade do dado: o Apps Script não exige a planilha pública, o que é
        obrigatório quando ela tem nome de aluno.
      </p>

      <Sub>Se o sistema é seu, feito sob medida</Sub>
      <p>
        Não precisa estar nesta lista. Se alguém fez um sistema para você — o de pedidos, o de
        agendamento, a área do cliente —, ele serve, desde que quem fez consiga responder três
        perguntas. Copie e mande para essa pessoa:
      </p>
      <Codigo titulo="o que pedir para quem fez o seu sistema">{`1. Qual endereço eu chamo para consultar isso? (o link, começando com https://)
2. Ele precisa de senha? Se sim, qual e como ela vai junto?
3. Como se chamam os campos que ele responde? (ex.: preco, prazo, status)`}</Codigo>
      <p>
        Com essas três respostas você preenche o bloco inteiro: o endereço no campo de cima, a senha
        em <strong className="text-soft">Credenciais</strong>, e os nomes dos campos em{' '}
        <strong className="text-soft">Guardar da resposta</strong>. Não precisa entender o que
        acontece do outro lado.
      </p>

      <Nota tom="dica" titulo="Credencial, em uma frase">
        <p>
          É a senha que o seu sistema exige para deixar a gente consultar — como a senha do
          seu e-mail, só que para programa falar com programa. Quem fez o sistema te dá. Ela fica
          guardada num cofre, fora do desenho: quem receber um link do seu fluxo vê os blocos e
          nunca a chave.
        </p>
      </Nota>

      <Nota tom="atencao" titulo="A chave nunca vai no desenho">
        <p>
          Vale para todos: cadastre em <strong className="text-soft">Configurações →
          Credenciais</strong> e aponte o bloco para ela. O tipo depende do sistema —{' '}
          <Cod>bearer</Cod> para token de cabeçalho, <Cod>query</Cod> quando a chave vai no
          endereço, <Cod>cabecalho</Cod> para um cabeçalho com nome próprio.
        </p>
      </Nota>
    </Secao>
  )
}
