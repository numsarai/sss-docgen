"""
models.py — ORM model (SQLAlchemy) + request/response schemas (Pydantic).

ORM
---
CaseRecord  maps to the `cases` table.
Variables are stored as a JSON string and surfaced as a dict via a property.

Pydantic — requests
-------------------
GenerateRequest  POST /generate   (variables dict  OR  pdf_path for auto-fill)
CaseCreate       POST /cases      (save record without generating files)
ExtractRequest   POST /extract    (JSON body with pdf_path + template)

Pydantic — responses
--------------------
CaseResponse     unified shape for all case endpoints
CaseList         paginated wrapper for GET /cases
ExtractResponse  result of POST /extract / POST /extract/upload
"""

import json
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, TYPE_CHECKING

def _bkk_now() -> datetime:
    """Current time in Asia/Bangkok (UTC+7)."""
    return datetime.now(timezone(timedelta(hours=7))).replace(tzinfo=None)

from pydantic import BaseModel, ConfigDict, model_validator
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ---------------------------------------------------------------------------
# ORM models
# ---------------------------------------------------------------------------

class TemplateRecord(Base):
    __tablename__ = "templates"

    id:          Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at:  Mapped[datetime]      = mapped_column(DateTime, default=_bkk_now, nullable=False)
    updated_at:  Mapped[datetime]      = mapped_column(
                                           DateTime,
                                           default=_bkk_now,
                                           onupdate=_bkk_now,
                                           nullable=False,
                                         )
    name:        Mapped[str]           = mapped_column(String(256),  nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text,         nullable=True)
    path:        Mapped[str]           = mapped_column(String(1024), nullable=False)
    # JSON-encoded list of {{field}} names scanned at upload time
    _fields:     Mapped[Optional[str]] = mapped_column("fields", Text, nullable=True)

    @property
    def fields(self) -> List[str]:
        return json.loads(self._fields) if self._fields else []

    @fields.setter
    def fields(self, value: List[str]) -> None:
        self._fields = json.dumps(value, ensure_ascii=False)


class Batch(Base):
    """One Excel upload = one Batch containing many BatchRecords."""
    __tablename__ = "batches"

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_bkk_now, nullable=False)
    filename:   Mapped[str]      = mapped_column(String(512),  nullable=False)
    template:   Mapped[str]      = mapped_column(String(1024), nullable=False)

    records: Mapped[List["BatchRecord"]] = relationship(
        "BatchRecord", back_populates="batch", cascade="all, delete-orphan"
    )


class BatchRecord(Base):
    """One row from an uploaded Excel file."""
    __tablename__ = "batch_records"

    id:          Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id:    Mapped[int]           = mapped_column(Integer, ForeignKey("batches.id"), nullable=False)
    row_number:  Mapped[int]           = mapped_column(Integer, nullable=False)
    _variables:  Mapped[str]           = mapped_column("variables", Text, nullable=False)
    # "draft" → imported; "edited" → user changed a field; "generated" → doc created
    status:      Mapped[str]           = mapped_column(String(32), default="draft", nullable=False)
    case_id:     Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at:  Mapped[datetime]      = mapped_column(DateTime, default=_bkk_now, nullable=False)
    updated_at:  Mapped[datetime]      = mapped_column(
                                           DateTime, default=_bkk_now, onupdate=_bkk_now, nullable=False
                                         )

    batch: Mapped["Batch"] = relationship("Batch", back_populates="records")

    @property
    def variables(self) -> Dict[str, Any]:
        return json.loads(self._variables)

    @variables.setter
    def variables(self, value: Dict[str, Any]) -> None:
        self._variables = json.dumps(value, ensure_ascii=False)


