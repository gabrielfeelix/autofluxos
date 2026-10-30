/**
 * O desenho de todo e-mail do Dialogon, num lugar só.
 *
 * Cada modelo (`modelos.ts`) descreve **o que** diz em blocos; este arquivo
 * decide **como** aparece, em HTML e em texto puro, a partir dos mesmos
 * blocos. Assim o texto puro nunca fica para trás do HTML, e mudar a cara de
 * todos os e-mails é mudar um arquivo.
 *
 * **HTML de e-mail não é HTML de página.** Tabela em vez de flex, estilo
 * inline em vez de classe, cor sólida por baixo de todo gradiente (o Outlook
 * ignora gradiente) e nada de imagem que carregue informação: a logo é a
 * única, e o nome ao lado dela continua dizendo quem mandou quando o leitor
 * bloqueia imagens. O `<style>` do cabeçalho só ajusta o celular; sem ele, o
 * e-mail continua inteiro.
 *
 * As cores são as do painel (`globals.css`, tema claro): o mesmo azul do botão
 * primário, os mesmos cinzas medidos para contraste AA.
 */

export type Tom = 'marca' | 'ok' | 'aviso' | 'perigo'

export type Bloco =
  | { tipo: 'texto'; texto: string }
  /** `extenso`: repete o link por escrito embaixo, para link com token que precisa abrir de qualquer jeito. */
  | { tipo: 'botao'; rotulo: string; link: string; extenso?: boolean }
  | { tipo: 'fatos'; linhas: { rotulo: string; valor: string }[] }
  | { tipo: 'medidor'; usado: number; total: number; legenda: string; tom: Tom }
  | { tipo: 'passos'; itens: { titulo: string; texto: string }[] }
  | { tipo: 'nota'; texto: string; tom?: Tom }

export type Email = {
  assunto: string
  /** A linha cinza que a caixa de entrada mostra depois do assunto. */
  previa: string
  selo: { texto: string; tom: Tom }
  titulo: string
  blocos: Bloco[]
  /** Por que a pessoa recebeu, no rodapé. Uma frase. */
  motivo: string
}

export type EmailMontado = { assunto: string; html: string; texto: string }

/** A logo mora no domínio de produção: leitor de e-mail não alcança localhost. */
export const LOGO = 'https://dialogon.com.br/logos/logo-dialogon-marca.png'
export const CONTATO = 'contato@dialogon.com.br'

const COR = {
  fundo: '#eef1f5',
  cartao: '#ffffff',
  linha: '#e5e8ec',
  linhaSuave: '#eef0f3',
  superficie: '#f6f7f9',
  trilho: '#e9edf2',
  tinta: '#131922',
  texto: '#4f5967',
  apagado: '#636c79',
  primaria: '#2563eb',
  primariaForte: '#1d4ed8',
}

const TOM: Record<Tom, { fundo: string; tinta: string; cheio: string }> = {
  marca: { fundo: '#eff4ff', tinta: '#1d4ed8', cheio: '#2563eb' },
  ok: { fundo: '#ecfdf5', tinta: '#047857', cheio: '#059669' },
  aviso: { fundo: '#fffbeb', tinta: '#92400e', cheio: '#d97706' },
  perigo: { fundo: '#fef2f2', tinta: '#b91c1c', cheio: '#dc2626' },
}

const TITULO = "Outfit,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const CORPO = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Função, e não texto, no `replace`: em texto, `$&` seria o trecho casado. */
function semQuebraNoValor(html: string): string {
  return html.replace(/R\$ /g, () => 'R$&nbsp;')
}

/**
 * `**assim**` vira negrito no HTML; o resto é escapado. "R$ 0,40" não quebra
 * de linha no meio. Dentro de nota, o negrito fica na cor da nota.
 */
function marcado(texto: string, cor = COR.tinta): string {
  return semQuebraNoValor(escapar(texto)).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${cor};font-weight:600">$1</strong>`)
}

function semMarcas(texto: string): string {
  return texto.replace(/\*\*(.+?)\*\*/g, '$1')
}

function numero(valor: number): string {
  return valor.toLocaleString('pt-BR')
}

