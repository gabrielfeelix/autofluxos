#!/bin/bash
# Filtro de nome puro (sem sufixo Chat): para cada nome, confere NOME.com.br
# livre (bloqueia), a raiz no INPI (nenhuma marca viva nas classes 9, 35, 38,
# 42) e o @ no Instagram; o .com sai só como informação. Uso:
# scripts/naming/filtro-puro.sh nome1 nome2 ...
S=$(mktemp -d); J="$S/inpi.cookie"
curl -s -c "$J" -b "$J" -o /dev/null -m 20 "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login"
for r in "$@"; do
  n="${r}"
  br=$(curl -s -o /dev/null -w "%{http_code}" "https://rdap.registro.br/domain/$n.com.br"); sleep 1
  [ "$br" = 404 ] || { echo "x $r dominio.br"; continue; }
  com=$(curl -s -o /dev/null -w "%{http_code}" "https://rdap.verisign.com/com/v1/domain/$n.com")
  curl -s -c "$J" -b "$J" -m 150 -A "Mozilla/5.0" "https://busca.inpi.gov.br/pePI/servlet/MarcasServletController" --data "buscaExata=sim&txt=&marca=$r&classeInter=&registerPerPage=100&botao=+pesquisar+%BB+&Action=searchMarca&tipoPesquisa=BY_MARCA_CLASSIF_BASICA" | iconv -f latin1 -t utf-8 2>/dev/null > "$S/f.html"
  res=$(python3 -I - "$S/f.html" <<'PY'
import re,sys,html
t=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
if not t: print('SEM'); sys.exit()
txt=re.sub(r'<[^>]+>',' ',t)
if 'Nenhum resultado' in txt: print('0 0'); sys.exit()
m=re.search(r'Foram encontrados\s*(\d+)',txt)
if not m: print('SEM'); sys.exit()
viva=0
for r in re.findall(r'<tr[^>]*>(.*?)</tr>',t,re.S|re.I):
    c=[html.unescape(re.sub(r'<[^>]+>','',x)).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>',r,re.S|re.I)]
    c=[x for x in c if x]
    if len(c)>=5 and c[0][:1].isdigit():
        sit=c[3].lower(); cls=[x for x in re.findall(r'\d+',c[-1]) if x in ('9','09','35','38','42')]
        if cls and not any(k in sit for k in ('extint','arquiv','indeferid')): viva+=1
print(m.group(1), viva)
PY
)
  [ "$res" = SEM ] && { echo "? $r INPI sem resposta"; continue; }
  tot=${res% *}; viva=${res#* }
  [ "$viva" = 0 ] || { echo "x $r INPI $viva vivas"; continue; }
  ig=$(curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "https://www.instagram.com/$n/" | grep -c 'og:title')
  echo "OK $n | com:$com | INPI raiz: $tot marcas, 0 em software | ig_ocupado:$ig"
done
