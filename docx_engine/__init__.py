"""
docx_engine — safe {{placeholder}} replacement for .docx templates.

Public API
----------
:class:`DocxEngine`
    Main class.  Instantiate with a template path, call ``.fill(data)``
    then ``.save(path)``.

:func:`render`
    Module-level one-liner: fill and save in a single call.

Examples
--------
::

    from docx_engine import DocxEngine, render

    # Fluent / chained
    DocxEngine("template.docx") \\
        .fill({"name": "Alice", "date": "1 Jan 2566"}) \\
        .save("filled.docx")

    # One-liner
    render("template.docx", "filled.docx", {"name": "Alice"})
"""

from .engine import DocxEngine, render

__all__ = ["DocxEngine", "render"]
