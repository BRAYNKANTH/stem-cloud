"""Render the user-supplied scans without OCR claims. Requires PyMuPDF (build only).

python tools/import_past_papers.py --source-dir "C:/.../tamil"
Renders the 2015 pilot. Existing reviewed banks for other years remain catalogued;
run build_physics_years.py to build their banks and render their illustrations.
"""
import argparse, hashlib, json, shutil
from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'site'/'lessons'/'past-papers'

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source-dir',required=True,type=Path)
    args=parser.parse_args()
    catalog=[]
    for year in range(2015,2024):
        files=list(args.source_dir.glob(f'gce-ordinary-level-exam-{year}-science-past-papers-*.pdf'))
        if len(files)!=1:
            raise ValueError(f'Expected exactly one source for {year}, found {len(files)}')
        source=files[0]
        with fitz.open(source) as doc:
            entry=dict(year=year, status='pilot' if year==2015 else 'pending-extraction',
                examLabel='2023 (2024)' if year==2023 else str(year), sourceFilename=source.name,
                sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),pages=len(doc))
            if year==2015:
                dest=OUT/'2015'; dest.mkdir(parents=True,exist_ok=True)
                shutil.copyfile(source,dest/'source.pdf')
                for i,page in enumerate(doc):
                    pix=page.get_pixmap(matrix=fitz.Matrix(2,2))
                    pix.save(dest/f'page-{i+1:02}.jpg',jpg_quality=85)
                # Preserve original diagram/typography panels beside the digital prompt.
                panels={2:(1,120,640,1060,729),8:(1,120,1070,1080,1160),17:(2,45,550,1050,850),18:(2,45,550,1050,850),
                    22:(2,45,1390,1030,1600),27:(3,60,577,1040,764),28:(3,60,750,1040,944),
                    30:(3,60,1030,1040,1320),31:(3,50,1310,1040,1610),
                    32:(4,105,115,1080,250),34:(4,105,452,1080,630),36:(4,105,715,1080,1025)}
                for number,(page,x0,y0,x1,y1) in panels.items():
                    doc[page-1].get_pixmap(matrix=fitz.Matrix(2,2),clip=fitz.Rect(x0/2,y0/2,x1/2,y1/2)).save(dest/f'mcq-{number:02}.jpg',jpg_quality=90)
                entry.update(bank='/lessons/past-papers/2015.json',scope="physics",mcqCount=14,writtenCount=5)
            bank_path=OUT/f'{year}.json'
            if year!=2015 and bank_path.exists():
                bank=json.loads(bank_path.read_text(encoding='utf-8'))
                if bank.get('scope')=='physics':
                    label={2017:'2017 · Old syllabus',2021:'2021 (2022)',2022:'2022 (2023)',2023:'2023 (2024)'}.get(year,str(year))
                    entry.update(status=bank['status'],examLabel=label,bank=f'/lessons/past-papers/{year}.json',scope='physics',mcqCount=sum(q['type']=='mcq' for q in bank['questions']),writtenCount=sum(q['type']=='written' for q in bank['questions']),coverageNote=bank.get('coverageNote'))
            catalog.append(entry)
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'catalog.json').write_text(json.dumps(dict(schemaVersion=1,papers=catalog),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Rendered 12 pilot pages; catalogued nine source papers.')

if __name__=='__main__': main()
