import type { Metadata } from 'next'
import { Item, Lista, PaginaLegal, type SecaoLegal } from '../(site)/pagina-legal'

/**
 * Instruções de exclusão de dados — **públicas, e por exigência da Meta**.
 *
 * O campo “Instruções de exclusão de dados” das Configurações Básicas do app é
 * obrigatório, e o app review não abre com ele vazio. A Meta aceita uma página
 * com instruções — não precisa de callback —, e é o que esta é. Como as outras
 * páginas legais, abre sem sessão (ver `PORTAS_ABERTAS` em `proxy.ts`).
 *
 * **Esta página existe para não prometer o que o código não faz, e por isso
 * cada afirmação dela aponta para um lugar do sistema:**
 *
 * - o que some junto com o contato é o `on delete cascade` de `contacts` —
 *   sessões (0003), mensagens (0003), pedidos de atendimento (0022), trava da
 *   conversa (0007), leituras (0023), etiquetas (0025), cartões de quadro
 *   (0032) e inscrições em sequência (0031);
 * - o prazo automático é `MESES_DE_RETENCAO_PADRAO` em `repos/retencao.ts`,
 *   contado do **último sinal de vida** e não da criação;
 * - o que **sobrevive** é `af_auditoria` (0021) e `ia_chamadas` (0038), as
 *   duas guardando id e não conteúdo, as duas de propósito: quem apaga não
 *   pode apagar o registro de que apagou, e o art. 20 da LGPD exige poder
 *   explicar uma decisão automatizada depois dela;
 * - o token do canal sai do Vault pelo gatilho da 0040 quando a conta é
 *   desligada.
 *
 * Se qualquer um desses comportamentos mudar, esta página muda junto. Página de
 * exclusão que descreve outro sistema é pior do que não ter página.
 */
export const metadata: Metadata = {
  title: 'Exclusão de dados · AutoFluxos',
  description:
    'Como pedir a exclusão dos seus dados no AutoFluxos, em quanto tempo respondemos e o que exatamente é apagado.',
}

const ATUALIZADA_EM = '3 de setembro de 2026'

