"""Command-line interface for the Outgunned PDF conversion toolkit."""

from __future__ import annotations

import argparse
from pathlib import Path

from . import corebook_pdf, corebook_text, library, superheroes, supplements


def main() -> None:
    parser = argparse.ArgumentParser(prog="outgunned-pdf")
    subparsers = parser.add_subparsers(dest="converter", required=True)

    for name in ("generic", "superheroes"):
        command = subparsers.add_parser(name)
        command.add_argument("pdf", type=Path)
        command.add_argument("--form", action="store_true")
        command.add_argument("-o", "--output", type=Path)

    command = subparsers.add_parser("supplement")
    command.add_argument("pdfs", nargs="+", type=Path)
    command.add_argument("-o", "--output", type=Path)

    command = subparsers.add_parser("corebook-pdf")
    command.add_argument("pdf", type=Path)
    command.add_argument("--text-source", type=Path)
    command.add_argument("-o", "--output", type=Path)

    command = subparsers.add_parser("corebook-text")
    command.add_argument("source", type=Path)
    command.add_argument("-o", "--output", type=Path)

    args = parser.parse_args()
    if args.converter == "generic":
        print(library.convert(args.pdf, args.form, args.output))
    elif args.converter == "superheroes":
        print(superheroes.convert(args.pdf, args.form, args.output))
    elif args.converter == "supplement":
        if args.output and len(args.pdfs) != 1:
            parser.error("--output requires exactly one PDF")
        for pdf in args.pdfs:
            print(supplements.convert(pdf, args.output))
    elif args.converter == "corebook-pdf":
        print(corebook_pdf.convert(args.pdf, args.text_source, args.output))
    else:
        print(corebook_text.convert(args.source, args.output))


if __name__ == "__main__":
    main()
