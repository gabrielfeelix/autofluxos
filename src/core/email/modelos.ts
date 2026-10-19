import type { Bloco, Email } from './layout'

/**
 * Todos os e-mails do AutoFluxos, um por situação.
 *
 * **Esta é a fonte da verdade.** O envio monta o HTML daqui, na hora
 * (`server/email.ts`), e os modelos que aparecem no painel da Brevo são cópias
 * geradas a partir deste arquivo por `scripts/modelos-da-brevo.mts`, com o
 * nome terminando em "[cópia, editar no código]", a mesma convenção da
 * Verandi. Editar na Brevo não muda o que sai: muda só a cópia.
 *
 * Cada modelo recebe tudo pronto (nomes, valores em reais, datas por extenso,
 * links inteiros). Formatar é trabalho de quem chama, que sabe o contexto;
 * aqui só se escreve.
 *
 * Os textos não supõem gênero de ninguém ("Boas-vindas", e não "Bem-vindo";
 * "seu acesso foi encerrado", e não "você foi removido") e não usam travessão.
 */

type Modelo<P> = {
  /** Como aparece na Brevo, antes do sufixo de cópia. */
  nome: string
  grupo: 'Conta' | 'Segurança' | 'Equipe' | 'Plano' | 'WhatsApp' | 'Transmissões' | 'Interno'
  montar: (p: P) => Email
  /** Dados de exemplo: a prévia local e a cópia da Brevo saem deles. */
  exemplo: P
}

function definir<P>(modelo: Modelo<P>): Modelo<P> {
  return modelo
}

export function primeiroNome(nome?: string | null): string | null {
  const primeiro = nome?.trim().split(/\s+/)[0]
  return primeiro ? primeiro : null
}

function oi(nome?: string | null): string {
  const primeiro = primeiroNome(nome)
  return primeiro ? `Olá, ${primeiro}.` : 'Olá.'
}

function so<T>(condicao: unknown, bloco: T): T[] {
  return condicao ? [bloco] : []
}

const MOTIVO_DE_SEGURANCA = 'Aviso de segurança da sua conta no AutoFluxos. Ele sai sempre, mesmo que tenha sido você.'
const MOTIVO_DE_GESTAO = 'Você recebe este e-mail porque administra esta organização no AutoFluxos.'

