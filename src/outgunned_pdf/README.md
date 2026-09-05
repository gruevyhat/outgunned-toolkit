# Outgunned PDF conversion toolkit

Run the package from the repository root:

```sh
PYTHONPATH=src python3 -m outgunned_pdf generic path/to/book.pdf
PYTHONPATH=src python3 -m outgunned_pdf supplement path/to/adventure.pdf
PYTHONPATH=src python3 -m outgunned_pdf superheroes path/to/superheroes.pdf
PYTHONPATH=src python3 -m outgunned_pdf corebook-pdf path/to/corebook.pdf
PYTHONPATH=src python3 -m outgunned_pdf corebook-text path/to/corebook.txt
```

Every command writes Markdown next to its input by default. Use `-o` to select
another output path. The `corebook-pdf` command expects a same-basename `.txt`
layout extraction unless `--text-source` is supplied.
