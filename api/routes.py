"""
routes.py — API endpoints.

POST /generate           fill template → DOCX + PDF → persist case → return case
POST /cases              persist case record only (no file generation)
GET  /cases              paginated list of cases, newest first
GET  /cases/{case_id}    single case by primary key
POST /extract            extract fields from PDF (path) → structured JSON
POST /extract/upload     extract fields from uploaded PDF → structured JSON
"""

import json
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .database import get_db, engine
from .extractor import extract_pdf_text, scan_template_fields
from .formatters import post_process_variables
from .generator import GENERATED_DIR, convert_to_pdf, generate_docx
from .llm import map_fields, map_fields_with_provider
from .llm_providers import SUPPORTED_PROVIDERS
from .models import (
    BatchDownloadRequest,
    CaseCreate,
    CaseList,
    CaseRecord,
    CaseResponse,
    ExtractRequest,
    ExtractResponse,
    GenerateRequest,
)

router = APIRouter()


def _resolve_generated(stored_path: str) -> Path:
    """
    Return an existing Path for a generated file.

    The stored path may be an absolute host path that doesn't exist inside
    Docker (where the volume is mounted at /app/generated/).  If the stored
    path doesn't exist we fall back to looking up the file by name inside
    GENERATED_DIR so the same DB record works in both local and Docker runs.
    """
    p = Path(stored_path)
    if p.exists():
        return p
    candidate = GENERATED_DIR / p.name
    if candidate.exists():
        return candidate
    raise FileNotFoundError(stored_path)


# ---------------------------------------------------------------------------
# POST /generate
# ---------------------------------------------------------------------------