export const MODELOS = {
  // -------------------------------------------------------------------------
  // Conta
  // -------------------------------------------------------------------------

  boasVindas: definir<{ nome: string; organizacao: string; link: string }>({
    nome: 'Boas-vindas',
    grupo: 'Conta',
    montar: (p) => ({
      assunto: primeiroNome(p.nome) ? `Boas-vindas ao AutoFluxos, ${primeiroNome(p.nome)}` : 'Boas-vindas ao AutoFluxos',
      previa: 'Sua organização está criada. Três passos para colocar o atendimento no ar.',
      selo: { texto: 'Conta criada', tom: 'marca' },
      titulo: 'Sua organização está pronta',
      blocos: [
        {
          tipo: 'texto',
          texto: `${oi(p.nome)} A organização **${p.organizacao}** foi criada no AutoFluxos. A partir de agora, cada conversa que chegar no WhatsApp pode ser conduzida por um fluxo e passada para a sua equipe na hora certa.`,
        },
        {
          tipo: 'passos',
          itens: [
            { titulo: 'Conecte o WhatsApp', texto: 'Use o número da empresa pela API oficial do WhatsApp Business. O número continua sendo seu.' },
            { titulo: 'Monte o primeiro fluxo', texto: 'Comece por um modelo pronto e ajuste as mensagens ao jeito da sua empresa.' },
            { titulo: 'Traga a equipe', texto: 'Adicione quem atende, com a função de cada pessoa, e acompanhe tudo pelo Inbox.' },
          ],
        },
        { tipo: 'botao', rotulo: 'Abrir o AutoFluxos', link: p.link },
      ],
      motivo: 'Você recebe este e-mail porque criou uma conta no AutoFluxos.',
    }),
    exemplo: { nome: 'Daniel Moreira', organizacao: 'MGM Pilates', link: 'https://autofluxos.4yu.com.br/painel' },
  }),

  confirmarEmail: definir<{ nome: string; link: string }>({
    nome: 'Confirmar e-mail',
    grupo: 'Conta',
    montar: (p) => ({
      assunto: 'Confirme seu e-mail no AutoFluxos',
      previa: 'Um clique para confirmar que este endereço é seu.',
      selo: { texto: 'Confirmação', tom: 'marca' },
      titulo: 'Confirme seu e-mail',
      blocos: [
        {
          tipo: 'texto',
          texto: `${oi(p.nome)} Confirme que este endereço é seu para manter o acesso ao AutoFluxos. É por ele que você recupera a senha, se um dia precisar.`,
        },
        { tipo: 'botao', rotulo: 'Confirmar meu e-mail', link: p.link, extenso: true },
        { tipo: 'nota', texto: 'O link vale por **24 horas**. Depois disso, entre no AutoFluxos e peça outro.' },
      ],
      motivo: 'Você recebe este e-mail porque este endereço foi usado para criar uma conta no AutoFluxos. Se não foi você, ignore.',
    }),
    exemplo: { nome: 'Daniel Moreira', link: 'https://autofluxos.4yu.com.br/confirmar-email?token=exemplo' },
  }),

  redefinirSenha: definir<{ nome: string; link: string }>({
    nome: 'Redefinir senha',
    grupo: 'Segurança',
    montar: (p) => ({
      assunto: 'Redefinir a senha do AutoFluxos',
      previa: 'O link vale por 1 hora e funciona uma vez só.',
      selo: { texto: 'Segurança', tom: 'marca' },
      titulo: 'Crie uma senha nova',
      blocos: [
        {
          tipo: 'texto',
          texto: `${oi(p.nome)} Recebemos um pedido para redefinir a senha da sua conta no AutoFluxos. Use o botão abaixo para escolher a senha nova.`,
        },
        { tipo: 'botao', rotulo: 'Criar uma senha nova', link: p.link, extenso: true },
        {
          tipo: 'fatos',
          linhas: [
            { rotulo: 'Validade do link', valor: '1 hora' },
            { rotulo: 'Uso', valor: 'Uma vez só' },
          ],
        },
        { tipo: 'nota', texto: '**Não foi você?** Ignore este e-mail. Sua senha continua a mesma, e ninguém entra sem ela.' },
      ],
      motivo: 'Você recebe este e-mail porque alguém pediu para redefinir a senha desta conta.',
    }),
    exemplo: { nome: 'Daniel Moreira', link: 'https://autofluxos.4yu.com.br/redefinir-senha?token=exemplo' },
  }),

  senhaAlterada: definir<{ nome: string; quando: string; link: string }>({
    nome: 'Senha alterada',
    grupo: 'Segurança',
    montar: (p) => ({
      assunto: 'Sua senha do AutoFluxos foi alterada',
      previa: 'Se foi você, está tudo certo. Se não foi, crie uma senha nova agora.',
      selo: { texto: 'Segurança', tom: 'marca' },
      titulo: 'Sua senha foi alterada',
      blocos: [
        {
          tipo: 'texto',
          texto: `${oi(p.nome)} A senha da sua conta no AutoFluxos foi alterada em **${p.quando}**. Por segurança, as sessões abertas em outros aparelhos foram encerradas.`,
        },
        { tipo: 'nota', tom: 'perigo', texto: `**Não foi você?** Crie uma senha nova agora e avise a 4YU em contato@4yu.com.br.` },
        { tipo: 'botao', rotulo: 'Criar uma senha nova', link: p.link },
      ],
      motivo: MOTIVO_DE_SEGURANCA,
    }),
    exemplo: { nome: 'Daniel Moreira', quando: '19 de outubro, às 14:32', link: 'https://autofluxos.4yu.com.br/esqueci-senha' },
  }),

  duasEtapasLigada: definir<{ nome: string; quando: string }>({
    nome: 'Duas etapas ligada',
    grupo: 'Segurança',
    montar: (p) => ({
      assunto: 'Verificação em duas etapas ligada',
      previa: 'Além da senha, o AutoFluxos agora pede o código do aplicativo.',
      selo: { texto: 'Segurança', tom: 'ok' },
      titulo: 'Sua conta ficou mais protegida',
      blocos: [
        {
          tipo: 'texto',
          texto: `${oi(p.nome)} A verificação em duas etapas foi ligada em **${p.quando}**. Daqui em diante, além da senha, o AutoFluxos pede o código do aplicativo autenticador para entrar.`,
        },
        {
          tipo: 'nota',
          tom: 'ok',
          texto: 'Guarde os **códigos de recuperação** em um lugar seguro. São eles que garantem a entrada se você trocar ou perder o celular.',
        },
        { tipo: 'texto', texto: 'Não foi você? Escreva para contato@4yu.com.br agora.' },
      ],
      motivo: MOTIVO_DE_SEGURANCA,
    }),
    exemplo: { nome: 'Daniel Moreira', quando: '19 de outubro, às 14:32' },
  }),

  duasEtapasDesligada: definir<{ nome: string; quando: string; link: string }>({
    nome: 'Duas etapas desligada',
    grupo: 'Segurança',
    montar: (p) => ({
      assunto: 'Verificação em duas etapas desligada',
      previa: 'Agora basta a senha para entrar na sua conta.',
      selo: { texto: 'Segurança', tom: 'aviso' },
      titulo: 'A verificação em duas etapas foi desligada',
      blocos: [
        {
          tipo: 'texto',
          texto: `${oi(p.nome)} A verificação em duas etapas da sua conta foi desligada em **${p.quando}**. A partir de agora, basta a senha para entrar.`,
        },
        { tipo: 'nota', tom: 'perigo', texto: '**Não foi você?** Troque a senha imediatamente e ligue a verificação de novo no seu perfil.' },
        { tipo: 'botao', rotulo: 'Abrir o AutoFluxos', link: p.link },
      ],
      motivo: MOTIVO_DE_SEGURANCA,
    }),
    exemplo: { nome: 'Daniel Moreira', quando: '19 de outubro, às 14:32', link: 'https://autofluxos.4yu.com.br/painel' },
  }),

  // -------------------------------------------------------------------------
  // Equipe
  // -------------------------------------------------------------------------

  acessoLiberado: definir<{ nome: string; organizacao: string; quem: string; funcao: string; email: string; contaNova: boolean; link: string }>({
    nome: 'Acesso liberado',
    grupo: 'Equipe',
    montar: (p) => ({
      assunto: `Seu acesso a ${p.organizacao} no AutoFluxos está liberado`,
      previa: `${p.quem} liberou o seu acesso como ${p.funcao}.`,
      selo: { texto: 'Acesso liberado', tom: 'ok' },
      titulo: `Você agora faz parte de ${p.organizacao}`,
      blocos: [
        { tipo: 'texto', texto: `${oi(p.nome)} **${p.quem}** liberou o seu acesso à organização **${p.organizacao}** no AutoFluxos.` },
        {
          tipo: 'fatos',
          linhas: [
            { rotulo: 'Organização', valor: p.organizacao },
            { rotulo: 'Função', valor: p.funcao },
            { rotulo: 'Entrar com', valor: p.email },
          ],
        },
        {
          tipo: 'texto',
          texto: p.contaNova
            ? 'Use a senha combinada com quem liberou o acesso. Se preferir criar a sua, use **Esqueci a senha** na tela de entrada.'
            : 'Entre com o e-mail e a senha que você já usa no AutoFluxos. A organização aparece no seletor de contas.',
        },
        { tipo: 'botao', rotulo: 'Entrar no AutoFluxos', link: p.link },
      ],
      motivo: 'Você recebe este e-mail porque uma organização liberou acesso para este endereço no AutoFluxos.',
    }),
    exemplo: {
      nome: 'Rodrigo Alves',
      organizacao: 'MGM Pilates',
      quem: 'Daniel Moreira',
      funcao: 'Atendente',
      email: 'rodrigo@mgmpilates.com.br',
      contaNova: true,
      link: 'https://autofluxos.4yu.com.br/entrar',
    },
  }),

  acessoEncerrado: definir<{ nome: string; organizacao: string }>({
    nome: 'Acesso encerrado',
    grupo: 'Equipe',
    montar: (p) => ({
      assunto: `Seu acesso a ${p.organizacao} foi encerrado`,
      previa: 'Sua conta continua existindo; só esta organização sai da lista.',
      selo: { texto: 'Equipe', tom: 'aviso' },
      titulo: 'Seu acesso foi encerrado',
      blocos: [
        {
          tipo: 'texto',
          texto: `${oi(p.nome)} O seu acesso à organização **${p.organizacao}** no AutoFluxos foi encerrado por quem administra a conta. As conversas que estavam com você seguem com a equipe.`,
        },
        { tipo: 'texto', texto: 'Sua conta continua existindo. Se você participa de outras organizações, elas seguem disponíveis normalmente.' },
        { tipo: 'nota', texto: 'Acha que foi um engano? Fale com quem administra a organização.' },
      ],
      motivo: 'Aviso enviado sempre que um acesso a uma organização é encerrado.',
    }),
    exemplo: { nome: 'Rodrigo Alves', organizacao: 'MGM Pilates' },
  }),

  chaveDeApiCriada: definir<{ organizacao: string; quem: string; chave: string; permissoes: string; quando: string; link: string }>({
    nome: 'Chave de API criada',
    grupo: 'Segurança',
    montar: (p) => ({
      assunto: `Nova chave de API em ${p.organizacao}`,
      previa: `${p.quem} criou a chave "${p.chave}". Confira se foi combinado.`,
      selo: { texto: 'Segurança', tom: 'marca' },
      titulo: 'Uma chave de API foi criada',
      blocos: [
        {
          tipo: 'texto',
          texto: `**${p.quem}** criou uma chave de API na organização **${p.organizacao}**. Com ela, outro sistema lê e grava dados da organização sem precisar de login.`,
        },
        {
          tipo: 'fatos',
          linhas: [
            { rotulo: 'Nome da chave', valor: p.chave },
            { rotulo: 'Permissões', valor: p.permissoes },
            { rotulo: 'Criada em', valor: p.quando },
          ],
        },
        { tipo: 'nota', tom: 'perigo', texto: '**Não reconhece esta chave?** Revogue agora. Ela para de funcionar no mesmo instante.' },
        { tipo: 'botao', rotulo: 'Ver as chaves de API', link: p.link },
      ],
      motivo: MOTIVO_DE_GESTAO,
    }),
    exemplo: {
      organizacao: 'MGM Pilates',
      quem: 'Daniel Moreira',
      chave: 'Integração do site',
      permissoes: 'Contatos (leitura e escrita)',
      quando: '19 de outubro, às 14:32',
      link: 'https://autofluxos.4yu.com.br/clientes/exemplo/ajustes/api',
    },
  }),

  // -------------------------------------------------------------------------
  // Plano
  // -------------------------------------------------------------------------

  pedidoDePlanoRecebido: definir<{ nome: string; organizacao: string; plano: string; ciclo: string; link: string }>({
    nome: 'Pedido de plano recebido',
    grupo: 'Plano',
    montar: (p) => ({
      assunto: `Recebemos o pedido do plano ${p.plano}`,
      previa: 'A equipe da 4YU confere os detalhes e entra em contato para confirmar.',
      selo: { texto: 'Plano', tom: 'marca' },
      titulo: 'Pedido de troca de plano recebido',
      blocos: [
        {
          tipo: 'texto',
          texto: `${oi(p.nome)} Recebemos o pedido para levar **${p.organizacao}** ao plano **${p.plano}**. A equipe da 4YU confere os detalhes e entra em contato para confirmar.`,
        },
        {
          tipo: 'fatos',
          linhas: [
            { rotulo: 'Organização', valor: p.organizacao },
            { rotulo: 'Plano pedido', valor: p.plano },
            { rotulo: 'Pagamento', valor: p.ciclo },
          ],
        },
        { tipo: 'texto', texto: 'Até a confirmação, tudo continua funcionando no plano atual.' },
        { tipo: 'botao', rotulo: 'Ver o plano', link: p.link },
      ],
      motivo: 'Você recebe este e-mail porque pediu uma troca de plano no AutoFluxos.',
    }),
    exemplo: { nome: 'Daniel Moreira', organizacao: 'MGM Pilates', plano: 'Pro', ciclo: 'Mensal', link: 'https://autofluxos.4yu.com.br/clientes/exemplo/ajustes/plano' },
  }),

  pedidoDePlanoParaEquipe: definir<{ organizacao: string; quem: string; email: string; de: string; para: string; ciclo: string; link: string }>({
    nome: 'Pedido de plano (equipe 4YU)',
    grupo: 'Interno',
    montar: (p) => ({
      assunto: `Pedido de plano: ${p.organizacao} quer o ${p.para}`,
      previa: `${p.quem} pediu a troca pelo painel. O pedido espera resposta.`,
      selo: { texto: 'Pedido novo', tom: 'aviso' },
      titulo: `${p.organizacao} pediu o plano ${p.para}`,
      blocos: [
        { tipo: 'texto', texto: `**${p.quem}** (${p.email}) pediu a troca de plano pelo painel. O cliente foi avisado de que a 4YU entra em contato.` },
        {
          tipo: 'fatos',
          linhas: [
            { rotulo: 'Organização', valor: p.organizacao },
            { rotulo: 'Plano atual', valor: p.de },
            { rotulo: 'Plano pedido', valor: p.para },
            { rotulo: 'Pagamento', valor: p.ciclo },
          ],
        },
        { tipo: 'botao', rotulo: 'Atender o pedido', link: p.link },
      ],
      motivo: 'Aviso interno da 4YU: um pedido de plano espera resposta na administração.',
    }),
    exemplo: {
      organizacao: 'MGM Pilates',
      quem: 'Daniel Moreira',
      email: 'daniel@mgmpilates.com.br',
      de: 'Essencial',
      para: 'Pro',
      ciclo: 'Mensal',
      link: 'https://autofluxos.4yu.com.br/admin/pedidos',
    },
  }),

  pedidoDePlanoRecusado: definir<{ organizacao: string; plano: string; link: string }>({
    nome: 'Pedido de plano não aplicado',
    grupo: 'Plano',
    montar: (p) => ({
      assunto: `Sobre o pedido do plano ${p.plano}`,
      previa: 'A organização continua no plano atual, sem nenhuma mudança.',
      selo: { texto: 'Plano', tom: 'marca' },
      titulo: 'O pedido de troca não foi aplicado',
      blocos: [
        {
          tipo: 'texto',
          texto: `O pedido para levar **${p.organizacao}** ao plano **${p.plano}** não foi aplicado. A organização continua no plano atual, sem nenhuma mudança.`,
        },
        { tipo: 'texto', texto: 'Para entender o motivo ou combinar outra opção, escreva para contato@4yu.com.br.' },
        { tipo: 'botao', rotulo: 'Ver o plano', link: p.link },
      ],
      motivo: MOTIVO_DE_GESTAO,
    }),
    exemplo: { organizacao: 'MGM Pilates', plano: 'Pro', link: 'https://autofluxos.4yu.com.br/clientes/exemplo/ajustes/plano' },
  }),

  planoAtivado: definir<{ organizacao: string; plano: string; preco: string; desde: string; link: string }>({
    nome: 'Plano ativado',
    grupo: 'Plano',
    montar: (p) => ({
      assunto: `${p.organizacao} agora está no plano ${p.plano}`,
      previa: 'A mudança já vale. Os recursos do plano novo estão liberados.',
      selo: { texto: 'Plano', tom: 'ok' },
      titulo: `Plano ${p.plano} ativo`,
      blocos: [
        {
          tipo: 'texto',
          texto: `A organização **${p.organizacao}** passou para o plano **${p.plano}**. A mudança já vale, e os recursos do plano novo estão liberados.`,
        },
        {
          tipo: 'fatos',
          linhas: [
            { rotulo: 'Plano', valor: p.plano },
            { rotulo: 'Valor mensal', valor: p.preco },
            { rotulo: 'Vale desde', valor: p.desde },
          ],
        },
        { tipo: 'botao', rotulo: 'Ver o plano', link: p.link },
      ],
      motivo: MOTIVO_DE_GESTAO,
    }),
    exemplo: { organizacao: 'MGM Pilates', plano: 'Pro', preco: 'R$ 497', desde: '19 de outubro', link: 'https://autofluxos.4yu.com.br/clientes/exemplo/ajustes/plano' },
  }),

  trocaDePlanoAgendada: definir<{ organizacao: string; de: string; para: string; data: string; faltam: number | null; oQueSai: string; link: string }>({
    nome: 'Troca de plano agendada',
    grupo: 'Plano',
    montar: (p) => {
      const quando = p.faltam === 1 ? 'amanhã' : p.faltam ? `em ${p.faltam} dias` : `em ${p.data}`
      return {
        assunto: p.faltam ? `${p.organizacao} passa para o plano ${p.para} ${quando}` : `${p.organizacao} muda para o plano ${p.para} em ${p.data}`,
        previa: 'Até lá, tudo continua funcionando. Nada é apagado.',
        selo: { texto: 'Plano', tom: 'aviso' },
        titulo: p.faltam === 1 ? 'A troca de plano acontece amanhã' : p.faltam ? `Faltam ${p.faltam} dias para a troca de plano` : 'A troca de plano está agendada',
        blocos: [
          { tipo: 'texto', texto: `A organização **${p.organizacao}** passa do plano **${p.de}** para o **${p.para}** em **${p.data}**, na virada do mês.` },
          {
            tipo: 'fatos',
            linhas: [
              { rotulo: 'Plano de hoje', valor: p.de },
              { rotulo: 'Plano novo', valor: p.para },
              { rotulo: 'Vale a partir de', valor: p.data },
            ],
          },
          ...so(p.oQueSai, { tipo: 'nota', tom: 'aviso', texto: p.oQueSai } as Bloco),
          { tipo: 'texto', texto: 'Até lá, tudo continua funcionando. É o prazo para salvar e exportar o que precisar. Nada é apagado.' },
          { tipo: 'botao', rotulo: 'Ver o plano', link: p.link },
        ],
        motivo: MOTIVO_DE_GESTAO,
      }
    },
    exemplo: {
      organizacao: 'MGM Pilates',
      de: 'Pro',
      para: 'Essencial',
      data: '1º de novembro',
      faltam: 7,
      oQueSai: 'Sai do plano e fica só leitura, com a configuração guardada: Transmissões, API.',
      link: 'https://autofluxos.4yu.com.br/clientes/exemplo/ajustes/plano',
    },
  }),

  trocaDePlanoAplicada: definir<{ organizacao: string; plano: string; preco: string; oQueSai: string; canceladas: number; link: string }>({
    nome: 'Troca de plano aplicada',
    grupo: 'Plano',
    montar: (p) => ({
      assunto: `${p.organizacao} está no plano ${p.plano}`,
      previa: 'A troca agendada foi aplicada hoje. Nada foi apagado.',
      selo: { texto: 'Plano', tom: 'marca' },
      titulo: `Plano ${p.plano} ativo`,
      blocos: [
        { tipo: 'texto', texto: `A partir de hoje, **${p.organizacao}** está no plano **${p.plano}**, por **${p.preco}** por mês.` },
        ...so(p.oQueSai, { tipo: 'nota', tom: 'aviso', texto: p.oQueSai } as Bloco),
        ...so(p.canceladas > 0, {
          tipo: 'texto',
          texto: `${p.canceladas === 1 ? 'Uma transmissão agendada foi cancelada' : `${p.canceladas} transmissões agendadas foram canceladas`}, porque o plano novo não inclui transmissões.`,
        } as Bloco),
        { tipo: 'texto', texto: 'Nada foi apagado. Se voltar a um plano maior, tudo volta na hora.' },
        { tipo: 'botao', rotulo: 'Ver o plano', link: p.link },
      ],
      motivo: MOTIVO_DE_GESTAO,
    }),
    exemplo: {
      organizacao: 'MGM Pilates',
      plano: 'Essencial',
      preco: 'R$ 297',
      oQueSai: 'Sai do plano e fica só leitura, com a configuração guardada: Transmissões, API.',
      canceladas: 2,
      link: 'https://autofluxos.4yu.com.br/clientes/exemplo/ajustes/plano',
    },
  }),

  precoVaiMudar: definir<{ organizacao: string; plano: string; data: string; atual: string | null; novo: string; link: string }>({
    nome: 'Valor do plano vai mudar',
    grupo: 'Plano',
    montar: (p) => ({
      assunto: `O valor do plano ${p.plano} muda em ${p.data}`,
      previa: `A partir de ${p.data}, ${p.novo} por mês.`,
      selo: { texto: 'Plano', tom: 'marca' },
      titulo: 'O valor do seu plano vai mudar',
      blocos: [
        { tipo: 'texto', texto: `A partir de **${p.data}**, o plano **${p.plano}** de **${p.organizacao}** passa a custar **${p.novo}** por mês.` },
        {
          tipo: 'fatos',
          linhas: [...(p.atual ? [{ rotulo: 'Valor de hoje', valor: p.atual }] : []), { rotulo: `A partir de ${p.data}`, valor: p.novo }],
        },
        { tipo: 'texto', texto: 'Os recursos do plano não mudam. O aviso chega com antecedência para você se organizar.' },
        { tipo: 'botao', rotulo: 'Ver o plano', link: p.link },
      ],
      motivo: MOTIVO_DE_GESTAO,
    }),
    exemplo: { organizacao: 'MGM Pilates', plano: 'Pro', data: '18 de novembro', atual: 'R$ 497', novo: 'R$ 547', link: 'https://autofluxos.4yu.com.br/clientes/exemplo/ajustes/plano' },
  }),

  consumoDoPlano: definir<{ organizacao: string; plano: string; usadas: number; total: number; faixa: 80 | 100; precoExcedente: string; conta: string; link: string }>({
    nome: 'Consumo do plano (80% e 100%)',
    grupo: 'Plano',
    montar: (p) => {
      const passou = p.faixa === 100
      return {
        assunto: passou ? `${p.organizacao} passou da faixa do plano ${p.plano}` : `${p.organizacao} usou 80% das conversas do plano ${p.plano}`,
        previa: 'Nada é bloqueado. Veja quanto já foi usado neste mês.',
        selo: { texto: 'Consumo do mês', tom: passou ? 'perigo' : 'aviso' },
        titulo: passou ? 'A faixa de conversas do mês foi ultrapassada' : 'Você já usou 80% da faixa do mês',
        blocos: [
          {
            tipo: 'texto',
            texto: `**${p.organizacao}** teve **${p.usadas.toLocaleString('pt-BR')} conversas** neste mês, de ${p.total.toLocaleString('pt-BR')} incluídas no plano **${p.plano}**.`,
          },
          { tipo: 'medidor', usado: p.usadas, total: p.total, tom: passou ? 'perigo' : 'aviso', legenda: 'Conversas do mês, contadas pelo AutoFluxos. A contagem recomeça no dia 1º.' },
          {
            tipo: 'texto',
            texto: `Nada é bloqueado. ${passou ? 'Cada' : 'Acima da faixa, cada'} conversa a mais custa **${p.precoExcedente}**, cobrada na fatura seguinte.${p.conta ? ` ${p.conta}` : ''}`,
          },
          { tipo: 'texto', texto: 'Se esse volume vai se repetir, um plano maior costuma sair mais barato que o excedente.' },
          { tipo: 'botao', rotulo: 'Ver o plano', link: p.link },
        ],
        motivo: MOTIVO_DE_GESTAO,
      }
    },
    exemplo: {
      organizacao: 'MGM Pilates',
      plano: 'Pro',
      usadas: 812,
      total: 1000,
      faixa: 80,
      precoExcedente: 'R$ 0,40',
      conta: '',
      link: 'https://autofluxos.4yu.com.br/clientes/exemplo/ajustes/plano',
    },
  }),

  // -------------------------------------------------------------------------
  // WhatsApp
  // -------------------------------------------------------------------------

  franquiaDaMeta: definir<{ organizacao: string; telefone: string; usadas: number; estourou: boolean; excedentes: number; custo: string; tarifa: string; link: string }>({
    nome: 'Franquia de 1.000 conversas da Meta',
    grupo: 'WhatsApp',
    montar: (p) => ({
      assunto: p.estourou
        ? `O número ${p.telefone} passou das 1.000 conversas grátis da Meta`
        : `O número ${p.telefone} está perto das 1.000 conversas grátis da Meta`,
      previa: p.estourou ? 'O atendimento continua normal. Veja o custo estimado até agora.' : 'Acima de 1.000, a Meta passa a cobrar cada conversa de atendimento.',
      selo: { texto: 'WhatsApp', tom: p.estourou ? 'perigo' : 'aviso' },
      titulo: p.estourou ? 'O limite grátis da Meta foi ultrapassado' : 'Perto do limite grátis da Meta',
      blocos: [
        {
          tipo: 'texto',
          texto: p.estourou
            ? `O número **${p.telefone}** de **${p.organizacao}** já teve **${p.usadas.toLocaleString('pt-BR')} conversas de atendimento** neste mês. A Meta libera 1.000 sem custo por número, e as **${p.excedentes.toLocaleString('pt-BR')}** acima disso somam cerca de **${p.custo}** até agora.`
            : `O número **${p.telefone}** de **${p.organizacao}** já usou **${p.usadas.toLocaleString('pt-BR')}** das 1.000 conversas de atendimento que a Meta libera sem custo por mês.`,
        },
        {
          tipo: 'medidor',
          usado: p.usadas,
          total: 1000,
          tom: p.estourou ? 'perigo' : 'aviso',
          legenda: 'Conversas de atendimento contadas pela Meta até ontem. A franquia é por número e recomeça no dia 1º.',
        },
        {
          tipo: 'texto',
          texto: `Acima de 1.000, cada conversa de atendimento custa cerca de **${p.tarifa}**, cobrada pela Meta. Modelos de marketing e de utilidade são cobrados à parte, desde a primeira mensagem.`,
        },
        ...so(p.estourou, { tipo: 'nota', texto: 'O atendimento continua normal. Nada é bloqueado pelo AutoFluxos.' } as Bloco),
        { tipo: 'botao', rotulo: 'Ver o consumo', link: p.link },
      ],
      motivo: MOTIVO_DE_GESTAO,
    }),
    exemplo: {
      organizacao: 'MGM Pilates',
      telefone: '+55 44 99999-0000',
      usadas: 874,
      estourou: false,
      excedentes: 0,
      custo: 'R$ 0',
      tarifa: 'R$ 0,035',
      link: 'https://autofluxos.4yu.com.br/clientes/exemplo/ajustes/plano',
    },
  }),

  whatsappConectado: definir<{ organizacao: string; link: string }>({
    nome: 'WhatsApp conectado',
    grupo: 'WhatsApp',
    montar: (p) => ({
      assunto: `WhatsApp de ${p.organizacao} conectado ao AutoFluxos`,
      previa: 'As mensagens que chegarem no número já aparecem no Inbox.',
      selo: { texto: 'WhatsApp', tom: 'ok' },
      titulo: 'Seu WhatsApp está conectado',
      blocos: [
        {
          tipo: 'texto',
          texto: `O número oficial de **${p.organizacao}** foi conectado ao AutoFluxos. As mensagens que chegarem nele já aparecem no Inbox e podem ser respondidas pelos fluxos.`,
        },
        {
          tipo: 'passos',
          itens: [
            { titulo: 'Publique um fluxo', texto: 'Escolha qual fluxo responde quando alguém manda a primeira mensagem.' },
            { titulo: 'Faça um teste', texto: 'Mande uma mensagem de outro celular para o número e acompanhe a conversa no Inbox.' },
            { titulo: 'Avise a equipe', texto: 'Quem atende recebe as conversas que o fluxo passar para uma pessoa.' },
          ],
        },
        { tipo: 'botao', rotulo: 'Abrir o Inbox', link: p.link },
      ],
      motivo: MOTIVO_DE_GESTAO,
    }),
    exemplo: { organizacao: 'MGM Pilates', link: 'https://autofluxos.4yu.com.br/clientes/exemplo/inbox' },
  }),

  // -------------------------------------------------------------------------
  // Transmissões
  // -------------------------------------------------------------------------

  transmissaoConcluida: definir<{ nome: string; transmissao: string; total: number; entregues: number; lidas: number; falhas: number; link: string }>({
    nome: 'Transmissão concluída',
    grupo: 'Transmissões',
    montar: (p) => ({
      assunto: `Transmissão concluída: ${p.transmissao}`,
      previa: `${p.entregues.toLocaleString('pt-BR')} de ${p.total.toLocaleString('pt-BR')} mensagens entregues.`,
      selo: { texto: 'Transmissão', tom: 'ok' },
      titulo: 'Sua transmissão terminou',
      blocos: [
        { tipo: 'texto', texto: `${oi(p.nome)} A transmissão **${p.transmissao}** terminou de sair. Este é o resultado até agora:` },
        {
          tipo: 'fatos',
          linhas: [
            { rotulo: 'Destinatários', valor: p.total.toLocaleString('pt-BR') },
            { rotulo: 'Entregues', valor: p.entregues.toLocaleString('pt-BR') },
            { rotulo: 'Lidas', valor: p.lidas.toLocaleString('pt-BR') },
            { rotulo: 'Com falha', valor: p.falhas.toLocaleString('pt-BR') },
          ],
        },
        ...so(p.falhas > 0, { tipo: 'nota', tom: 'aviso', texto: 'Os contatos com falha aparecem na tela da transmissão, com o motivo de cada um.' } as Bloco),
        { tipo: 'texto', texto: 'Entregas e leituras continuam sendo contadas nas próximas horas, conforme o WhatsApp confirma.' },
        { tipo: 'botao', rotulo: 'Ver a transmissão', link: p.link },
      ],
      motivo: 'Você recebe este e-mail porque criou esta transmissão no AutoFluxos.',
    }),
    exemplo: {
      nome: 'Daniel Moreira',
      transmissao: 'Aulas experimentais de novembro',
      total: 420,
      entregues: 401,
      lidas: 288,
      falhas: 6,
      link: 'https://autofluxos.4yu.com.br/clientes/exemplo/transmissoes/exemplo',
    },
  }),
} as const

export type IdDoModelo = keyof typeof MODELOS
export type ParametrosDo<I extends IdDoModelo> = (typeof MODELOS)[I]['exemplo']
