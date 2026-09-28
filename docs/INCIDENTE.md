# Incidente de segurança: o que fazer, em ordem

Uma página, para ser lida com pressa. Vale para AutoFluxos; se o incidente
tocar o banco, vale também para a Verandi (mesmo projeto Supabase, ver
`BANCO-COMPARTILHADO.md`).

**Incidente** é qualquer suspeita de que alguém de fora viu, mudou ou apagou
dado, ou usou uma credencial nossa: chave em commit ou print, login estranho
na auditoria, gasto de IA fora do normal, cliente dizendo que recebeu
mensagem que não mandou.

## 1. Conter (primeira hora)

Revogue primeiro, investigue depois. Apagar commit não resolve: o que foi ao
GitHub já foi clonado.

| O que vazou ou pode ter vazado | Onde revogar |
|---|---|
| Sessões de uma pessoa | `/admin/usuarios`, "derrubar sessões" |
| Sessões de todo mundo | trocar `BETTER_AUTH_SECRET` na Vercel e publicar de novo (derruba todos os logins e os links de OAuth em andamento) |
| Chave do Supabase | painel do Supabase, projeto `autofluxos`, Settings > API Keys: criar outra secret key, trocar na Vercel, apagar a antiga |
| Senha do Postgres (`DATABASE_URL`) | painel do Supabase, Settings > Database > Reset password; trocar na Vercel |
| Token do WhatsApp / segredo do app Meta | developers.facebook.com, app do AutoFluxos: gerar novo e trocar na Vercel |
| Token de canal de cliente (no Vault) | pedir ao cliente para reconectar o canal na tela de canais |
| Chave de IA (Gemini, Groq) | console do provedor: apagar a chave e criar outra |
| `VERCEL_TOKEN`, `GITHUB_TOKEN`, chave do Google | seguir o `CLAUDE.md` da pasta `4yu-apps`, seção "Se uma chave vazar" |
| Conta humana (GitHub, Vercel, Supabase, Meta, Google) | trocar a senha, derrubar sessões abertas, conferir MFA e chaves/apps autorizados |

Se o ataque está em curso e não há como estancar: Vercel > projeto >
Settings > pausar o projeto. O painel sai do ar; os webhooks da Meta ficam
tentando de novo e não se perdem por algumas horas.

## 2. Entender (primeiro dia)

- **Auditoria** (`/admin/auditoria`): logins (`entrou`), senha errada
  (`falhou_login`), entrar como, quem mudou o quê, com IP e navegador.
- **Alertas** (`/admin/alertas`): teto de IA estourado, falhas de envio.
- **Logs da Vercel**: requisições por rota e horário (guardam pouco tempo no
  plano atual: exporte já).
- **Supabase**: logs de API e do Postgres no painel.

Responder por escrito: o que foi alcançado, de quais contas, desde quando,
se havia dado pessoal, e o que já foi feito.

## 3. Comunicar

| Para quem | Quando | Por quê |
|---|---|---|
| Cliente afetado (a empresa, controladora) | **em até 24 h** da confirmação, como prometem os Termos | ela é quem comunica a ANPD e os clientes dela; precisa do nosso relato para isso |
| ANPD | **3 dias úteis** (Res. CD/ANPD 15/2024), se houver risco ou dano relevante a titulares e a 4YU for controladora do dado (ex.: dado dos próprios usuários do painel) | LGPD art. 48 |
| Meta | assim que souber, se envolver dado vindo do WhatsApp/Instagram | Platform Terms, seção de segurança de dados; formulário de incidente no developers.facebook.com |
| Verandi | no mesmo dia, se o banco foi tocado | mesmo projeto Supabase |

Modelo de aviso ao cliente: o que aconteceu, que dado foi afetado, o período,
o que já fizemos, o que ele precisa fazer (se algo), e quem responde as
perguntas dele.

## 4. Registrar

Todo incidente, **inclusive os que não foram comunicados**, entra em
`docs/incidentes/AAAA-MM-DD-nome-curto.md` e fica guardado por 5 anos (Res.
CD/ANPD 15/2024). O repositório é público: o registro descreve o que
aconteceu e o que foi feito, **nunca** chave, IP de pessoa, nome ou telefone
de cliente. Se precisar guardar essas evidências, elas vão para
`4yu-apps/.secrets/incidentes/`, fora de qualquer git.
