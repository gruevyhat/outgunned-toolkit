#!/usr/bin/env python3
"""Layout-aware PDF to Markdown conversion for Outgunned supplements."""
from __future__ import annotations
import argparse
import re
import subprocess
import tempfile
from pathlib import Path

LIST_RE = re.compile(r"^\s*[♦•]\s+")
PRICE_RE = re.compile(r"^\s*(\d+)\$\s+(.+?)\s*$")
TOC_RE = re.compile(r"^\s*(.+?)\s+(\d{1,3})\s*$")
FORM_MARKERS = ("NAME", "ROLE", "TROPE", "BRAWN", "NERVES", "SMOOTH", "FOCUS", "CRIME", "GRIT", "GUNS & GEAR", "ADRENALINE", "TREASURE")
ITEM_NAMES = sorted(("Elegant Clothes", "Lockpicking Set", "Tool-bag", "First-aid Kit", "Grappling Hook", "Winter Clothes", "Climbing Gear", "Camping Cookware", "Musical Instrument", "Old Ride", "Pistol/Revolver", "Hunting Rifle", "Machine Gun", "Gatling Gun", "Hunting Bow", "Machete/Axe", "Club/Hammer", "Rocket Launcher", "Projectiles", "Mags (2)", "Old Rifle", "Shotgun", "Dynamite", "Boomerang", "Knife", "Rope", "Compass", "Lantern", "Lighter", "Bow", "Whip", "Radio"), key=len, reverse=True)

def norm(s):
    s = s.replace("\x01", "♦").replace("\u2008", " ").replace("\t", "    ")
    s = re.sub(r"[\u2010\u2011\u2012\u2013\u2014\u2212]", "-", s)
    return s.rstrip()

def join(old, new):
    new = new.strip()
    if not new: return old
    if old.endswith("-") and new[:1].islower(): return old[:-1] + new
    return (old + " " + new).strip() if old else new

def trim(lines):
    lines = [norm(x) for x in lines]
    while lines and not lines[0].strip(): lines.pop(0)
    while lines and not lines[-1].strip(): lines.pop()
    out=[]
    for x in lines:
        s=x.strip()
        if re.fullmatch(r"\d{1,3}",s): continue
        if re.match(r"^(?:adventure|outgunned|world of killers|project medusa|fall of atlantis|quickstart rules)\s+\d{1,3}$",s,re.I): continue
        out.append(x)
    return out

