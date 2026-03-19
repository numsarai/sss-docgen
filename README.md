# SSS Superassistant — Document Generation System

A full-stack web application for generating Thai legal documents from `.docx` templates. Supports single-document creation with live preview, batch Excel processing, AI-powered field extraction from scanned PDFs, and in-browser document editing.

---

## Features

| Feature | Description |
|---|---|
| **Template Management** | Upload `.docx` templates with `{{variable}}` placeholders; auto-extract field names |
| **Single Document** | Fill variables manually, preview PDF inline, edit and regenerate before saving |
| **Excel Batch** | Upload an `.xlsx` file → one record per row → edit, generate, preview each doc individually |
| **Excel Template** | Download a pre-filled `.xlsx` with correct column headers for any template |
| **Excel Export** | Export all batch records (with edits) back to `.xlsx` for round-trip workflow |
| **AI Extract** | Upload a scanned PDF → Claude/GPT/Gemini auto-fills template fields |
| **OnlyOffice Editor** | Edit generated `.docx` files in-browser with full Word compatibility |
| **Bank Lookup** | Thai bank dropdown (18 banks) for fields named `รหัสธนาคาร` / `BANK_ID` |
| **Dark Mode** | Toggle between light and dark themes |

---

## Stack

**Backend** — Python 3.9+
- [FastAPI](https://fastapi.tiangolo.com/) + Uvicorn
- SQLAlchemy 2.0 (SQLite)
- python-docx — DOCX generation
- LibreOffice (headless) — DOCX → PDF conversion
- openpyxl — Excel parsing and export
- Anthropic / OpenAI / Google Generative AI — AI field extraction

**Frontend** — TypeScript
- React 18 + React Router v6
- Vite
- Sonner (toast notifications)

**Infrastructure**
- Docker Compose
- Nginx (frontend reverse proxy)
- [OnlyOffice Document Server](https://www.onlyoffice.com/) (in-browser editor)

---

## Quick Start

### Prerequisites
- [Docker](https://www.docker.com/) and Docker Compose
- An Anthropic API key (optional — only needed for AI Extract)

### 1. Clone

```bash
git clone https://github.com/numsarai/sss-docgen.git
cd sss-docgen
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
APP_PASSWORD=your_secure_password
CORS_ORIGINS="*"

# Optional — for AI Extract
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
```

### 3. Run

```bash
docker compose up -d
```

| Service | URL |
|---|---|
| Frontend | http://localhost |
| Backend API | http://localhost:8000 |
| OnlyOffice | http://localhost:8080 |

Login with the password set in `APP_PASSWORD`.

---

## Project Structure

```
sss-docgen/
├── api/
│   ├── main.py              # FastAPI app entry point
│   ├── routes.py            # Case CRUD, generate, preview, download
│   ├── template_routes.py   # Template CRUD + Excel template download
│   ├── batch_routes.py      # Excel batch upload, per-record generate, export
│   ├── models.py            # SQLAlchemy models + Pydantic schemas
│   ├── generator.py         # DOCX rendering + LibreOffice PDF conversion
│   ├── extractor.py         # Template field scanning
│   ├── llm.py               # AI field extraction orchestration
│   ├── llm_providers.py     # Claude / GPT / Gemini adapters
│   ├── banks.py             # Thai bank reference data (18 banks)
│   ├── auth.py              # JWT / password auth
│   └── database.py          # SQLAlchemy session setup
├── docx_engine/
│   ├── engine.py            # DocxEngine class
│   └── replacer.py          # {{variable}} replacement with char-map support
├── ui/src/
│   ├── pages/
│   │   ├── GeneratePage.tsx  # Unified single / batch generate flow
│   │   ├── BatchDetail.tsx   # Batch records table + inline preview
│   │   ├── BatchList.tsx     # Batch history list
│   │   ├── CaseList.tsx      # All generated cases
│   │   ├── CaseDetail.tsx    # Case detail + download
│   │   ├── CasePreview.tsx   # Full-screen PDF preview
│   │   ├── DocumentEditor.tsx # OnlyOffice editor integration
│   │   ├── AIExtract.tsx     # AI field extraction
│   │   ├── TemplateList.tsx  # Template management
│   │   └── Dashboard.tsx     # Analytics overview
│   ├── components/
│   │   └── Layout.tsx        # Sidebar navigation
│   └── api.ts               # Typed API client
├── templates/               # Uploaded .docx templates (git-tracked as example)
├── docker/
│   ├── Dockerfile           # OnlyOffice container
│   └── fonts/               # TH Sarabun New font files
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── nginx.conf
└── requirements.txt
```

---

## Workflow

### Single Document

1. Go to **Generate** → **Single Copy**
2. Select a template → fill in variables (bank fields auto-show as dropdowns)
3. Click **Generate Preview** — PDF appears inline on the right
4. Edit any field → **Regenerate** to update the preview
5. Click **Save as Case** to commit, or **Discard** to cancel

### Excel Batch

1. Go to **Generate** → **Excel Batch**
2. Select a template → click **↓ Get Excel Template** to download a pre-formatted `.xlsx`
3. Fill in the Excel file (one row per document)
4. Upload the filled Excel → records are created
5. In **Batch History**, edit each row, click **Generate** per row or **Generate All**
6. Click **Preview** on any generated row to review the PDF inline
7. Click **↓ Export Excel** to download all records (including edits) back to `.xlsx`

### AI Extract

1. Go to **AI Extract**
2. Select a template and upload a scanned PDF
3. The AI reads the PDF and maps values to template fields
4. Review the extracted values → generate the document

---

## API Reference

Key endpoints (all require `Authorization: Bearer <token>` or `?token=<token>`):

| Method | Path | Description |
|---|---|---|
| `POST` | `/login` | Get access token |
| `GET` | `/cases` | List all cases |
| `POST` | `/generate` | Generate DOCX + PDF from template + variables |
| `GET` | `/cases/{id}/preview/pdf` | Stream PDF preview |
| `GET` | `/cases/{id}/download/docx` | Download DOCX |
| `POST` | `/extract/upload` | AI field extraction from uploaded PDF |
| `GET` | `/templates` | List templates |
| `POST` | `/templates` | Upload a new template |
| `GET` | `/templates/{id}/excel-template` | Download Excel fill-in template |
| `POST` | `/batches/upload` | Upload Excel → create batch records |
| `GET` | `/batches/{id}/records` | List all records in a batch |
| `PUT` | `/batches/{id}/records/{rid}` | Edit record variables |
| `POST` | `/batches/{id}/records/{rid}/generate` | Generate single record |
| `POST` | `/batches/{id}/generate-all` | Generate all pending records |
| `GET` | `/batches/{id}/export-excel` | Export batch records to Excel |
| `GET` | `/banks` | List Thai bank reference data |

---

## Template Format

Templates are standard `.docx` files using `{{variable_name}}` placeholders:

```
เลขที่ {{เลขที่หนังสือ}}  วันที่ {{วันที่}} เดือน {{เดือน}} พ.ศ. {{ปีพ.ศ.}}

เรียน ผู้จัดการธนาคาร {{ชื่อบัญชี}}
บัญชีเลขที่ {{เลขบัญชี}} ...
```

Fields named `รหัสธนาคาร` or `BANK_ID` automatically render as a Thai bank dropdown in the UI.

---

## Development

### Backend (local)

```bash
pip install -r requirements.txt
cp .env.example .env
uvicorn api.main:app --reload --port 8000
```

### Frontend (local)

```bash
cd ui
npm install
npm run dev     # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:8000`.

---

## License

MIT
