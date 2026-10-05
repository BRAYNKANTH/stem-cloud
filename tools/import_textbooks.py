# -*- coding: utf-8 -*-
"""Copy supplied original PDFs byte for byte and check all mapped page numbers."""
import argparse,hashlib,json,re,shutil
from pathlib import Path
import fitz
from textbook_sources import SOURCES,READING,ROOT

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source-dir',required=True,type=Path)
    args=parser.parse_args();dest=ROOT/'site/lessons/textbooks';dest.mkdir(parents=True,exist_ok=True)
    books=[]
    for key,(filename,language,grade,part,chapter) in SOURCES.items():
        source=args.source_dir/filename
        data=source.read_bytes()
        with fitz.open(source) as doc:
            for readings in READING.values():
                for r in readings:
                    if r['bookId']!=key:continue
                    for pdf,printed in zip(r['pdfPages'],r['printedPages']):
                        assert 1<=pdf<=len(doc),(key,pdf)
                        assert re.search(rf'(?m)^\s*{printed}\s*$',doc[pdf-1].get_text()),(key,pdf,printed)
            title=dict(en=f'Science · Grade {grade} · Part {part}'+(f' · Chapter {chapter}' if chapter else ''),ta=f'விஞ்ஞானம் · தரம் {grade} · பகுதி {part}'+(f' · அத்தியாயம் {chapter}' if chapter else ''))
            books.append(dict(id=key,sourceFilename=filename,language=language,grade=grade,part=part,chapter=chapter,title=title,pages=len(doc),sha256=hashlib.sha256(data).hexdigest(),bytes=len(data),url=f'/lessons/textbooks/{key}.pdf'))
        shutil.copyfile(source,dest/f'{key}.pdf')
    (dest/'catalog.json').write_text(json.dumps(dict(schemaVersion=1,books=books),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Imported {len(books)} original textbooks/chapter extracts; verified mapped printed and PDF page endpoints.')

if __name__=='__main__':main()