@router.post(
    "/generate",
    response_model=CaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate DOCX + PDF from a template asynchronously",
    tags=["generation"],
)
def generate(req: GenerateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Full pipeline:

    1. Insert a `generating` case record.
    2. Fill the template → write DOCX.
    3. Convert DOCX → PDF via LibreOffice.
    4. Update the record with file paths and `generated` status.

    On any error the record is marked `error` and a 500 is returned.
    """
    # Auto-extract variables from PDF when not supplied explicitly
    variables = req.variables
    if variables is None:
        try:
            pdf_text    = extract_pdf_text(req.pdf_path)
            field_names = scan_template_fields(req.template)
            variables   = {k: (v or "") for k, v in map_fields(pdf_text, field_names).items()}
            variables   = post_process_variables(variables)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"PDF extraction failed: {exc}",
            )

    record = CaseRecord(
        template=req.template,
        _variables=json.dumps(variables, ensure_ascii=False),
        status="generating",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    def background_generate(case_id: int, template: str, vars_dict: dict):
        with Session(engine) as session:
            rec = session.get(CaseRecord, case_id)
            if not rec:
                return

            try:
                docx_path = generate_docx(template, vars_dict, rec.id)
                pdf_path  = convert_to_pdf(docx_path)

                rec.docx_path = str(docx_path)
                rec.pdf_path  = str(pdf_path)
                rec.status    = "generated"
            except Exception as exc:
                rec.status = "error"
                rec.error  = str(exc)
            finally:
                session.commit()

    background_tasks.add_task(background_generate, record.id, req.template, variables)

    return CaseResponse.from_record(record)


# ---------------------------------------------------------------------------
# POST /cases
# ---------------------------------------------------------------------------

@router.post(
    "/cases",
    response_model=CaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a case record (no file generation)",
    tags=["cases"],
)
def create_case(body: CaseCreate, db: Session = Depends(get_db)):
    """
    Persist a case with `pending` status.
    Files are not generated; call POST /generate to produce them.
    """
    record = CaseRecord(
        template=body.template,
        _variables=json.dumps(body.variables, ensure_ascii=False),
        status="pending",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return CaseResponse.from_record(record)


# ---------------------------------------------------------------------------
# GET /cases
# ---------------------------------------------------------------------------

@router.get(
    "/cases",
    response_model=CaseList,
    summary="List all cases",
    tags=["cases"],
)
def list_cases(
    skip:  int = Query(default=0,  ge=0,   description="Number of records to skip"),
    limit: int = Query(default=50, ge=1, le=200, description="Max records to return"),
    search: str = Query(default=None, description="Search template or variables"),
    status_filter: str = Query(default=None, alias="status", description="Filter by status"),
    db:    Session = Depends(get_db),
):
    """Return cases ordered by creation date descending, with pagination and filtering."""
    query = db.query(CaseRecord)

    if search:
        term = f"%{search}%"
        filters = [
            CaseRecord.template.ilike(term),
            CaseRecord._variables.ilike(term)
        ]
        if search.isdigit():
            filters.append(CaseRecord.id == int(search))
        query = query.filter(or_(*filters))

    if status_filter:
        query = query.filter(CaseRecord.status == status_filter)

    total = query.count()
    records = query.order_by(CaseRecord.created_at.desc()).offset(skip).limit(limit).all()

    return CaseList(
        total=total,
        skip=skip,
        limit=limit,
        items=[CaseResponse.from_record(r) for r in records],
    )


# ---------------------------------------------------------------------------
# GET /cases/{case_id}
# ---------------------------------------------------------------------------

@router.get(
    "/cases/{case_id}",
    response_model=CaseResponse,
    summary="Get a single case",
    tags=["cases"],
)
def get_case(case_id: int, db: Session = Depends(get_db)):
    """Return the case with the given primary key, or 404."""
    record = db.get(CaseRecord, case_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found.",
        )
    return CaseResponse.from_record(record)


# ---------------------------------------------------------------------------
# POST /extract
# ---------------------------------------------------------------------------

@router.post(
    "/extract",
    response_model=ExtractResponse,
    summary="Extract template fields from a PDF (by file path)",
    tags=["extraction"],
)
def extract(
    req: ExtractRequest,
    provider: str = Query(default="claude", description=f"AI provider to use: {', '.join(SUPPORTED_PROVIDERS)}"),
):
    """
    Given a path to a PDF and a .docx template, extract text from the PDF and
    use the selected AI to map it to the template's ``{{field}}`` placeholders.

    Returns the mapped variables, raw text, field counts, and provider used.
    """
    try:
        raw_text    = extract_pdf_text(req.pdf_path)
        field_names = scan_template_fields(req.template)
        variables   = map_fields_with_provider(raw_text, field_names, provider)
        variables   = post_process_variables(variables)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    fields_found = sum(1 for v in variables.values() if v is not None)
    return ExtractResponse(
        variables=variables,
        raw_text=raw_text,
        fields_found=fields_found,
        fields_total=len(field_names),
        provider=provider,
    )


# ---------------------------------------------------------------------------
# POST /extract/upload
# ---------------------------------------------------------------------------

@router.post(
    "/extract/upload",
    response_model=ExtractResponse,
    summary="Extract template fields from an uploaded PDF",
    tags=["extraction"],
)
def extract_upload(
    template: str        = Form(..., description="Path to the .docx template"),
    file:     UploadFile = File(..., description="PDF file to extract text from"),
    provider: str        = Form(default="claude", description=f"AI provider: {', '.join(SUPPORTED_PROVIDERS)}"),
):
    """
    Multipart alternative to ``POST /extract``.  Upload the PDF as a file
    instead of supplying a path.  Choose AI provider via the ``provider`` form field.
    """
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file.file.read())
        tmp_path = Path(tmp.name)

    try:
        raw_text    = extract_pdf_text(tmp_path)
        field_names = scan_template_fields(template)
        variables   = map_fields_with_provider(raw_text, field_names, provider)
        variables   = post_process_variables(variables)
    except Exception as exc:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    finally:
        tmp_path.unlink(missing_ok=True)

    fields_found = sum(1 for v in variables.values() if v is not None)
    return ExtractResponse(
        variables=variables,
        raw_text=raw_text,
        fields_found=fields_found,
        fields_total=len(field_names),
        provider=provider,
    )


# ---------------------------------------------------------------------------
# GET /templates/fields  — scan a .docx template for {{field}} names
# ---------------------------------------------------------------------------

@router.get(
    "/templates/fields",
    summary="Scan a .docx template for field names",
    tags=["extraction"],
)
def get_template_fields(path: str = Query(..., description="Absolute path to the .docx template")):
    try:
        fields = scan_template_fields(path)
        return {"fields": fields}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


# ---------------------------------------------------------------------------
# DELETE /cases/{case_id}
# ---------------------------------------------------------------------------

@router.delete("/cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["cases"])
def delete_case(case_id: int, db: Session = Depends(get_db)):
    """Delete a case record and its generated files (DOCX + PDF) if they exist."""
    import os
    record = db.get(CaseRecord, case_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Case {case_id} not found.")

    # Remove generated files from disk
    for path_attr in (record.docx_path, record.pdf_path):
        if path_attr:
            try:
                os.remove(path_attr)
            except FileNotFoundError:
                pass

    db.delete(record)
    db.commit()


# ---------------------------------------------------------------------------
# GET /cases/{case_id}/download/docx  +  /pdf
# ---------------------------------------------------------------------------

@router.get("/cases/{case_id}/download/docx", tags=["cases"])
@router.get("/cases/{case_id}/download/docx/{token_path}", tags=["cases"])
def download_docx(case_id: int, db: Session = Depends(get_db), token_path: str = ''):
    from docx import Document as DocxDoc
    from .generator import _apply_thai_numerals

    record = db.get(CaseRecord, case_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found.")
    if not record.docx_path:
        raise HTTPException(status_code=404, detail="DOCX not yet generated.")

    try:
        docx_path = _resolve_generated(record.docx_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="DOCX file not found on disk.")

    # Ensure all numerals are Thai before export
    doc = DocxDoc(str(docx_path))
    _apply_thai_numerals(doc)
    doc.save(str(docx_path))
    record.docx_path = str(docx_path)
    db.commit()

    return FileResponse(
        str(docx_path),
        filename=f"case_{case_id}.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/cases/{case_id}/download/pdf", tags=["cases"])
def download_pdf(case_id: int, db: Session = Depends(get_db)):
    from docx import Document as DocxDoc
    from .generator import _apply_thai_numerals, convert_to_pdf

    record = db.get(CaseRecord, case_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found.")
    if not record.docx_path:
        raise HTTPException(status_code=404, detail="DOCX not yet generated.")

    try:
        docx_path = _resolve_generated(record.docx_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="DOCX file not found on disk.")

    # Apply Thai numerals to DOCX then regenerate PDF
    doc = DocxDoc(str(docx_path))
    _apply_thai_numerals(doc)
    doc.save(str(docx_path))

    pdf_path = convert_to_pdf(docx_path)
    record.docx_path = str(docx_path)
    record.pdf_path = str(pdf_path)
    db.commit()

    return FileResponse(
        str(pdf_path),
        filename=f"case_{case_id}.pdf",
        media_type="application/pdf",
    )


# ---------------------------------------------------------------------------
# GET /cases/{case_id}/preview/pdf  — serve PDF inline (no regeneration)
# ---------------------------------------------------------------------------

@router.get("/cases/{case_id}/preview/pdf", tags=["cases"])
def preview_pdf(case_id: int, db: Session = Depends(get_db)):
    record = db.get(CaseRecord, case_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found.")
    if not record.pdf_path:
        raise HTTPException(status_code=404, detail="PDF not yet generated.")
    try:
        pdf_path = _resolve_generated(record.pdf_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF file not found on disk.")
    # Update DB to canonical path so future requests don't need the fallback
    record.pdf_path = str(pdf_path)
    db.commit()
    return FileResponse(
        str(pdf_path),
        media_type="application/pdf",
        headers={"Content-Disposition": "inline"},
    )


# ---------------------------------------------------------------------------
# GET /cases/{case_id}/editor-config  — OnlyOffice editor configuration
# ---------------------------------------------------------------------------

@router.get("/cases/{case_id}/editor-config", tags=["cases"])
def case_editor_config(case_id: int, db: Session = Depends(get_db)):
    import time
    import os
    from docx import Document as DocxDoc
    from .generator import _apply_thai_numerals

    record = db.get(CaseRecord, case_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found.")
    if not record.docx_path:
        raise HTTPException(status_code=404, detail="No DOCX file for this case yet.")

    try:
        docx_path = _resolve_generated(record.docx_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="DOCX file not found on disk.")

    # Convert any Arabic digits → Thai before opening in editor
    doc = DocxDoc(str(docx_path))
    _apply_thai_numerals(doc)
    doc.save(str(docx_path))
    record.docx_path = str(docx_path)
    db.commit()

    key = f"case-{case_id}-{int(time.time())}"
    token = os.getenv("APP_PASSWORD", "secret")
    return {
        "document": {
            "fileType": "docx",
            "key": key,
            "title": f"Case #{case_id}.docx",
            "url": f"http://host.docker.internal:8000/cases/{case_id}/download/docx/{token}",
        },
        "documentType": "word",
        "editorConfig": {
            "callbackUrl": f"http://host.docker.internal:8000/cases/{case_id}/editor-callback/{token}",
            "mode": "edit",
            "lang": "th",
            "customization": {"autosave": True, "forcesave": True},
        },
    }


# ---------------------------------------------------------------------------
# POST /cases/{case_id}/editor-callback  — OnlyOffice saves the document here
# ---------------------------------------------------------------------------

@router.post("/cases/{case_id}/editor-callback", tags=["cases"])
@router.post("/cases/{case_id}/editor-callback/{token_path}", tags=["cases"])
def case_editor_callback(case_id: int, body: dict, db: Session = Depends(get_db), token_path: str = ''):
    """
    OnlyOffice calls this URL when the user saves.
    status 2 = ready to save, status 6 = force-saved.
    Must return {"error": 0} on success.
    """
    import urllib.request as urlreq

    if body.get("status") in (2, 6):
        url = body.get("url")
        if not url:
            return {"error": 1}

        record = db.get(CaseRecord, case_id)
        if record is None:
            return {"error": 1}

        try:
            from docx import Document as DocxDoc
            from .generator import _apply_thai_numerals
            import io

            with urlreq.urlopen(url) as resp:
                data = resp.read()

            if record.docx_path:
                save_path = Path(record.docx_path)
            else:
                out_dir = Path(__file__).parent.parent / "output"
                out_dir.mkdir(exist_ok=True)
                save_path = out_dir / f"case_{case_id}.docx"

            # Apply Thai numeral conversion before saving
            doc = DocxDoc(io.BytesIO(data))
            _apply_thai_numerals(doc)
            doc.save(str(save_path))

            record.docx_path = str(save_path)
            db.commit()
        except Exception:
            return {"error": 1}

    return {"error": 0}


# ---------------------------------------------------------------------------
# GET /analytics
# ---------------------------------------------------------------------------

@router.get("/analytics", tags=["analytics"])
def get_analytics(db: Session = Depends(get_db)):
    from .models import TemplateRecord
    total_cases = db.query(func.count(CaseRecord.id)).scalar() or 0
    pending_cases = db.query(func.count(CaseRecord.id)).filter(CaseRecord.status == "pending").scalar() or 0
    generating_cases = db.query(func.count(CaseRecord.id)).filter(CaseRecord.status == "generating").scalar() or 0
    completed_cases = db.query(func.count(CaseRecord.id)).filter(CaseRecord.status == "generated").scalar() or 0
    error_cases = db.query(func.count(CaseRecord.id)).filter(CaseRecord.status == "error").scalar() or 0
    total_templates = db.query(func.count(TemplateRecord.id)).scalar() or 0

    return {
        "cases": {
            "total": total_cases,
            "pending": pending_cases,
            "generating": generating_cases,
            "generated": completed_cases,
            "error": error_cases,
        },
        "templates": {
            "total": total_templates
        }
    }


# ---------------------------------------------------------------------------
# POST /cases/batch-download
# ---------------------------------------------------------------------------

@router.post("/cases/batch-download", tags=["cases"])
def batch_download_cases(req: BatchDownloadRequest, db: Session = Depends(get_db)):
    import zipfile
    import io
    from fastapi.responses import StreamingResponse

    records = db.query(CaseRecord).filter(CaseRecord.id.in_(req.case_ids)).all()
    if not records:
        raise HTTPException(status_code=404, detail="No cases found.")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for rec in records:
            if rec.docx_path and Path(rec.docx_path).exists():
                zip_file.write(rec.docx_path, arcname=f"case_{rec.id}.docx")
            if rec.pdf_path and Path(rec.pdf_path).exists():
                zip_file.write(rec.pdf_path, arcname=f"case_{rec.id}.pdf")

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": "attachment; filename=batch_cases.zip"}
    )
