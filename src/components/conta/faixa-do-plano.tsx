import { diaPorExtenso, diasAte, diaDeHoje } from '@/core/contrato-do-plano'
import { avisosDesde } from '@/server/repos/avisos-de-plano'
import { chaveDoMes, contratoDaConta } from '@/server/repos/plano'
import { planoVigente } from '@/server/repos/planos'
import { conferirAcessoAoCliente, podeAdministrarConta } from '@/server/sessao'
import { FaixaFechavel } from './faixa-fechavel'

/**
 * O aviso de plano no app (seção 8): descida em até 7 dias, preço novo
 * agendado, e consumo em 80% ou 100% da faixa do mês. O mesmo aviso sai por
 * e-mail pela passada diária; aqui ele aparece para quem administra a
 * organização, que é quem decide. Uma faixa só, a mais urgente, e fechável.
 */
export async function FaixaDoPlano({ clienteId }: { clienteId: string }) {
  const acesso = await conferirAcessoAoCliente(clienteId)
  if (!acesso || !podeAdministrarConta(acesso)) return null

  const agora = new Date()
  const contrato = await contratoDaConta(clienteId)
  const href = `/clientes/${clienteId}/ajustes/plano`

  if (contrato.planoAgendado && contrato.planoAgendadoPara) {
    const faltam = diasAte(contrato.planoAgendadoPara, agora)
    if (faltam >= 0 && faltam <= 7) {
      const destino = await planoVigente(contrato.planoAgendado)
      return (
        <FaixaFechavel chave={`descida:${contrato.planoAgendadoPara}:${faltam <= 1 ? 1 : 7}`} href={href} tom="aviso">
          {faltam === 0 ? 'Hoje' : faltam === 1 ? 'Amanhã' : `Em ${faltam} dias`} ({diaPorExtenso(contrato.planoAgendadoPara)}) a organização passa para o plano{' '}
          <strong className="font-semibold">{destino.nome}</strong>. Salve e exporte o que precisar; o que sai fica só leitura.
        </FaixaFechavel>
      )
    }
  }

  if (contrato.precoAgendado !== null && contrato.precoAgendadoPara && contrato.precoAgendadoPara > diaDeHoje(agora)) {
    return (
      <FaixaFechavel chave={`preco:${contrato.precoAgendadoPara}`} href={href} tom="info">
        O preço do plano passa a R$ {contrato.precoAgendado.toLocaleString('pt-BR')} em {diaPorExtenso(contrato.precoAgendadoPara)}.
      </FaixaFechavel>
    )
  }

  const mes = chaveDoMes(agora)
  const avisos = await avisosDesde(clienteId, `${mes}T00:00:00-03:00`)
  const consumo = avisos.find((aviso) => aviso.chave === `consumo:${mes}:100`) ?? avisos.find((aviso) => aviso.chave === `consumo:${mes}:80`)
  if (consumo) {
    const passou = consumo.chave.endsWith(':100')
    const plano = await planoVigente(contrato.plano)
    return (
      <FaixaFechavel chave={consumo.chave} href={href} tom={passou ? 'aviso' : 'info'}>
        {passou
          ? `A organização passou da faixa do plano ${plano.nome} neste mês. Nada é bloqueado; cada conversa a mais custa R$ ${plano.precoExcedente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} na fatura seguinte.`
          : `A organização usou 80% da faixa do plano ${plano.nome} neste mês.`}
      </FaixaFechavel>
    )
  }

  return null
}
