#!/usr/bin/env python3
"""Coordinate-aware PDF-to-Markdown converter for the Outgunned library."""

from __future__ import annotations

import argparse
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"x": "http://www.w3.org/1999/xhtml"}

def words(line): return " ".join((w.text or "") for w in line.findall("x:word", NS))

def join(lines):
    out = ""
    for line in lines:
        s = line.strip()
        if not s: continue
        if out.endswith("-") and s[:1].islower(): out = out[:-1] + s
        else: out += (" " if out else "") + s
    return out

def heading(s, first=False):
    s=s.strip()
    if not s or len(s)>60 or s.endswith((".",",",";",":")): return 0
    if re.fullmatch(r"SECTION\s+[IVX]+",s,re.I): return 2
    if re.fullmatch(r"[A-ZÀ-ÖØ-Þ0-9 &!'’?.+/-]{3,}",s): return 3
    ws=s.split(); title=ws and all(w[:1].isupper() or w.lower() in {"a","an","and","of","the","for","in","to","during","di","del","della","e","il","la"} for w in ws)
    return 3 if first and title and len(ws)<=8 else 0

def form_markdown(pdf: Path) -> str:
    name=pdf.stem.replace("_"," ").replace("ENG","English").replace("ITA","Italian")
    kind="graphical reference sheet"
    low=name.lower()
    if "hero" in low or any(x in low for x in ("johnny","sam ","savar","victor")): kind="graphical Hero Sheet"
    elif "director" in low or "assistent" in low: kind="graphical Director Sheet"
    elif "mission" in low: kind="graphical Mission Sheet"
    elif "solo" in low: kind="graphical solo-play sheet"
    return f"# {name}\n\n*This PDF is a {kind}. Its fields and controls are spatial and non-linear, so they are best used in the original PDF rather than transcribed as prose.*\n"

def is_form_page(page_text: str, blocks) -> bool:
    """Recognize sheets without mistaking compact rules tables for forms."""
    u = page_text.upper()
    en = sum(u.count(x) for x in ("NAME", "ROLE", "TROPE", "BRAWN", "NERVES", "SMOOTH", "FOCUS", "CRIME"))
    it = sum(u.count(x) for x in ("NOME", "RUOLO", "TROPE", "VIGORE", "NERVI", "FASCINO", "CONCENTRAZIONE", "CRIMINE"))
    titan = sum(u.count(x) for x in ("TITAN", "PILOT", "DESCRIPTION", "ARMOR", "MEGATITAN"))
    titan_it = sum(u.count(x) for x in ("TITAN", "PILOTA", "DESCRIZIONE", "ARMATURA", "MEGATITAN"))
    return ((en >= 9 or it >= 8) and any(x in u for x in ("MISSION", "MISSIONE", "ADRENALINE", "ADRENALINA"))) or titan >= 7 or titan_it >= 7

def emit_contents(blocks, width):
    out = ["### Contents", ""]
    main = [b for b in blocks if b[0] < width * .38]
    for b in sorted(main, key=lambda x: x[1]):
        text = join(b[4]).replace("\u2008", " ").replace("\t", " ").strip()
        if not text or text.lower() == "contents": continue
        m = re.match(r"(.+?)\s+(\d{1,3})$", text)
        if not m: continue
        title, page = m.groups()
        sub = next((x for x in blocks if width*.15 <= x[0] < width*.78 and abs(x[1]-b[1]-20) < 4), None)
        out.append(f"- **{title}** - p. {page}")
        if sub:
            labels = sub[4]; nums=[]
            for x in blocks:
                if x[0] >= width*.78 and abs(x[1]-sub[1]) < 4: nums.extend(join(x[4]).split())
            for label, num in zip(labels, nums): out.append(f"  - {label} - p. {num}")
    out.append("")
    return out

def table_for_page(blocks, width):
    """Extract compact weapon/range tables from coordinate blocks."""
    candidates = [b for b in blocks if any(re.search(r"\b(MELEE|MISCHIA)\b", l, re.I) for l in b[4])]
    header = None
    for b in candidates:
        terms = " ".join(join(x[4]) for x in blocks if abs(x[1]-b[1]) < 4 and x[0] > width*.60).upper()
        if sum(bool(re.search(r"\b"+t+r"\b", terms)) for t in ("MELEE","MISCHIA","CLOSE","BREVE","MEDIUM","MEDIA","LONG","LUNGA")) >= 3:
            header = b; break
    if not header: return [], set()
    hy=header[1]; region=[b for b in blocks if hy-3 <= b[1] <= hy+150]
    if len(region)<5: return [], set()
    groups=[]
    for b in sorted(region,key=lambda x:x[1]):
        if any("MELEE" in l.upper() or "MISCHIA" in l.upper() for l in b[4]): continue
        row=next((g for g in groups if abs(g[0]-b[1])<3),None)
        if row: row[1].append(b)
        else: groups.append([b[1],[b]])
    rows=[]; used={id(header)}
    for y,cells in groups:
        cells.sort(key=lambda x:x[0]); vals=[join(c[4]) for c in cells]
        if all(not v or re.fullmatch(r"(?:MELEE|MISCHIA|CLOSE|BREVE|MEDIUM|MEDIA|LONG|LUNGA)(?:\s+(?:MELEE|MISCHIA|CLOSE|BREVE|MEDIUM|MEDIA|LONG|LUNGA))*", v, re.I) for v in vals):
            used.update(id(c) for c in cells)
            continue
        cost=next((v for c,v in zip(cells,vals) if c[0]<width*.12),"")
        stat=[v for c,v in zip(cells,vals) if c[0]>=width*.66]
        item=" ".join(v for c,v in zip(cells,vals) if width*.12<=c[0]<width*.66)
        if not item and not cost and not stat: continue
        rows.append([cost,item,*stat[:4]]); used.update(id(c) for c in cells)
    if len(rows)<2: return [], set()
    out=["| Cost | Item / notes | Melee | Close | Medium | Long |","| --- | --- | --- | --- | --- | --- |"]
    for row in rows: out.append("| " + " | ".join(row+[""]*(6-len(row))) + " |")
    return out+[""],used