function blocoEmHtml(bloco: Bloco): string {
  switch (bloco.tipo) {
    case 'texto':
      return `<p style="margin:0 0 16px;font-family:${CORPO};font-size:15px;line-height:1.65;color:${COR.texto}">${marcado(bloco.texto)}</p>`

    case 'botao': {
      const botao = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="botao" style="margin:8px 0 ${bloco.extenso ? 12 : 22}px"><tr>
<td align="center" bgcolor="${COR.primaria}" style="border-radius:12px;background:${COR.primaria}">
<a href="${escapar(bloco.link)}" target="_blank" style="display:block;padding:14px 26px;font-family:${CORPO};font-size:15px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:12px">${escapar(bloco.rotulo)}</a>
</td></tr></table>`
      if (!bloco.extenso) return botao
      return `${botao}
<p style="margin:0 0 20px;font-family:${CORPO};font-size:12px;line-height:1.55;color:${COR.apagado}">Se o botão não abrir, copie este endereço no navegador:<br><a href="${escapar(bloco.link)}" target="_blank" style="color:${COR.primariaForte};text-decoration:underline;word-break:break-all">${escapar(bloco.link)}</a></p>`
    }

    case 'fatos': {
      const linhas = bloco.linhas
        .map(
          (linha, i) => `<tr>
<td style="padding:13px 18px;${i > 0 ? `border-top:1px solid ${COR.linha};` : ''}font-family:${CORPO};font-size:13px;line-height:1.4;color:${COR.apagado}">${escapar(linha.rotulo)}</td>
<td align="right" style="padding:13px 18px;${i > 0 ? `border-top:1px solid ${COR.linha};` : ''}font-family:${CORPO};font-size:14px;line-height:1.4;font-weight:600;color:${COR.tinta}">${semQuebraNoValor(escapar(linha.valor))}</td>
</tr>`,
        )
        .join('')
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;background:${COR.superficie};border:1px solid ${COR.linhaSuave};border-radius:14px;border-collapse:separate">${linhas}</table>`
    }

    case 'medidor': {
      const tom = TOM[bloco.tom]
      const proporcao = bloco.total > 0 ? bloco.usado / bloco.total : 0
      const cheio = Math.max(2, Math.min(100, Math.round(proporcao * 100)))
      const trilho =
        cheio >= 100
          ? `<td height="10" bgcolor="${tom.cheio}" style="height:10px;line-height:10px;font-size:0;background:${tom.cheio};border-radius:999px">&nbsp;</td>`
          : `<td width="${cheio}%" height="10" bgcolor="${tom.cheio}" style="height:10px;line-height:10px;font-size:0;background:${tom.cheio};border-radius:999px 0 0 999px">&nbsp;</td><td height="10" bgcolor="${COR.trilho}" style="height:10px;line-height:10px;font-size:0;background:${COR.trilho};border-radius:0 999px 999px 0">&nbsp;</td>`
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;background:${COR.superficie};border:1px solid ${COR.linhaSuave};border-radius:14px;border-collapse:separate"><tr><td style="padding:18px 18px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${TITULO};font-size:24px;line-height:1;font-weight:700;letter-spacing:-0.02em;color:${COR.tinta}">${numero(bloco.usado)}<span style="font-family:${CORPO};font-size:14px;font-weight:400;letter-spacing:0;color:${COR.apagado}"> de ${numero(bloco.total)}</span></td>
<td align="right" style="font-family:${CORPO};font-size:13px;font-weight:600;color:${tom.tinta}">${numero(Math.round(proporcao * 100))}%</td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 10px;border-collapse:separate"><tr>${trilho}</tr></table>
<p style="margin:0;font-family:${CORPO};font-size:12.5px;line-height:1.5;color:${COR.apagado}">${marcado(bloco.legenda)}</p>
</td></tr></table>`
    }

    case 'passos':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px">${bloco.itens
        .map(
          (item, i) => `<tr>
<td width="44" valign="top" style="padding:0 0 18px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="30" height="30" align="center" valign="middle" bgcolor="${TOM.marca.fundo}" style="width:30px;height:30px;border-radius:999px;background:${TOM.marca.fundo};font-family:${TITULO};font-size:14px;font-weight:700;color:${TOM.marca.tinta}">${i + 1}</td></tr></table></td>
<td valign="top" style="padding:4px 0 18px">
<p style="margin:0 0 3px;font-family:${CORPO};font-size:15px;line-height:1.4;font-weight:600;color:${COR.tinta}">${escapar(item.titulo)}</p>
<p style="margin:0;font-family:${CORPO};font-size:14px;line-height:1.55;color:${COR.texto}">${marcado(item.texto)}</p>
</td></tr>`,
        )
        .join('')}</table>`

    case 'nota': {
      const tom = TOM[bloco.tom ?? 'marca']
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;border-collapse:separate"><tr>
<td bgcolor="${tom.fundo}" style="padding:14px 16px;background:${tom.fundo};border-left:3px solid ${tom.cheio};border-radius:0 12px 12px 0;font-family:${CORPO};font-size:13.5px;line-height:1.55;color:${tom.tinta}">${marcado(bloco.texto, tom.tinta)}</td>
</tr></table>`
    }
  }
}

function blocoEmTexto(bloco: Bloco): string {
  switch (bloco.tipo) {
    case 'texto':
      return semMarcas(bloco.texto)
    case 'botao':
      return `${bloco.rotulo}: ${bloco.link}`
    case 'fatos':
      return bloco.linhas.map((linha) => `${linha.rotulo}: ${linha.valor}`).join('\n')
    case 'medidor':
      return `${numero(bloco.usado)} de ${numero(bloco.total)} (${numero(Math.round((bloco.total > 0 ? bloco.usado / bloco.total : 0) * 100))}%). ${semMarcas(bloco.legenda)}`
    case 'passos':
      return bloco.itens.map((item, i) => `${i + 1}. ${item.titulo}: ${semMarcas(item.texto)}`).join('\n')
    case 'nota':
      return semMarcas(bloco.texto)
  }
}

/**
 * O e-mail pronto para a Brevo.
 *
 * `painel` é o endereço do rodapé: o de produção em produção, o local no
 * desenvolvimento (`enderecoParaEmail`).
 */
export function montarEmail(email: Email, painel: string): EmailMontado {
  const tom = TOM[email.selo.tom]
  const corpo = email.blocos.map(blocoEmHtml).join('\n')

  const html = `<!doctype html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapar(email.assunto)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Outfit:wght@600;700&display=swap" rel="stylesheet">
<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table{border-collapse:collapse}
a{color:${COR.primariaForte}}
@media only screen and (max-width:600px){
.casca{padding:24px 12px !important}
.miolo{padding:30px 22px 26px !important}
.titulo{font-size:23px !important}
.botao{width:100% !important}
}
</style>
</head>
<body style="margin:0;padding:0;background:${COR.fundo}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${COR.fundo}">${escapar(email.previa)}${'&#8199;&#65279;&#847; '.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.fundo}" style="background:${COR.fundo}">
<tr><td align="center" class="casca" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">

<tr><td style="padding:0 4px 20px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="40" height="40" align="center" valign="middle" bgcolor="#ffffff" style="width:40px;height:40px;background:#ffffff;border:1px solid ${COR.linha};border-radius:12px"><img src="${LOGO}" width="26" height="26" alt="" style="display:block;width:26px;height:26px;border:0"></td>
<td style="padding-left:11px;font-family:${TITULO};font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${COR.tinta}">Dialogon</td>
</tr></table>
</td></tr>

<tr><td>
<div style="background:${COR.cartao};border:1px solid ${COR.linha};border-radius:20px;overflow:hidden">
<div style="height:4px;line-height:4px;font-size:0;background:${COR.primaria};background-image:linear-gradient(90deg,#22d3ee 0%,#2563eb 52%,#7c3aed 100%)">&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.cartao}" style="background:${COR.cartao}">
<tr><td class="miolo" style="padding:38px 40px 30px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${tom.fundo}" style="padding:5px 11px;background:${tom.fundo};border-radius:999px;font-family:${CORPO};font-size:11px;line-height:1.3;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${tom.tinta}">${escapar(email.selo.texto)}</td></tr></table>
<h1 class="titulo" style="margin:18px 0 14px;font-family:${TITULO};font-size:26px;line-height:1.22;font-weight:700;letter-spacing:-0.02em;color:${COR.tinta}">${escapar(email.titulo)}</h1>
${corpo}
</td></tr>
</table>
</div>
</td></tr>

<tr><td align="center" style="padding:24px 20px 0;font-family:${CORPO};font-size:12px;line-height:1.6;color:${COR.apagado}">
<p style="margin:0 0 6px">${escapar(email.motivo)}</p>
<p style="margin:0 0 6px">Dúvidas? Escreva para <a href="mailto:${CONTATO}" style="color:${COR.apagado};text-decoration:underline">${CONTATO}</a>.</p>
<p style="margin:0"><a href="${escapar(painel)}" target="_blank" style="color:${COR.apagado};text-decoration:underline">Abrir o Dialogon</a> &middot; um produto 4YU</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  const texto = [
    email.titulo,
    ...email.blocos.map(blocoEmTexto),
    email.motivo,
    `Dúvidas? Escreva para ${CONTATO}.`,
    `Dialogon, um produto 4YU: ${painel}`,
  ].join('\n\n')

  return { assunto: email.assunto, html, texto }
}
