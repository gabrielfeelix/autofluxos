"""Quebra um PDF em trechos para a base de conhecimento (docs/BASE-DE-CONHECIMENTO.md).

    python3 scripts/conhecimento/extrair_pdf.py <arquivo.pdf> "<nome da fonte>" <saida.json>

Sai um JSON com [{fonte, secao, pagina, ordem, texto}], que
`scripts/conhecimento/importar.mts` grava na conta. Precisa de `pypdf`.

Desfaz o texto "e s p a ç a d o" que alguns PDFs devolvem (o Manual Solar
Buy-Side vem todo assim), tira cabeçalho, rodapé e número de página, guarda o
último título visto como seção e corta cada página em trechos de até ~1.400
caracteres, sem partir parágrafo no meio quando dá.
"""
import json
import re
import sys

import pypdf

MAX = 1400


def desespacar(linha: str) -> str:
    pedacos = [p for p in linha.strip().split(' ') if p]
    if len(pedacos) < 4:
        return linha.strip()
    soltas = sum(1 for p in pedacos if len(p) == 1)
    if soltas / len(pedacos) < 0.6:
        return linha.strip()
    return ' '.join(p.replace(' ', '') for p in re.split(r' {2,}', linha.strip())).strip()


RUIDO = re.compile(r'^(IR PARA|O ÍNDICE|AO ÍNDICE|PARA O ÍNDICE|VOLTAR|\d{1,3}|.*COPYRIGHT.*|.*Copyright.*)$')
# Seção é só título numerado em maiúsculas ("14.0 LEILÃO REVERSO..."): linha
# de tabela em maiúsculas ("10 WEG 20 LUXPOWER") não vira seção.
TITULO = re.compile(r'^\d{1,2}\.\d{1,2}\s*[-\u2013\u2014.:]?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^a-zà-ú]{5,}$')


def main() -> None:
    arquivo, fonte, saida = sys.argv[1], sys.argv[2], sys.argv[3]
    leitor = pypdf.PdfReader(arquivo)
    trechos = []
    secao = ''
    for numero, pagina in enumerate(leitor.pages, start=1):
        linhas = [desespacar(l) for l in (pagina.extract_text() or '').splitlines()]
        corpo = []
        for linha in linhas:
            if not linha or RUIDO.match(linha):
                continue
            if TITULO.match(linha) and len(linha) <= 120:
                secao = linha.replace('\u2014', '-').replace('\u2013', '-')
                corpo.append('')
                corpo.append(secao)
                continue
            corpo.append(linha)
        texto = re.sub(r'[ \t]+', ' ', '\n'.join(corpo)).replace('\u2014', '-').replace('\u2013', '-')
        texto = re.sub(r'\n{3,}', '\n\n', texto).strip()
        if len(texto) < 80:
            continue
        # Junta linha quebrada no meio da frase; mantém item e título em linha própria.
        texto = re.sub(r'(?<=[a-zà-ú,])\n(?=[a-zà-ú])', ' ', texto)
        atual = ''
        for paragrafo in re.split(r'\n', texto):
            if len(atual) + len(paragrafo) + 1 > MAX and atual:
                trechos.append({'fonte': fonte, 'secao': secao[:200], 'pagina': numero, 'texto': atual.strip()})
                atual = ''
            while len(paragrafo) > MAX:
                trechos.append({'fonte': fonte, 'secao': secao[:200], 'pagina': numero, 'texto': paragrafo[:MAX]})
                paragrafo = paragrafo[MAX:]
            atual += paragrafo + '\n'
        if atual.strip():
            trechos.append({'fonte': fonte, 'secao': secao[:200], 'pagina': numero, 'texto': atual.strip()})
    for i, t in enumerate(trechos):
        t['ordem'] = i
    with open(saida, 'w', encoding='utf-8') as f:
        json.dump(trechos, f, ensure_ascii=False, indent=1)
    print(f'{fonte}: {len(leitor.pages)} páginas, {len(trechos)} trechos, {sum(len(t["texto"]) for t in trechos)} caracteres')


if __name__ == '__main__':
    main()
