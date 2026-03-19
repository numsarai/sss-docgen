"""
llm.py — Claude integration for structured field extraction.

map_fields(pdf_text, field_names)
    Sends extracted PDF text + a list of template field names to Claude.
    Returns a dict {field_name: extracted_value_or_None}.

For multi-provider support use llm_providers.get_provider(name).
This module keeps backward compatibility for code that imports map_fields directly.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Any

from .llm_providers import ClaudeProvider, get_provider

# Module-level Claude instance (lazy, created on first call)
_claude: Optional[ClaudeProvider] = None


def _get_claude() -> ClaudeProvider:
    global _claude
    if _claude is None:
        _claude = ClaudeProvider()
    return _claude


def map_fields(
    pdf_text: str,
    field_names: List[str],
) -> Dict[str, Any]:
    """
    Ask Claude to extract *field_names* from *pdf_text*.

    Returns
    -------
    dict
        ``{field_name: value_or_None}`` for every name in *field_names*.

    Raises
    ------
    json.JSONDecodeError
        If the model returns text that cannot be parsed as JSON.
    ValueError
        If ANTHROPIC_API_KEY is not set.
    """
    return _get_claude().map_fields(pdf_text, field_names)


def map_fields_with_provider(
    pdf_text: str,
    field_names: List[str],
    provider_name: str = "claude",
) -> Dict[str, Any]:
    """Extract fields using the named provider (claude / openai / gemini)."""
    return get_provider(provider_name).map_fields(pdf_text, field_names)
