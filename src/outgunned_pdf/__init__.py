"""Reusable, layout-aware PDF-to-Markdown converters for Outgunned books."""

from .library import convert as convert_pdf

__all__ = ["convert_pdf"]
