import Link from 'next/link'
import { FormularioDeConta } from '@/components/conta/formulario'
import { Portico } from '@/components/design/portico'
import { acaoCriarPrimeiroAdministrador } from '@/server/acoes-conta'
import { ehAdminDaPlataforma, existeAlgumUsuario, sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * O cadastro — e ele tem **duas** vidas.
 *
 * Enquanto não existe ninguém, é a primeira execução: quem chegar aqui nasce
 * administrador da plataforma. O que segura essa porta é o próprio tempo — ela
 * fecha sozinha no instante em que o primeiro usuário existe, porque a pergunta
 * que a destranca ("não há ninguém?") só tem resposta afirmativa uma vez na vida
 * do sistema.
 *
 * Havia um segundo cadeado, a senha única do painel, e ele saiu junto com a rota
 * `/login`. A janela que sobra é entre subir um ambiente novo e cadastrar o
 * primeiro administrador — quem sobe é quem cadastra. Ver `acoes-conta.ts`.
 *
 * Depois disso, é a tela de cadastrar gente, e só administrador a usa. O
 * convite por e-mail — o caminho normal em qualquer produto — depende de SMTP,
 * que é global ao projeto compartilhado com a Verandi e não é decisão desta
 * frente (ver docs/BANCO-COMPARTILHADO.md).
 */
export default async function CriarConta() {
  const sessao = await sessaoAtual()

  /**
   * Sem banco, esta tela não pode estourar: ela é justamente a que alguém abre
   * quando o ambiente ainda está sendo montado. Tratar a falha como "já tem
   * gente" é o lado seguro — fecha a porta de primeira execução em vez de
   * abri-la por causa de um erro de conexão.
   */
  let jaTemGente = true
  let bancoRespondeu = true
  try {
    jaTemGente = await existeAlgumUsuario()
  } catch {
    bancoRespondeu = false
  }

  const souAdmin = ehAdminDaPlataforma(sessao)

  if (!bancoRespondeu) {
    return (
      <Portico
        titulo="Cadastro indisponível"
        descricao="O banco do login não respondeu."
      >
        <p className="text-[12.5px] leading-[1.7] text-muted">
          O login por usuário fala Postgres direto e precisa de{' '}
          <code className="font-mono text-[11.5px] text-soft">DATABASE_URL</code> — o pooler de
          transação, porta 6543. Sem ela, esta tela não tem como saber se já existe alguém
          cadastrado.
        </p>
        <p className="mt-4 text-[12.5px] text-dim">
          <Link href="/entrar" className="text-muted underline underline-offset-2 transition hover:text-accent">
            Voltar para entrar
          </Link>
        </p>
      </Portico>
    )
  }

  if (jaTemGente && !souAdmin) {
    return (
      <Portico titulo="Cadastro fechado" descricao="Quem cria conta aqui é quem administra a plataforma.">
        <p className="text-[12.5px] leading-[1.7] text-muted">
          Não existe cadastro aberto neste painel — a conta de um cliente é criada pela 4YU, junto
          com o número de WhatsApp dele. Se você deveria ter acesso, peça a quem administra.
        </p>
        <p className="mt-4 text-[12.5px] text-dim">
          <Link href="/entrar" className="text-muted underline underline-offset-2 transition hover:text-accent">
            Já tenho conta
          </Link>
        </p>
      </Portico>
    )
  }

  return (
    <Portico
      titulo={jaTemGente ? 'Cadastrar usuário' : 'Primeiro acesso'}
      descricao={
        jaTemGente
          ? 'A pessoa entra com esta senha e pode trocá-la depois.'
          : 'Ninguém cadastrado ainda. Quem entrar por aqui nasce administrador da plataforma.'
      }
      rodape={
        jaTemGente ? (
          <p>
            O usuário nasce sem conta nenhuma. Ligue ele a um cliente em{' '}
            <Link href="/admin/contas" className="text-muted underline underline-offset-2 transition hover:text-accent">
              Contas
            </Link>{' '}
            — sem isso ele entra e não vê nada.
          </p>
        ) : (
          <p>
            Esta é a primeira execução: ainda não há ninguém cadastrado, e quem sair daqui
            nasce administrador da plataforma. Depois deste cadastro a porta se fecha sozinha,
            e daqui em diante só administrador cria gente.
          </p>
        )
      }
    >
      <FormularioDeConta
        action={acaoCriarPrimeiroAdministrador}
        botao={jaTemGente ? 'Cadastrar' : 'Criar e entrar'}
        pedirNome
      />
    </Portico>
  )
}
