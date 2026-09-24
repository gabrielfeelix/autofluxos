/**
 * A trilha de primeira configuração, no topo de Configurações (S01).
 *
 * O índice de Configurações lista as telas por assunto, e uma conta nova
 * chegava em Respostas rápidas ou Chaves de API sem saber o mínimo para ter a
 * primeira conversa funcionando. A trilha diz a ordem: empresa, canal,
 * horário e conhecimento, automação no ar, teste.
 *
 * **A regra de "está atendendo" é uma só** (`automacaoNoAr`), usada aqui e na
 * faixa de estado do Início: canal ligado apontando para automação publicada.
 * Repetir o cálculo nas duas telas faria uma dizer "atendendo" enquanto a
 * outra cobra o passo.
 *
 * Passo **bloqueado** diz o motivo, e o motivo é sempre o passo de que ele
 * depende: testar sem automação no ar não prova nada, e publicar sem canal
 * põe no ar um roteiro que ninguém recebe.
 */

export type EstadoDoPasso = 'feito' | 'pendente' | 'bloqueado'

export type PassoDaTrilha = {
  chave: 'empresa' | 'canal' | 'horario' | 'automacao' | 'teste'
  titulo: string
  estado: EstadoDoPasso
  /** O que falta, ou por que está bloqueado. `null` quando feito. */
  motivo: string | null
  /** Relativo à conta. */
  href: string
}

export type FluxoParaTrilha = { id: string; versaoPublicadaId: string | null }
export type CanalParaTrilha = { flowId: string | null }

/** Quantas automações estão publicadas e quantos canais apontam para uma delas. */
export function automacaoNoAr(fluxos: FluxoParaTrilha[], canais: CanalParaTrilha[]) {
  const publicados = new Set(fluxos.filter((f) => f.versaoPublicadaId).map((f) => f.id))
  return {
    publicados: publicados.size,
    atendendo: canais.filter((c) => c.flowId && publicados.has(c.flowId)).length,
  }
}

export type FatosDaTrilha = {
  empresa: { responsavel: string; telefone: string; email: string }
  canais: number
  temHorario: boolean
  temConhecimento: boolean
  publicados: number
  atendendo: number
  /** Alguma conversa já chegou: é o teste de ponta a ponta. */
  temContato: boolean
}

export function trilhaDeConfiguracao(f: FatosDaTrilha): PassoDaTrilha[] {
  const empresaFeita =
    f.empresa.responsavel.trim() !== '' && (f.empresa.telefone.trim() !== '' || f.empresa.email.trim() !== '')
  const canalFeito = f.canais > 0
  const horarioFeito = f.temHorario && f.temConhecimento
  const automacaoFeita = f.atendendo > 0
  const testeFeito = automacaoFeita && f.temContato

  const faltaNoHorario = !f.temHorario && !f.temConhecimento
    ? 'Falta o horário e o que a IA sabe do negócio'
    : !f.temHorario
      ? 'Falta dizer quando há gente para atender'
      : 'Falta contar à IA o que o negócio faz'

  return [
    {
      chave: 'empresa',
      titulo: 'Dados da empresa',
      estado: empresaFeita ? 'feito' : 'pendente',
      motivo: empresaFeita ? null : 'Quem responde pela conta e um contato',
      href: '/ajustes/negocio',
    },
    {
      chave: 'canal',
      titulo: 'Canal',
      estado: canalFeito ? 'feito' : 'pendente',
      motivo: canalFeito ? null : 'Ligue o WhatsApp ou o Instagram',
      href: '/conversas/canais/whatsapp',
    },
    {
      chave: 'horario',
      titulo: 'Horário e conhecimento',
      estado: horarioFeito ? 'feito' : 'pendente',
      motivo: horarioFeito ? null : faltaNoHorario,
      href: f.temHorario ? '/ajustes/contexto' : '/ajustes/horario',
    },
    {
      chave: 'automacao',
      titulo: 'Automação publicada',
      estado: automacaoFeita ? 'feito' : canalFeito ? 'pendente' : 'bloqueado',
      motivo: automacaoFeita
        ? null
        : !canalFeito
          ? 'Depende do canal: é nele que a automação atende'
          : f.publicados === 0
            ? 'Publique uma automação'
            : 'O canal não aponta para a automação publicada',
      href: canalFeito && f.publicados > 0 ? '/conversas/canais/whatsapp' : '/fluxos',
    },
    {
      chave: 'teste',
      titulo: 'Testar',
      // Contato importado ou digitado não prova que o canal responde: o teste
      // só conta com a automação no ar.
      estado: testeFeito ? 'feito' : automacaoFeita ? 'pendente' : 'bloqueado',
      motivo: testeFeito
        ? null
        : automacaoFeita
          ? 'Mande uma mensagem do seu celular para o canal'
          : 'Depende da automação no ar',
      href: '/inbox',
    },
  ]
}