class CaseRecord(Base):
    __tablename__ = "cases"

    id:         Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime]      = mapped_column(DateTime, default=_bkk_now, nullable=False)
    updated_at: Mapped[datetime]      = mapped_column(
                                          DateTime,
                                          default=_bkk_now,
                                          onupdate=_bkk_now,
                                          nullable=False,
                                        )
    template:   Mapped[str]           = mapped_column(String(512),  nullable=False)
    _variables: Mapped[str]           = mapped_column("variables", Text, nullable=False)
    docx_path:  Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    pdf_path:   Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    # "pending" | "generating" | "generated" | "error"
    status:     Mapped[str]           = mapped_column(String(32),   default="pending", nullable=False)
    error:      Mapped[Optional[str]] = mapped_column(Text,         nullable=True)

    @property
    def variables(self) -> Dict[str, str]:
        return json.loads(self._variables)

    @variables.setter
    def variables(self, value: Dict[str, str]) -> None:
        self._variables = json.dumps(value, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Pydantic — request bodies
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    """
    Body for POST /generate.

    Supply *either* ``variables`` (explicit mapping) *or* ``pdf_path``
    (auto-extract via Claude).  Supplying both is allowed; ``variables``
    takes priority and ``pdf_path`` is ignored.
    """
    template:  str
    variables: Optional[Dict[str, str]] = None
    pdf_path:  Optional[str]            = None   # path to a source PDF

    @model_validator(mode="after")
    def _require_one_source(self) -> "GenerateRequest":
        if self.variables is None and self.pdf_path is None:
            raise ValueError("Provide either 'variables' or 'pdf_path'.")
        return self


class CaseCreate(BaseModel):
    """Body for POST /cases — persist record, no file generation."""
    template:  str
    variables: Dict[str, str]


class ExtractRequest(BaseModel):
    """Body for POST /extract — extract fields from a PDF by path."""
    pdf_path:  str   # path to the source PDF
    template:  str   # path to the .docx template (determines which fields to find)


# ---------------------------------------------------------------------------
# Pydantic — response bodies
# ---------------------------------------------------------------------------

class CaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:         int
    created_at: datetime
    updated_at: datetime
    template:   str
    variables:  Dict[str, Any]   # Any covers str | None during autofill
    docx_path:  Optional[str]
    pdf_path:   Optional[str]
    status:     str
    error:      Optional[str]

    @classmethod
    def from_record(cls, r: CaseRecord) -> "CaseResponse":
        return cls(
            id=r.id,
            created_at=r.created_at,
            updated_at=r.updated_at,
            template=r.template,
            variables=r.variables,
            docx_path=r.docx_path,
            pdf_path=r.pdf_path,
            status=r.status,
            error=r.error,
        )


class CaseList(BaseModel):
    """Paginated wrapper returned by GET /cases."""
    total: int
    skip:  int
    limit: int
    items: List[CaseResponse]


class ExtractResponse(BaseModel):
    """
    Result of POST /extract and POST /extract/upload.

    ``variables``    — dict of every template field → extracted value (or None).
    ``raw_text``     — full text pulled from the PDF (useful for debugging).
    ``fields_found`` — number of fields successfully extracted (value is not None).
    ``fields_total`` — total number of fields in the template.
    ``provider``     — AI provider used for extraction (claude / openai / gemini).
    """
    variables:    Dict[str, Any]
    raw_text:     str
    fields_found: int
    fields_total: int
    provider:     str = "claude"


class TemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:          int
    created_at:  datetime
    updated_at:  datetime
    name:        str
    description: Optional[str]
    path:        str
    fields:      List[str]
    fields_count: int

    @classmethod
    def from_record(cls, r: "TemplateRecord") -> "TemplateResponse":
        f = r.fields
        return cls(
            id=r.id,
            created_at=r.created_at,
            updated_at=r.updated_at,
            name=r.name,
            description=r.description,
            path=r.path,
            fields=f,
            fields_count=len(f),
        )


class TemplateList(BaseModel):
    total: int
    skip:  int
    limit: int
    items: List[TemplateResponse]


class BatchDownloadRequest(BaseModel):
    """Body for POST /cases/batch-download."""
    case_ids: List[int]


# ---------------------------------------------------------------------------
# Batch / BatchRecord schemas
# ---------------------------------------------------------------------------

class BatchRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:         int
    batch_id:   int
    row_number: int
    variables:  Dict[str, Any]
    status:     str
    case_id:    Optional[int]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_record(cls, r: "BatchRecord") -> "BatchRecordResponse":
        return cls(
            id=r.id, batch_id=r.batch_id, row_number=r.row_number,
            variables=r.variables, status=r.status, case_id=r.case_id,
            created_at=r.created_at, updated_at=r.updated_at,
        )


class BatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:         int
    created_at: datetime
    filename:   str
    template:   str
    total:      int
    draft:      int
    edited:     int
    generated:  int

    @classmethod
    def from_batch(cls, b: "Batch") -> "BatchResponse":
        records = b.records
        return cls(
            id=b.id, created_at=b.created_at, filename=b.filename, template=b.template,
            total=len(records),
            draft=sum(1 for r in records if r.status == "draft"),
            edited=sum(1 for r in records if r.status == "edited"),
            generated=sum(1 for r in records if r.status == "generated"),
        )


class BatchListResponse(BaseModel):
    total: int
    items: List[BatchResponse]


class BatchRecordUpdate(BaseModel):
    variables: Dict[str, Any]