def split_cols(lines):
    cuts=[]
    for x in lines:
        for m in re.finditer(r" {5,}",x):
            if 18 <= m.start() <= 78 and x[:m.start()].strip() and x[m.end():].strip(): cuts.append(m.start()); break
    if len(cuts)<7: return lines
    cut=sorted(cuts)[len(cuts)//2]
    if sum(bool(re.search(r"(?:^|\s)\d+\$|\b(?:Melee|Close|Medium|Long)\b",x)) for x in lines)>=8: return lines
    left=[]; right=[]
    for x in lines:
        if not x.strip(): left.append(""); right.append(""); continue
        spans=[m for m in re.finditer(r" {4,}",x) if abs(m.start()-cut)<=14]
        if spans:
            m=min(spans,key=lambda z:abs(z.start()-cut)); left.append(x[:m.start()].rstrip()); right.append(x[m.end():].strip())
        elif not x[:cut].strip(): left.append(""); right.append(x.strip())
        else: left.append(x.strip()); right.append("")
    while left and not left[-1].strip(): left.pop()
    while right and not right[0].strip(): right.pop(0)
    while right and not right[-1].strip(): right.pop()
    return left+([""] if left and right else [])+right if sum(bool(x.strip()) for x in right)>=5 else lines

def form_page(lines):
    non=[x for x in lines if x.strip()]
    text=" ".join(x.strip() for x in non).upper()
    markers=sum(k in text for k in FORM_MARKERS)
    short=sum(len(x.strip())<=22 for x in non)
    # A normal role description can mention attributes and gear, but it does
    # not contain the form's NAME/ROLE/TROPE field trio.  Requiring that trio
    # avoids classifying genuine prose as a sheet when the PDF uses a wide
    # invisible text frame (which inflates line lengths in -layout output).
    field_trio = all(re.search(r"(?:^|\s)" + k + r"(?:\s|$)", text) for k in ("NAME", "ROLE", "TROPE"))
    director = (re.search(r"(?:^|\s)HEROES(?:\s|$)", text)
                and re.search(r"(?:^|\s)(?:VILLAIN|ENEMIES)(?:\s|$)", text)
                and re.search(r"(?:^|\s)MISSION(?:\s|$)", text))
    return (field_trio and markers>=6 and len(non)>=8) or bool(director)

def graphic_only(lines):
    """Detect a page made almost entirely of isolated card/form labels."""
    non=[x for x in lines if x.strip()]
    short=sum(len(x.strip())<=12 for x in non)
    joined=" ".join(x.strip() for x in non)
    if "POLAROIDS OF THE CHARACTERS" in joined.upper(): return True
    return len(non)>=18 and short/max(len(non),1)>.72

def strip_graphic_prefix(lines):
    """Remove a leading graphical card while retaining its prose description."""
    non=[(i,x.strip()) for i,x in enumerate(lines) if x.strip()]
    if len(non)<12: return lines,False
    first=non[:10]
    marker=sum(any(k in s.upper().split() for k in ("NAME","HELP","FLAW","BRAWN","NERVES","SMOOTH","FOCUS","CRIME")) for _,s in first)
    if marker<3 or sum(len(s)<=24 for _,s in first)<7: return lines,False
    for i,s in non[8:]:
        if len(s)>=55: return lines[i:],True
    return lines,False

def strip_embedded(lines):
    for i,x in enumerate(lines):
        u=x.strip().upper()
        if (("NAME" in u and ("TREASURE" in u or "ROLE" in u)) or ("BRAWN" in u and "GRIT" in u and i>5)):
            return lines[:i],True
    return lines,False

def price_runs(lines):
    runs={}; i=0
    while i<len(lines):
        if not PRICE_RE.match(lines[i]): i+=1; continue
        rows=[]; j=i
        while j<len(lines):
            if not lines[j].strip(): j+=1; continue
            m=PRICE_RE.match(lines[j])
            if m:
                body=m.group(2).strip()
                item=next((name for name in ITEM_NAMES if body.startswith(name)), "")
                if item:
                    rows.append([m.group(1)+"$",item,body[len(item):].strip()])
                else:
                    parts=[x.strip() for x in re.split(r" {2,}",body,maxsplit=1) if x.strip()]
                    rows.append([m.group(1)+"$",parts[0],parts[1] if len(parts)>1 else ""])
                j+=1; continue
            # In a few grids, a wrapped row loses its cost glyph. Keep it
            # attached to the preceding row instead of creating fake prose.
            if rows and lines[j].strip().startswith("-"):
                rows[-1][2]=(rows[-1][2]+" "+lines[j].strip().lstrip("- ")).strip(); j+=1; continue
            break
        if len(rows)>=3: runs[i]=(j,[["Cost","Item","Description"]]+rows); i=j
        else: i+=1
    return runs

def heading(s,first=False):
    s=s.strip()
    if not s or len(s)>72 or LIST_RE.match(s) or s.endswith((".",",",";",":")): return 0
    if re.match(r"^SECTION\s+[IVX]+$",s,re.I): return 2
    if re.match(r"^(?:SHOT|SCENE|EPILOGUE)\s*(?:[.\-]\s*\d+|\d+|$)",s,re.I): return 3
    if re.fullmatch(r"[A-Z0-9 &!'’?.+/-]{3,}",s) and len(s.split())<=9: return 3
    ws=s.split(); title=all(w[:1].isupper() or w.lower() in {"a","an","and","of","the","for","in","to","on","with"} for w in ws)
    return 3 if title and len(ws)<=7 and (first or len(ws)<=4) else 0

def emit(lines,pn,toc=False):
    lines=trim(lines)
    if not lines: return []
    standalone_form=form_page(lines)
    # Strip a form before testing page density: embedded sheets often follow a
    # full page of genuine prose, while standalone sheets begin immediately
    # with NAME/ROLE/TROPE labels.
    lines,embedded=strip_embedded(lines)
    if not lines or standalone_form or (not embedded and form_page(lines)) or graphic_only(lines):
        return [f"<!-- Page {pn} -->","", "*Graphical character sheet or handout omitted from text transcription; refer to the original PDF.*"]
    lines,card=strip_graphic_prefix(lines)
    lines=split_cols(lines); runs=price_runs(lines)
    out=[f"<!-- Page {pn} -->",""]; para=""
    def flush():
        nonlocal para
        if para.strip(): out.extend([para.strip(),""])
        para=""
    i=0
    while i<len(lines):
        s=lines[i].strip()
        if not s: flush(); i+=1; continue
        if i in runs:
            flush(); end,rows=runs[i]; out.append("| "+" | ".join(rows[0])+" |"); out.append("| --- | --- | --- |")
            out += ["| "+" | ".join(v.replace("|","\\|") for v in row)+" |" for row in rows[1:]]+[""]; i=end; continue
        if toc:
            m=TOC_RE.match(s)
            if m and len(m.group(1).strip())>2: flush(); out.extend([f"- {m.group(1).strip()} - p. {m.group(2)}",""]); i+=1; continue
        lev=heading(s,first=(i==0 or not lines[i-1].strip()))
        if lev: flush(); out.extend(["#"*lev+" "+s,""]); i+=1; continue
        if LIST_RE.match(s):
            flush(); item=re.sub(r"^\s*[♦•]\s+","- ",s); i+=1
            while i<len(lines) and lines[i].strip() and not LIST_RE.match(lines[i].strip()):
                nxt=lines[i].strip()
                if heading(nxt): break
                item=join(item,nxt); i+=1
            out.extend([item,""]); continue
        if len(s)<=3 and not s.isalpha(): i+=1; continue
        para=join(para,s); i+=1
    flush()
    if embedded: out.extend(["*A graphical character sheet appears below the text in the original PDF; use the full-size printable sheet supplied with the game.*",""])
    if card: out.extend(["*A graphical reference card appears above this text in the original PDF.*",""])
    while out and not out[-1]: out.pop()
    return out

def convert(pdf: Path, output: Path | None = None) -> Path:
    """Convert one supplement PDF using its layout-preserving text flow."""
    pdf = Path(pdf)
    with tempfile.NamedTemporaryFile(suffix=".txt") as tmp:
        subprocess.run(["pdftotext","-layout",str(pdf),tmp.name],check=True)
        pages=Path(tmp.name).read_text(encoding="utf-8",errors="replace").split("\f")
    title=re.sub(r"\s+"," ",pdf.stem.replace("_"," ").replace("-"," ")).strip().title()
    result=[f"# {title}","","*Layout-verified Markdown edition.*",""]
    for n,p in enumerate(pages,1):
        if p.strip(): result.extend(emit(p.splitlines(),n,toc=n<=8)); result.extend(["",""])
    out = Path(output) if output else pdf.with_suffix(".md")
    out.write_text(re.sub(r"\n{3,}","\n\n","\n".join(result)).strip()+"\n",encoding="utf-8"); return out

if __name__=="__main__":
    ap=argparse.ArgumentParser(); ap.add_argument("pdfs",nargs="+",type=Path); ap.add_argument("-o", "--output", type=Path); a=ap.parse_args()
    if a.output and len(a.pdfs) != 1: ap.error("--output requires exactly one PDF")
    for f in a.pdfs: print(convert(f, a.output))
