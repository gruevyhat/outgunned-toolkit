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

def clean_line(s):
    # PDF word extraction often leaves a discretionary hyphen plus a space in
    # the middle of a word, and some releases expose ligatures as private text.
    s = re.sub(r"-\s+([a-zà-öø-ÿ])", r"\1", s)
    s = (s.replace("ﬁ", "fi").replace("ﬂ", "fl").replace("ﬀ", "ff")
         .replace("ﬃ", "ffi").replace("ﬄ", "ffl").replace("\u2008", " "))
    return re.sub(r"\s+", " ", s).strip()

def join(lines):
    out = ""
    for line in lines:
        s = clean_line(line.strip())
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

def convert(pdf: Path, force_form: bool = False, output: Path | None = None) -> Path:
    """Convert a Superheroes PDF while suppressing spatial form labels."""
    pdf = Path(pdf)
    out = Path(output) if output else pdf.with_suffix(".md")
    if force_form:
        out.write_text(form_markdown(pdf),encoding="utf-8"); return out
    xml=Path(tempfile.gettempdir())/("pdf2md_"+re.sub(r"\W+","_",pdf.stem)+".html")
    subprocess.run(["pdftotext","-bbox-layout",str(pdf),str(xml)],check=True)
    raw=re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]","",xml.read_text(encoding="utf-8",errors="replace"))
    root=ET.fromstring(raw)
    stem = pdf.stem.lower()
    # These pages contain a printable sheet/card. Their labels are spatial
    # controls, not prose; retaining them creates the same scrambled headings
    # that the graphical original avoids.
    full_forms = set()
    partial_forms = {}
    if "outgunned_superheroes" in stem:
        full_forms = set(range(260, 266))
        partial_forms = {19: 350}
    elif "quickstart" in stem:
        full_forms = set(range(66, 70))
        partial_forms = {12: 350, 13: 340}
    elif "king_of_ashes" in stem:
        full_forms = set(range(60, 64))
    title=pdf.stem.replace("_"," ")
    result=[f"# {title}",""]
    for pn,page in enumerate(root.findall(".//x:page",NS),1):
        width=float(page.attrib["width"]); height=float(page.attrib["height"])
        blocks=[]
        for b in page.findall(".//x:block",NS):
            a=b.attrib; x0,y0,x1,y1=(float(a[k]) for k in ("xMin","yMin","xMax","yMax"))
            lines=[clean_line(words(l)) for l in b.findall("x:line",NS)]; text=join(lines)
            if not text or y0 < 20: continue
            if y0>height*.92 and (text.isdigit() or len(text)<45): continue
            blocks.append((x0,y0,x1,y1,lines))
        # Some InDesign PDFs contain invisible navigation labels superimposed
        # over real paragraphs. Drop small blocks geometrically enclosed by a
        # substantially wider text block; these are not visible page content.
        visible=[]
        for item in blocks:
            x0,y0,x1,y1,_=item; width0=x1-x0
            ghost=any(
                other is not item and other[1] <= y0 and other[3] >= y1
                and (other[2]-other[0]) > width0*1.35
                for other in blocks
            )
            if not ghost: visible.append(item)
        blocks=visible
        if not blocks: continue
        if pn in full_forms:
            result += [f"<!-- Page {pn} -->", "",
                       "*This page is a graphical Hero Sheet. Use the original PDF for its printable, spatial layout.*", ""]
            continue
        if pn in partial_forms:
            cutoff = partial_forms[pn]
            kept = [b for b in blocks if b[1] < cutoff]
            if not kept:
                result += [f"<!-- Page {pn} -->", "",
                           "*This page includes a graphical Hero Sheet. Use the original PDF for its printable, spatial layout.*", ""]
                continue
            blocks = kept
        # Pages dominated by tiny isolated labels are graphical forms/cards.
        tiny=sum(len(join(x[4]).split())<=3 for x in blocks)
        contents_continuation = (("outgunned_superheroes" in stem and pn == 7) or
                                 ("quickstart" in stem and pn == 4))
        if len(blocks)>=14 and tiny/len(blocks)>.72 and not contents_continuation:
            result += [f"<!-- Page {pn} -->","",f"*Page {pn} is a graphical form or reference card; use the original PDF for its spatial layout.*",""]
            continue
        result += [f"<!-- Page {pn} -->",""]
        for x0,y0,x1,y1,lines in blocks:
            aside=x0>width*.66 and (x1-x0)<width*.32
            emitted=[]; lev=heading(lines[0],True)
            if lev:
                emitted += ["#"*lev+" "+lines[0],""]; lines=lines[1:]
            if not lines:
                pass
            elif any(x.startswith(("♦","•")) for x in lines):
                current=[]
                for x in lines:
                    x = clean_line(x)
                    if x.startswith(("♦","•")): current.append("- "+re.sub(r"^[♦•]\s*","",x))
                    elif current:
                        previous = current[-1]
                        if previous.endswith("-") and x[:1].islower():
                            current[-1] = previous[:-1] + x
                        else:
                            current[-1] = previous + " " + x
                    else: emitted += [x,""]
                emitted += current+[""]
            elif len(lines)>1 and lines[0].endswith(":"):
                emitted += [f"**{lines[0][:-1]}:**  ","  \n".join(lines[1:]),""]
            else: emitted += [join(lines),""]
            if aside: emitted=[("> "+x if x else ">") for x in emitted]+[""]
            result += emitted
        if pn in partial_forms:
            result += ["", "*The remainder of this page is a graphical Hero Sheet; use the original PDF for its printable, spatial layout.*", ""]
    text=re.sub(r"\n{3,}","\n\n","\n".join(result)).strip()+"\n"
    out.write_text(text,encoding="utf-8"); return out

if __name__=="__main__":
    ap=argparse.ArgumentParser(); ap.add_argument("pdf",type=Path); ap.add_argument("--form",action="store_true")
    ap.add_argument("-o", "--output", type=Path)
    a=ap.parse_args(); print(convert(a.pdf,a.form,a.output))