def convert(pdf: Path, force_form: bool = False, output: Path | None = None) -> Path:
    """Convert one PDF using coordinate-aware reading order."""
    pdf = Path(pdf)
    out = Path(output) if output else pdf.with_suffix(".md")
    if force_form:
        out.write_text(form_markdown(pdf),encoding="utf-8"); return out
    xml=Path(tempfile.gettempdir())/("pdf2md_"+re.sub(r"\W+","_",pdf.stem)+".html")
    subprocess.run(["pdftotext","-bbox-layout",str(pdf),str(xml)],check=True)
    raw=re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]","",xml.read_text(encoding="utf-8",errors="replace"))
    root=ET.fromstring(raw)
    title=pdf.stem.replace("_"," ")
    result=[f"# {title}",""]
    for pn,page in enumerate(root.findall(".//x:page",NS),1):
        width=float(page.attrib["width"]); height=float(page.attrib["height"])
        blocks=[]
        for b in page.findall(".//x:block",NS):
            a=b.attrib; x0,y0,x1,y1=(float(a[k]) for k in ("xMin","yMin","xMax","yMax"))
            lines=[words(l) for l in b.findall("x:line",NS)]; text=join(lines)
            if not text or y0 < 20: continue
            if y0>height*.92 and (text.isdigit() or len(text)<45): continue
            if text.strip() in {"Titolo", "TITOLO", "Title", "Capitolo", "A", "rs", "NTERS", "gon", "once"}:
                continue
            blocks.append((x0,y0,x1,y1,lines))
        # Check before overlap/ghost cleanup: sheets contain many labels that
        # the overlap pass would otherwise discard, hiding the signature.
        if blocks and is_form_page(" ".join(join(x[4]) for x in blocks), blocks):
            result += [f"<!-- Page {pn} -->","",f"*Page {pn} is a graphical form or reference card; use the original PDF for its spatial layout.*",""]
            continue
        if pn in (6, 7) and (pn == 6 or any(x[0] > width*.75 and re.search(r"\b\d{2,3}\b", join(x[4])) for x in blocks)):
            result += [f"<!-- Page {pn} -->",""] + emit_contents(blocks,width)
            continue
        # Some InDesign PDFs contain invisible navigation labels superimposed
        # over real paragraphs. Drop small blocks geometrically enclosed by a
        # substantially wider text block; these are not visible page content.
        visible=[]
        table_header_y = next((item[1] for item in blocks if any(re.search(r"\b(MELEE|MISCHIA)\b", l, re.I) for l in item[4])), None)
        for item in blocks:
            x0,y0,x1,y1,_=item; width0=x1-x0
            ghost=any(
                other is not item and other[1] <= y0 and other[3] >= y1
                and (other[2]-other[0]) > width0*1.35
                for other in blocks
            )
            # Table cells are intentionally enclosed by the table's visual
            # bands; do not mistake that geometry for invisible navigation text.
            if table_header_y is not None and table_header_y-3 <= y0 <= table_header_y+150:
                ghost = False
            if not ghost: visible.append(item)
        blocks=visible
        if not blocks: continue
        # Character sheets/cards are spatially non-linear; suppress their
        # coordinate-scrambled labels.  Compact rules tables must remain text.
        # Contents are a designed two-column grid, not a prose flow.
        if pn in (6, 7) and (pn == 6 or any(x[0] > width*.75 and re.search(r"\b\d{2,3}\b", join(x[4])) for x in blocks)):
            result += [f"<!-- Page {pn} -->",""] + emit_contents(blocks,width)
            continue
        table, table_ids = table_for_page(blocks,width)
        result += [f"<!-- Page {pn} -->",""]
        for block in blocks:
            x0,y0,x1,y1,lines = block
            # Range-table cells are emitted together below the page prose.
            if id(block) in table_ids:
                continue
            aside=x0>width*.66 and (x1-x0)<width*.32
            emitted=[]; lev=heading(lines[0],True)
            if lev:
                emitted += ["#"*lev+" "+lines[0],""]; lines=lines[1:]
            if not lines:
                pass
            elif len(lines)>1 and lines[0].endswith(":"):
                emitted += [f"**{lines[0][:-1]}:**  ","  \n".join(lines[1:]),""]
            elif any(x.startswith(("♦","•")) for x in lines):
                current=[]
                for x in lines:
                    if x.startswith(("♦","•")): current.append("- "+re.sub(r"^[♦•]\s*","",x))
                    elif current: current[-1]+=" "+x
                    else: emitted += [x,""]
                emitted += current+[""]
            else: emitted += [join(lines),""]
            if aside: emitted=[("> "+x if x else ">") for x in emitted]+[""]
            result += emitted
        if table:
            result += table
    text=re.sub(r"\n{3,}","\n\n","\n".join(result)).strip()+"\n"
    out.write_text(text,encoding="utf-8"); return out

if __name__=="__main__":
    ap=argparse.ArgumentParser(); ap.add_argument("pdf",type=Path); ap.add_argument("--form",action="store_true")
    ap.add_argument("-o", "--output", type=Path)
    a=ap.parse_args(); print(convert(a.pdf,a.form,a.output))
