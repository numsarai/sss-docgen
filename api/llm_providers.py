"""
llm_providers.py — Pluggable AI provider abstraction for field extraction.

Supported providers:
  claude  — Anthropic Claude (claude-opus-4-6)   requires ANTHROPIC_API_KEY
  openai  — OpenAI GPT-4o                         requires OPENAI_API_KEY
  gemini  — Google Gemini 1.5 Flash               requires GOOGLE_API_KEY

Usage:
    from .llm_providers import get_provider

    provider = get_provider("openai")
    variables = provider.map_fields(pdf_text, field_names)
"""

from __future__ import annotations

import json
import os
import re
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any


# ---------------------------------------------------------------------------
# Shared extraction prompt helpers
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are a precise document extraction assistant. "
    "Extract information from document text and return it as a single JSON object. "
    "Rules:\n"
    "- Return ONLY valid JSON — no explanation, no markdown fences.\n"
    "- Preserve original formatting: Thai characters, numerals, dates.\n"
    "- For each requested key, the value MUST be a JSON object containing 'value' (string or null) and 'confidence' (integer 0-100).\n"
    "- Keys must match the requested names exactly."
)


def _build_user_message(pdf_text: str, field_names: List[str]) -> str:
    skeleton = "{\n" + ",\n".join(
        f'  "{f}": {{"value": <extracted value or null>, "confidence": <int 0-100>}}' for f in field_names
    ) + "\n}"
    return (
        "Extract the following fields from the document text.\n\n"
        f"Expected JSON shape:\n{skeleton}\n\n"
        "=== DOCUMENT TEXT ===\n"
        f"{pdf_text}"
    )


def _parse_response(raw: str, field_names: List[str]) -> Dict[str, Any]:
    """Strip markdown fences, parse JSON, return only requested keys."""
    raw = re.sub(r"^```(?:json)?\s*\n?", "", raw.strip())
    raw = re.sub(r"\n?```\s*$", "", raw).strip()
    parsed: dict = json.loads(raw)
    return {f: parsed.get(f) for f in field_names}


# ---------------------------------------------------------------------------
# Base class
# ---------------------------------------------------------------------------

class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    def map_fields(
        self,
        pdf_text: str,
        field_names: List[str],
    ) -> Dict[str, Optional[str]]:
        """Extract field_names from pdf_text, return {field: value_or_None}."""


# ---------------------------------------------------------------------------
# Claude (Anthropic)
# ---------------------------------------------------------------------------

class ClaudeProvider(LLMProvider):
    name = "claude"

    def __init__(self) -> None:
        key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        if not key:
            raise ValueError(
                "Anthropic API key not set — add ANTHROPIC_API_KEY to your environment."
            )
        import anthropic  # lazy import
        self._client = anthropic.Anthropic(api_key=key)

    def map_fields(
        self,
        pdf_text: str,
        field_names: List[str],
    ) -> Dict[str, Any]:
        if not field_names:
            return {}
        message = self._client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _build_user_message(pdf_text, field_names)}],
        )
        return _parse_response(message.content[0].text, field_names)


# ---------------------------------------------------------------------------
# OpenAI GPT-4o
# ---------------------------------------------------------------------------

class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self) -> None:
        key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not key:
            raise ValueError(
                "OpenAI API key not set — add OPENAI_API_KEY to your environment."
            )
        import openai  # lazy import
        self._client = openai.OpenAI(api_key=key)

    def map_fields(
        self,
        pdf_text: str,
        field_names: List[str],
    ) -> Dict[str, Any]:
        if not field_names:
            return {}
        response = self._client.chat.completions.create(
            model="gpt-4o",
            max_tokens=4096,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": _build_user_message(pdf_text, field_names)},
            ],
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        return _parse_response(raw, field_names)


# ---------------------------------------------------------------------------
# Google Gemini 1.5 Flash
# ---------------------------------------------------------------------------

class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self) -> None:
        key = os.environ.get("GOOGLE_API_KEY", "").strip()
        if not key:
            raise ValueError(
                "Google API key not set — add GOOGLE_API_KEY to your environment."
            )
        import google.generativeai as genai  # lazy import
        genai.configure(api_key=key)
        self._model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=_SYSTEM_PROMPT,
        )

    def map_fields(
        self,
        pdf_text: str,
        field_names: List[str],
    ) -> Dict[str, Any]:
        if not field_names:
            return {}
        resp = self._model.generate_content(
            _build_user_message(pdf_text, field_names),
            generation_config={"response_mime_type": "application/json", "max_output_tokens": 4096},
        )
        return _parse_response(resp.text, field_names)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

_PROVIDERS: Dict[str, type] = {
    "claude": ClaudeProvider,
    "openai": OpenAIProvider,
    "gemini": GeminiProvider,
}

SUPPORTED_PROVIDERS = list(_PROVIDERS.keys())


def get_provider(name: str) -> LLMProvider:
    """
    Instantiate and return the named provider.

    Raises ValueError on unknown name or missing API key.
    """
    name = name.lower().strip()
    cls = _PROVIDERS.get(name)
    if cls is None:
        raise ValueError(
            f"Unknown AI provider '{name}'. Choose one of: {', '.join(SUPPORTED_PROVIDERS)}"
        )
    return cls()
