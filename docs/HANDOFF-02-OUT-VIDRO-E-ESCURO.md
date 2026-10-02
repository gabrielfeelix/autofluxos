# Handoff 02/out/2026: vidro em mais telas e revisão do dark mode

Sequência de `HANDOFF-02-OUT-ESQUELETOS-RESTO.md` (itens 1, 3, 6 e
transmissão feitos em `a60c98f`). Leia a entrada "vidro e Alternador
aprovados" em `docs/DECISIONS.md`.

## Pendente

1. **Dark mode, revisão geral** (pedido do dono: "o light ficou lindo, o dark
   tá feinho"). Feito só o fundo (degradê azul). Falta, com print 1440 e 390
   em escuro (`.ux-local/_escuro.mjs`, tema mora no `localStorage`
   `autofluxos:tema`, não em cookie):
   - cartões `--panel #111722` cinza-preto sobre azul: testar tom azulado
     (ex. `#121a2e`) para casar com a casca;
   - conferir vidro (`chip-vidro`, `alternador`) e pílulas no escuro;
   - inbox e ilha da barra: muito pretas ao lado da casca azul.
2. **Vidro em mais lugares**: procurar outros controles soltos no azul
   (botões de ferramenta, chips de etiqueta em `fluxos/templates.tsx` se
   estiverem fora de cartão). Variante nomeada, nunca `bg-white/10` solto.
3. **Print não conferido** das mudanças deste commit: abas da Inbox e do
   editor no Alternador, `ChipDeFiltro` em vidro, dark novo. A máquina estava
   com load ~30 e o dev levava 3 min por tela.
4. **Rádio do DS** (`.radio-de-marcar`): ainda sem decisão do dono.
5. **Esqueleto em 390** de 9 telas de Configurações/canais: não conferido;
   `canais/whatsapp` trava o `esqueletos.mjs` no `waitForURL`.

## Local

- Login de revisão tem 2FA. `.ux-local/_entrar-2fa.mjs` grava um segredo TOTP
  conhecido no banco Docker e entra.
- Commit só dos seus arquivos: outra sessão mexe em API/LP/ajuda.
