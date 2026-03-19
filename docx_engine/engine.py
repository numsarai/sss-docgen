"""
engine.py — DocxEngine: the public-facing template engine.

Usage
-----
Fluent / chained::

    DocxEngine("template.docx") \\
        .fill({"{{name}}": "Alice", "date": "1 Jan 2566"}) \\
        .save("output.docx")

One-liner class method::

    DocxEngine.render("template.docx", "output.docx", data)

Convenience function::

    from docx_engine import render
    render("template.docx", "output.docx", data)

Replacement keys
----------------
Keys may include or omit the ``{{ }}`` braces — both forms are equivalent::

    {"name": "Alice"}       # → replaces  {{name}}
    {"{{name}}": "Alice"}   # → same

All values are converted to ``str`` automatically.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Union

from docx import Document

from .replacer import replace_in_container


class DocxEngine:
    """Fill a ``.docx`` template by replacing ``{{placeholders}}``."""

    def __init__(self, template_path: Union[str, Path]) -> None:
        self._path = Path(template_path)
        self._doc  = Document(str(self._path))

    # ------------------------------------------------------------------
    # Core API
    # ------------------------------------------------------------------

    def fill(self, replacements: Dict[str, str]) -> "DocxEngine":
        """Replace every matching ``{{placeholder}}`` in the document.

        Covers:

        * Body paragraphs
        * Body tables (including nested tables)
        * Headers — default, first-page, even-page — for every section
        * Footers — default, first-page, even-page — for every section

        Returns *self* so calls can be chained.
        """
        norm = _normalise(replacements)

        # ── Body ─────────────────────────────────────────────────────────
        replace_in_container(self._doc, norm)

        # ── Headers & footers (all section variants) ──────────────────────
        for section in self._doc.sections:
            for part in (
                section.header,
                section.first_page_header,
                section.even_page_header,
                section.footer,
                section.first_page_footer,
                section.even_page_footer,
            ):
                # Skip parts that delegate to the previous section's content.
                if part is not None and not part.is_linked_to_previous:
                    replace_in_container(part, norm)

        return self

    def save(self, output_path: Union[str, Path]) -> None:
        """Write the filled document to *output_path*."""
        self._doc.save(str(output_path))

    # ------------------------------------------------------------------
    # Class-level convenience
    # ------------------------------------------------------------------

    @classmethod
    def render(
        cls,
        template_path: Union[str, Path],
        output_path:   Union[str, Path],
        replacements:  Dict[str, str],
    ) -> None:
        """Fill *template_path* and save to *output_path* in one call."""
        cls(template_path).fill(replacements).save(output_path)


# ---------------------------------------------------------------------------
# Module-level convenience function
# ---------------------------------------------------------------------------

def render(
    template_path: Union[str, Path],
    output_path:   Union[str, Path],
    replacements:  Dict[str, str],
) -> None:
    """Fill *template_path* and save to *output_path*.

    Thin wrapper around :py:meth:`DocxEngine.render`.
    """
    DocxEngine.render(template_path, output_path, replacements)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _normalise(replacements: Dict[str, str]) -> Dict[str, str]:
    """Ensure every key is wrapped in ``{{ }}``, values cast to str."""
    out: Dict[str, str] = {}
    for key, value in replacements.items():
        k = key if key.startswith("{{") else f"{{{{{key}}}}}"
        out[k] = str(value)
    return out
