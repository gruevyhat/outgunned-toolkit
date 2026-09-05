#!/usr/bin/env python3
"""Rebuild the Outgunned Markdown from PDF text blocks and page geometry."""

from __future__ import annotations

import argparse
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"x": "http://www.w3.org/1999/xhtml"}

SECTION_PAGES = {
    "Making of a Hero", "Time for Action", "Impending Danger!", "Gear Up",
    "Face the Enemy", "Mission Start", "Race Against Time",
}
# These pages use true row/column grids. Their aligned text extraction is more
# faithful than PDF flow blocks, which intentionally flatten each cell.
TABLE_PAGES = {
    69, 104, 105,
}
FULL_FORM_PAGES = {
    216: "Pregenerated Hero Sheet",
    217: "Pregenerated Hero Sheet",
    218: "Pregenerated Hero Sheet",
    219: "Hero Sheet",
    222: "Hero Sheet",
    223: "Mission Sheet",
    224: "Director Sheet",
}
EMBEDDED_FORM_PAGES = {
    17: "Hero Sheet",
    171: "Mission Sheet",
    173: "Director Sheet",
}
EMBEDDED_GRAPHICS = {
    179: (430, "*A graphical Supporting Character card example appears below the text in the original PDF.*"),
}
FOOTERS = re.compile(r"^(Outgunned|Making of a Hero|Time for Action|Impending Danger!?|Guns & Gear|Face the Enemy|Mission Start|Race Against Time)$", re.I)


def clean_words(words: list[str]) -> str:
    return " ".join(words).replace("outgunned", "Outgunned").replace("\u0001", "♦")


def join_lines(lines: list[str]) -> str:
    out = ""
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if out.endswith("-") and line[:1].islower():
            out = out[:-1] + line
        else:
            out += (" " if out else "") + line
    return out


def heading_level(s: str, first: bool = False) -> int:
    s = s.strip()
    if s in SECTION_PAGES:
        return 1
    if re.fullmatch(r"SECTION\s+[IVX]+", s, re.I):
        return 2
    if len(s) > 55 or s.endswith(('.', ',', ';', ':')):
        return 0
    if re.fullmatch(r"[A-Z0-9 &!'’?.+/-]{3,}", s):
        return 3
    words = s.split()
    title = words and all(w[:1].isupper() or w.lower() in {"a", "an", "and", "of", "the", "for", "in", "to", "during"} for w in words)
    return 3 if (first and title and len(words) <= 7) else 0


def block_data(block: ET.Element) -> tuple[float, float, float, float, list[str]]:
    a = block.attrib
    lines = []
    for line in block.findall("x:line", NS):
        lines.append(clean_words([w.text or "" for w in line.findall("x:word", NS)]))
    return *(float(a[k]) for k in ("xMin", "yMin", "xMax", "yMax")), lines


def emit_block(x0: float, x1: float, lines: list[str], aside: bool = False) -> list[str]:
    if not lines:
        return []
    result: list[str] = []
    # A heading is frequently the first line of the same PDF block as its body.
    level = heading_level(lines[0], first=True)
    if level and len(lines) > 1:
        result.extend(["#" * level + " " + lines[0], ""])
        lines = lines[1:]
    elif level:
        result.extend(["#" * level + " " + lines[0], ""])
        return result

    if len(lines) > 1 and lines[0].endswith(":"):
        label = lines[0][:-1]
        values = []
        for line in lines[1:]:
            if values and values[-1].endswith("-") and line[:1].islower():
                values[-1] = values[-1][:-1] + line
            else:
                values.append(line)
        result.extend([f"**{label}:**  ", "  \n".join(values), ""])
        if aside:
            result = [("> " + x if x else ">") for x in result] + [""]
        return result

    bullet_lines = [i for i, line in enumerate(lines) if line.startswith(("♦", "•"))]
    if bullet_lines:
        items: list[str] = []
        current = ""
        for line in lines:
            if line.startswith(("♦", "•")):
                if current: items.append(current)
                current = re.sub(r"^[♦•]\s*", "", line)
            elif current:
                current = current[:-1] + line if current.endswith("-") and line[:1].islower() else current + " " + line
            else:
                result.extend([line, ""])
        if current: items.append(current)
        result.extend([f"- {x}" for x in items] + [""])
    else:
        text = join_lines(lines)
        if text:
            result.extend([text, ""])
    if aside:
        result = [("> " + x if x else ">") for x in result]
        result.append("")
    return result