const SECOES: readonly SecaoLegal[] = [
  {
    id: 'quem-pede',
    titulo: 'Antes de tudo: quem é você nesta história',
    conteudo: (
      <>
        <p>
          O AutoFluxos é a ferramenta que empresas usam para atender no WhatsApp e no Instagram. O
          caminho para apagar depende de qual dos dois lados você está:
        </p>
        <Lista>
          <Item>
            <strong>Você conversou com o atendimento de alguma empresa</strong> e quer que os seus
            dados sumam. Vá para a seção 2. Os dados são da empresa com quem você falou; nós os
            guardamos por ela e apagamos quando você ou ela pedir.
          </Item>
          <Item>
            <strong>Você usa o painel</strong> — é dono ou faz parte do time de uma empresa
            cliente. Vá para a seção 3: dá para apagar sozinho, na hora, e também dá para pedir
            que a conta inteira suma.
          </Item>
        </Lista>
      </>
    ),
  },
  {
    id: 'pessoa',
    titulo: 'Você conversou com uma automação e quer sumir',
    conteudo: (
      <>
        <p>
          <strong>O caminho mais rápido é pedir para a própria empresa</strong> com quem você
          conversou: é ela quem decide sobre esses dados, e ela apaga pelo painel na hora. Basta
          pedir na mesma conversa do WhatsApp ou do Instagram.
        </p>
        <p>Se preferir falar direto com a gente, ou se a empresa não responder:</p>
        <Lista>
          <Item>
            Escreva para <a href="mailto:contato@4yu.com.br?subject=Exclus%C3%A3o%20de%20dados">contato@4yu.com.br</a>{' '}
            com o assunto <strong>“Exclusão de dados”</strong>, ou mande mensagem no WhatsApp{' '}
            <a href="https://wa.me/5544998775978">+55 44 99877-5978</a>.
          </Item>
          <Item>
            Diga <strong>o número de WhatsApp (ou o @ do Instagram) que você usou na conversa</strong>{' '}
            e, se souber, o nome da empresa com quem falou. Sem isso não há como achar o seu
            registro — a busca é por esse identificador, e não por nome.
          </Item>
          <Item>
            Confirmamos que o pedido é seu mesmo antes de apagar. Normalmente é uma mensagem de
            confirmação para o próprio número que você indicou: apagar conversa a pedido de quem
            não é o dono dela seria o mesmo problema, do avesso.
          </Item>
        </Lista>
        <p>
          Você não precisa dizer o motivo. Se quiser apenas <strong>parar de receber mensagens</strong>{' '}
          sem apagar o histórico, peça isso na própria conversa — o atendimento automático é
          interrompido para o seu número.
        </p>
      </>
    ),
  },
  {
    id: 'empresa',
    titulo: 'Você usa o painel: apagando sozinho',
    conteudo: (
      <>
        <Lista>
          <Item>
            <strong>Um contato:</strong> abra o contato em <strong>Leads</strong> e use{' '}
            <strong>Apagar contato</strong>. Some na hora, com todo o histórico dele.
          </Item>
          <Item>
            <strong>Vários de uma vez:</strong> selecione na lista de <strong>Leads</strong> e
            apague a seleção.
          </Item>
          <Item>
            <strong>Antes de apagar, exporte se precisar:</strong> o botão{' '}
            <strong>Baixar CSV</strong> na mesma tela leva o que você coletou. Depois do apagar
            não há como recuperar — não existe lixeira nem cópia guardada em outro lugar.
          </Item>
          <Item>
            <strong>Desligar um canal:</strong> ao desconectar a conta do WhatsApp ou do
            Instagram, o token de acesso é apagado do cofre no mesmo instante.
          </Item>
          <Item>
            <strong>A conta inteira:</strong> peça por{' '}
            <a href="mailto:contato@4yu.com.br?subject=Exclus%C3%A3o%20da%20conta">contato@4yu.com.br</a>{' '}
            usando o e-mail de administrador da conta. Apagamos a empresa e tudo que pende dela —
            contatos, conversas, fluxos, quadros e sequências.
          </Item>
        </Lista>
      </>
    ),
  },
  {
    id: 'prazo',
    titulo: 'Em quanto tempo',
    conteudo: (
      <>
        <Lista>
          <Item>
            <strong>Pelo painel:</strong> imediato. Quem clica é você, e a exclusão acontece
            enquanto a tela ainda está aberta.
          </Item>
          <Item>
            <strong>Pedido enviado para nós:</strong> confirmamos o recebimento em até{' '}
            <strong>2 dias úteis</strong> e concluímos em até <strong>15 dias</strong> — o prazo
            que a LGPD dá para responder ao titular. Se o pedido depender da empresa controladora,
            encaminhamos a ela e avisamos você.
          </Item>
        </Lista>
      </>
    ),
  },
  {
    id: 'o-que-some',
    titulo: 'O que exatamente é apagado',
    conteudo: (
      <>
        <p>
          Apagar um contato apaga, no mesmo movimento e sem cópia guardada em outro lugar:
        </p>
        <Lista>
          <Item>o cadastro dele — número ou conta do Instagram, nome e os campos que o fluxo preencheu;</Item>
          <Item>todas as mensagens trocadas, nos dois sentidos, e os arquivos referenciados nelas;</Item>
          <Item>as sessões de fluxo — onde a conversa estava, e o que já tinha sido respondido;</Item>
          <Item>os pedidos de atendimento humano e a trava que segurava o robô;</Item>
          <Item>as etiquetas, o que estava marcado como não lido, e os cartões dele nos quadros;</Item>
          <Item>as inscrições em sequências, com as mensagens futuras que estavam agendadas.</Item>
        </Lista>
      </>
    ),
  },
  {
    id: 'o-que-fica',
    titulo: 'O que não some, e por quê',
    conteudo: (
      <>
        <p>
          Esta é a parte que a maioria das páginas de exclusão não escreve, e é justamente a que
          importa:
        </p>
        <Lista>
          <Item>
            <strong>O registro de que a exclusão aconteceu.</strong> Ficam a data, quem pediu e
            quantos registros sumiram — sem o conteúdo de nada. Quem apaga não pode apagar também
            a prova de que apagou; é isso que permite demonstrar que o pedido foi cumprido.
          </Item>
          <Item>
            <strong>O registro de uso da inteligência artificial</strong>, quando a empresa usa o
            recurso: guardamos qual consulta a IA fez, quem decidiu e se deu certo, referenciando
            o contato por identificador. É a exigência do art. 20 da LGPD — explicar uma decisão
            automatizada depois dela exige ter registrado quais foram os critérios. O conteúdo da
            conversa não fica aqui.
          </Item>
          <Item>
            <strong>O que a lei obrigue a manter</strong>, pelo prazo exigido, e o que for
            necessário para exercício de direito em processo.
          </Item>
          <Item>
            <strong>Cópias que não são nossas.</strong> A mensagem que já chegou continua no
            aparelho de quem a recebeu, e a Meta guarda o que guarda do lado dela pelo WhatsApp e
            pelo Instagram — apagar aqui não alcança nem uma coisa nem outra. Para os dados que
            estão com a Meta, o caminho são as configurações do próprio WhatsApp ou Instagram.
          </Item>
          <Item>
            Registros técnicos de operação (quem chamou o quê, e erros) vivem por tempo curto e
            são apagados automaticamente pela mesma rotina de limpeza.
          </Item>
        </Lista>
      </>
    ),
  },
  {
    id: 'automatico',
    titulo: 'Sem pedir nada: o prazo que roda sozinho',
    conteudo: (
      <p>
        Contato sem nenhum sinal de vida por <strong>12 meses</strong> é apagado automaticamente,
        com tudo que a seção 5 lista. O prazo conta da <strong>última mensagem</strong>, e não da
        data em que o contato entrou — conversa ativa que começou há treze meses não é apagada. A
        limpeza roda todo dia.
      </p>
    ),
  },
  {
    id: 'contato',
    titulo: 'Contato',
    conteudo: (
      <>
        <p>
          <a href="mailto:contato@4yu.com.br?subject=Exclus%C3%A3o%20de%20dados">contato@4yu.com.br</a>
        </p>
        <p>
          WhatsApp <a href="https://wa.me/5544998775978">+55 44 99877-5978</a>
        </p>
        <p>
          68.770.493 GABRIEL FELIX BARBOSA (4YU) · CNPJ 68.770.493/0001-82 · Rua Osvaldo Cruz,
          297 — Zona 07 — Maringá/PR — CEP 87020-200.
        </p>
        <p>
          O que fazemos com os dados enquanto eles existem está na{' '}
          <a href="/privacidade">política de privacidade</a>; as regras de uso do serviço, nos{' '}
          <a href="/termos">termos</a>.
        </p>
      </>
    ),
  },
]

export default function Pagina() {
  return (
    <PaginaLegal
      titulo="Exclusão de dados"
      rotuloDoIndice="Índice da exclusão de dados"
      resumo="O resumo em uma frase: peça pelo painel ou escreva para a gente, respondemos em até 15 dias, e o que é apagado some de verdade — sem lixeira e sem cópia guardada em outro lugar."
      selos={[
        { icone: 'lixeira', texto: 'Apagado é apagado' },
        { icone: 'relogio', texto: 'Em até 15 dias' },
        { icone: 'escudo', texto: 'Confirmamos quem pediu' },
        { icone: 'documento', texto: 'Dizemos o que não some' },
      ]}
      atualizadaEm={ATUALIZADA_EM}
      secoes={SECOES}
      fecho={{
        texto:
          'Quer apagar agora? Escreva com o número que você usou na conversa. Respondemos em português, sem letra miúda.',
        rotulo: 'Pedir a exclusão',
        href: 'mailto:contato@4yu.com.br?subject=Exclus%C3%A3o%20de%20dados',
      }}
    />
  )
}
