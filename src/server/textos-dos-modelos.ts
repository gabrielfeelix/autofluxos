import 'server-only'
import { lerComponentesDaMeta } from '@/channels/templates-api'
import { lerTokenDoCanal, listarCanais } from './repos/conversas'
import { gravarComponentes, type Template } from './repos/templates'

/**
 * Completa o texto dos modelos que estão sem ele, lendo da Meta.
 *
 * Modelo pronto da biblioteca nascia com o corpo vazio (até 05/out/2026), e
 * sem texto a lista e o "Retomar" da conversa não tinham o que mostrar. Na
 * primeira vez que a lista é lida, o que falta vem da Meta e fica gravado; nas
 * próximas, não há nada a buscar. Falhar aqui só deixa o texto vazio: a lista
 * continua abrindo.
 */
export async function completarTextos(clienteId: string, templates: Template[]): Promise<Template[]> {
  const faltam = templates.filter((t) => t.componentes.corpo.trim() === '' && t.wabaTemplateId)
  if (faltam.length === 0) return templates

  try {
    const canal = (await listarCanais(clienteId)).find((c) => c.provider === 'cloud-api' && c.status === 'ativo')
    if (!canal) return templates
    const token = await lerTokenDoCanal(canal)

    const lidos = new Map<string, Template['componentes']>()
    await Promise.all(
      faltam.slice(0, 10).map(async (t) => {
        const componentes = await lerComponentesDaMeta({ wabaTemplateId: t.wabaTemplateId as string, token })
        if (!componentes || componentes.corpo.trim() === '') return
        lidos.set(t.id, componentes)
        await gravarComponentes(t.id, componentes).catch(() => {})
      }),
    )
    return templates.map((t) => (lidos.has(t.id) ? { ...t, componentes: lidos.get(t.id) as Template['componentes'] } : t))
  } catch {
    return templates
  }
}