def convert(pdf: Path, text_source: Path | None = None, output: Path | None = None) -> Path:
    """Rebuild the corebook Markdown using PDF geometry and aligned text."""
    pdf = Path(pdf)
    text_source = Path(text_source) if text_source else pdf.with_suffix(".txt")
    output = Path(output) if output else pdf.with_suffix(".md")
    xml = Path(tempfile.gettempdir()) / "outgunned_corebook_bbox.html"
    xml.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["pdftotext", "-bbox-layout", str(pdf), str(xml)], check=True)
    raw_xml = xml.read_text(encoding="utf-8", errors="replace")
    raw_xml = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", raw_xml)
    root = ET.fromstring(raw_xml)
    result = ["# Outgunned", "", "*Core rulebook - layout-verified Markdown edition*", ""]
    for page_no, page in enumerate(root.findall(".//x:page", NS), 1):
        if page_no in FULL_FORM_PAGES:
            sheet = FULL_FORM_PAGES[page_no]
            result.extend([
                f"<!-- Page {page_no} -->", "", f"### {sheet}", "",
                f"*This page is a graphical {sheet}. Download the printable sheet from "
                "[Two Little Mice](https://twolittlemice.net/outgunned).*", "",
            ])
            continue
        blocks = [block_data(b) for b in page.findall(".//x:block", NS)]
        kept = []
        for x0, y0, x1, y1, lines in blocks:
            text = join_lines(lines)
            if text.isdigit() and y0 > 550:
                continue
            # Page 17 contains a reduced, graphical Hero Sheet below the prose.
            # It is a non-linear form, not body text; transcribing its individual
            # labels by coordinate produces an unreadable jumble.
            if page_no in EMBEDDED_FORM_PAGES and y0 >= 350:
                continue
            if page_no in EMBEDDED_GRAPHICS and y0 >= EMBEDDED_GRAPHICS[page_no][0]:
                continue
            if y0 > 600 and (text.isdigit() or FOOTERS.match(text)):
                continue
            if text in {"Prova Titolo", "Title"}:
                continue
            kept.append((x0, y0, x1, y1, lines))
        if not kept:
            continue
        result.extend([f"<!-- Page {page_no} -->", ""])
        # DOM flow order follows the designed reading order. Right-margin blocks
        # are marked as asides so they cannot be mistaken for main-column prose.
        for x0, y0, x1, y1, lines in kept:
            aside = x0 >= 285 and (x1 - x0) <= 130
            result.extend(emit_block(x0, x1, lines, aside))
        if page_no in EMBEDDED_FORM_PAGES:
            sheet = EMBEDDED_FORM_PAGES[page_no]
            result.extend([
                f"*A reduced graphical {sheet} appears below the text in the original PDF. "
                "Use the full-size printable sheet supplied with the game.*", "",
            ])
        if page_no in EMBEDDED_GRAPHICS:
            result.extend([EMBEDDED_GRAPHICS[page_no][1], ""])
    text = "\n".join(result)
    text = re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"
    # Restore actual Markdown tables from the layout-preserving extraction.
    from .corebook_text import emit_page
    txt_pages = text_source.read_text(encoding="utf-8").split("\f")
    pdf_parts = re.split(r"(?=<!-- Page \d+ -->)", text)
    rebuilt = [pdf_parts[0]]
    for part in pdf_parts[1:]:
        match = re.match(r"<!-- Page (\d+) -->", part)
        page_no = int(match.group(1)) if match else -1
        if page_no in {6, 7} and page_no - 1 < len(txt_pages):
            entries = []
            for line in txt_pages[page_no - 1].splitlines():
                line = line.replace("\u2008", " ").replace("\t", " ").strip()
                item = re.match(r"^(.+?)\s+(\d{1,3})$", line)
                if item:
                    entries.append(f"- {item.group(1).strip()} - p. {item.group(2)}")
            title = "## Contents\n\n" if page_no == 6 else ""
            part = f"<!-- Page {page_no} -->\n\n{title}" + "\n".join(entries) + "\n\n"
        if page_no in TABLE_PAGES and page_no - 1 < len(txt_pages):
            part = "\n".join(emit_page(txt_pages[page_no - 1].splitlines(), page_no)) + "\n\n"
            if page_no == 69:
                old = "| 2 | 17% | – | – | – | – | – | – |\n| --- | --- | --- | --- | --- | --- | --- | --- |"
                new = (
                    "| Dice | Basic Roll | Critical Roll | Critical Re-roll | Extreme Roll | Extreme Re-roll | Impossible Roll | Impossible Re-roll |\n"
                    "| --- | --- | --- | --- | --- | --- | --- | --- |\n"
                    "| 2 | 17% | – | – | – | – | – | – |"
                )
                part = part.replace(old, new)
        rebuilt.append(part)
    text = "".join(rebuilt)
    text = re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"
    output.write_text(text, encoding="utf-8")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--text-source", type=Path)
    parser.add_argument("-o", "--output", type=Path)
    args = parser.parse_args()
    print(convert(args.pdf, args.text_source, args.output))


if __name__ == "__main__":
    main()
