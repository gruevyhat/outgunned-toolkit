#!/usr/bin/env python3
"""Convert the layout-preserving Outgunned text extraction to readable Markdown."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

SECTION_TITLES = {
    "Making of a Hero", "time for action", "impending danger!", "Gear Up",
    "face the enemy", "Mission Start", "Race Against Time", "Outgunned",
}

FOOTER_RE = re.compile(
    r"^(?:Outgunned|Making of a Hero|Time for Action|Impending Danger!|Gear Up|"
    r"Guns & Gear|Face the Enemy|Mission Start|Race Against Time|Impending Danger!?)\s+\d+$",
    re.I,
)
PAGE_NO_RE = re.compile(r"^\s*\d{1,3}\s*$")
TOC_RE = re.compile(r"^\s*(.+?)\s+(\d{1,3})\s*$")
LIST_RE = re.compile(r"^\s*[♦•]\s+")
LABEL_RE = re.compile(r"^[A-Z][A-Z0-9 &!'’?.:+/()-]{2,}$")


def normalize(s: str) -> str:
    return (s.replace("\u0001", "♦")
             .replace("\u2008", " ")
             .replace("\t", "    ")
             .replace("outgunned", "Outgunned"))


def trim_page(lines: list[str]) -> list[str]:
    lines = [normalize(x.rstrip()) for x in lines]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return [x for x in lines if not FOOTER_RE.match(x.strip()) and not PAGE_NO_RE.match(x)]


def split_columns(lines: list[str]) -> list[str]:
    """Put a visually separate right-hand sidebar/column after the left column."""
    candidates: list[tuple[int, int]] = []
    for line in lines:
        for m in re.finditer(r" {5,}", line):
            if 34 <= m.start() <= 76 and line[:m.start()].strip() and line[m.end():].strip():
                candidates.append((m.start(), len(line)))
                break
    if len(candidates) < 7:
        return lines
    cuts = sorted(x for x, _ in candidates)
    cut = cuts[len(cuts) // 2]
    # Wide numeric/aligned grids are tables, not prose columns.
    numeric = sum(bool(re.search(r"(?:^|\s)[+\-]?\d|\bX\b", x)) for x in lines)
    if numeric >= 8:
        return lines
    left, right = [], []
    for line in lines:
        if not line.strip():
            left.append("")
            right.append("")
            continue
        leading = len(line) - len(line.lstrip())
        if leading >= 34:
            left.append("")
            right.append(line.strip())
            continue
        # Use the nearest whitespace gutter around the inferred cut.
        spans = [m for m in re.finditer(r" {4,}", line) if abs(m.start() - cut) <= 14]
        if spans:
            m = min(spans, key=lambda z: abs(z.start() - cut))
            left.append(line[:m.start()].rstrip())
            right.append(line[m.end():].strip())
        elif len(line) > cut + 8 and not line[:cut].strip():
            right.append(line.strip())
            left.append("")
        else:
            left.append(line.strip())
            right.append("")
    while left and not left[-1].strip(): left.pop()
    while right and not right[0].strip(): right.pop(0)
    while right and not right[-1].strip(): right.pop()
    if sum(bool(x.strip()) for x in right) < 5:
        return lines
    return left + ([""] if left and right else []) + right


def cells(line: str) -> list[str]:
    gear = re.match(r"^(\d+\$)\s+(.+?)\s+(Grants\s+.+)$", line.strip())
    if gear:
        return list(gear.groups())
    ammo = re.match(r"^(\d+\$)\s+(.+?)\s+(Projectiles?\s+.+|Mags\s+for\s+.+)$", line.strip())
    if ammo:
        return list(ammo.groups())
    weapon = re.match(r"^(\d+\$)\s+(.+?)\s{2,}([+\-]?\dG?|X)\s+([+\-]?\dG?|X)\s+([+\-]?\dG?|X)\s+([+\-]?\dG?|X)$", line.strip())
    if weapon:
        cost, body, *ranges = weapon.groups()
        feature_words = ("No Feat", "Accurate", "Explosive", "Jam", "Precision Shot",
                         "Rapid Fire", "Short Range", "Silent", "Single Shot", "Slow Reload")
        starts = [body.find(x) for x in feature_words if body.find(x) > 0]
        if starts:
            k = min(starts)
            return [cost, body[:k].strip(), body[k:].strip(), *ranges]
        return [cost, body, "", *ranges]
    return [x.strip() for x in re.split(r" {2,}", line.strip()) if x.strip()]


def table_runs(lines: list[str]) -> dict[int, tuple[int, list[list[str]]]]:
    runs: dict[int, tuple[int, list[list[str]]]] = {}
    i = 0
    while i < len(lines):
        row = cells(lines[i])
        # Price lists and weapon charts commonly put a blank line between rows.
        if re.match(r"^\d+\$\s{2,}", lines[i]):
            j, rows = i, []
            while j < len(lines):
                if not lines[j].strip():
                    j += 1
                    continue
                c = cells(lines[j])
                if not re.match(r"^\d+\$\s{2,}", lines[j]) or len(c) < 3:
                    break
                rows.append(c)
                j += 1
            if len(rows) >= 3:
                n = max(map(len, rows))
                header = (["Cost", "Item", "Description"] if n == 3 else
                          ["Cost", "Weapon", "Features", "Melee", "Close", "Medium", "Long"])
                rows = [header] + [r + [""] * (n - len(r)) for r in rows]
                runs[i] = (j, rows)
                i = j
                continue
        if len(row) < 2:
            i += 1
            continue
        j, rows = i, []
        while j < len(lines):
            c = cells(lines[j])
            if len(c) < 2 or not lines[j].strip():
                break
            rows.append(c)
            j += 1
        widths = [len(r) for r in rows]
        common = max(set(widths), key=widths.count) if rows else 0
        good = [r for r in rows if len(r) == common]
        if common >= 2 and len(good) >= 3:
            runs[i] = (j, good)
            i = j
        else:
            i += 1
    return runs


def is_heading(text: str, prev_blank: bool, next_blank: bool) -> int:
    s = text.strip()
    if not s or len(s) > 72 or LIST_RE.match(s) or s.endswith(('.', ',', ';')):
        return 0
    if re.search(r" {2,}", s):
        return 0
    if s in SECTION_TITLES:
        return 1
    if re.match(r"^SECTION\s+[IVX]+$", s, re.I):
        return 2
    if LABEL_RE.match(s) and any(ch.isalpha() for ch in s):
        return 3
    words = s.split()
    titleish = all(w[:1].isupper() or w.lower() in {"a", "an", "and", "of", "the", "for", "in", "to", "during"} for w in words)
    if titleish and len(words) <= 7 and not any(ch.isdigit() for ch in s):
        return 3
    return 0


def escape_cell(s: str) -> str:
    return s.replace("|", "\\|").replace("\n", " ")


def emit_page(lines: list[str], page: int) -> list[str]:
    lines = trim_page(lines)
    if any("ADRENALINE!" in x for x in lines) and any("MISSION" in x and "NAME" in x for x in lines):
        return [f"<!-- Page {page} -->", "", "*[Graphical Hero Sheet omitted from text transcription; refer to the original PDF.]*"]
    stat_layout = any("Attribute Point:" in x for x in lines) and any("Skill Points:" in x for x in lines)
    if page > 7 and not stat_layout:
        lines = split_columns(lines)
    tables = table_runs(lines)
    out: list[str] = [f"<!-- Page {page} -->", ""]
    para = ""

    def flush() -> None:
        nonlocal para
        if para:
            out.extend([para.strip(), ""])
            para = ""

    i = 0
    while i < len(lines):
        raw, s = lines[i], lines[i].strip()
        if s in {"Prova Titolo", "Title"}:
            i += 1
            continue
        if re.fullmatch(r"MELEE\s+CLOSE\s+MEDIUM\s+LONG", s):
            i += 1
            continue
        if i in tables:
            flush()
            end, rows = tables[i]
            n = max(map(len, rows))
            rows = [r + [""] * (n - len(r)) for r in rows]
            out.append("| " + " | ".join(map(escape_cell, rows[0])) + " |")
            out.append("| " + " | ".join(["---"] * n) + " |")
            out.extend("| " + " | ".join(map(escape_cell, r)) + " |" for r in rows[1:])
            out.append("")
            i = end
            continue
        if not s:
            flush(); i += 1; continue
        # Contents entries become a clean linked-looking list with page references.
        tm = TOC_RE.match(s)
        if page <= 7 and tm:
            flush(); out.extend([f"- {tm.group(1).strip()} — p. {tm.group(2)}", ""]); i += 1; continue
        prev_blank = i == 0 or not lines[i - 1].strip()
        next_blank = i + 1 == len(lines) or not lines[i + 1].strip()
        level = is_heading(s, prev_blank, next_blank)
        if level:
            flush(); out.extend(["#" * level + " " + s, ""]); i += 1; continue
        if LIST_RE.match(s):
            flush()
            item = re.sub(r"^\s*[♦•]\s+", "- ", s)
            j = i + 1
            while j < len(lines) and lines[j].strip() and not LIST_RE.match(lines[j]):
                nxt = lines[j].strip()
                if is_heading(nxt, False, j + 1 == len(lines) or not lines[j + 1].strip()):
                    break
                if item.endswith("-") and nxt[:1].islower():
                    item = item[:-1] + nxt
                else:
                    item += " " + nxt
                j += 1
            out.extend([item, ""]); i = j; continue
        if s.startswith("*"):
            flush(); out.extend([s, ""]); i += 1; continue
        # Join wrapped prose and repair end-of-line hyphenation.
        if para.endswith("-") and s[:1].islower():
            para = para[:-1] + s
        elif para:
            para += " " + s
        else:
            para = s
        i += 1
    flush()
    while out and not out[-1]: out.pop()
    return out


def convert(source: Path, output: Path | None = None) -> Path:
    """Convert a layout-preserving corebook text extraction to Markdown."""
    source = Path(source)
    output = Path(output) if output else source.with_suffix(".md")
    text = source.read_text(encoding="utf-8")
    pages = text.split("\f")
    result = ["# Outgunned", "", "*Core rulebook — cleaned Markdown edition*", ""]
    for number, page in enumerate(pages, 1):
        if not page.strip():
            continue
        result.extend(emit_page(page.splitlines(), number))
        result.extend(["", ""])
    rendered = "\n".join(result)
    rendered = re.sub(r"\n{3,}", "\n\n", rendered).strip() + "\n"
    output.write_text(rendered, encoding="utf-8")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("-o", "--output", type=Path)
    args = parser.parse_args()
    print(convert(args.source, args.output))


if __name__ == "__main__":
    main()
