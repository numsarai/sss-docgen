"""Launcher script — avoids uvicorn --reload triggering Path.cwd() on OneDrive."""
import sys

PROJECT = "/Users/saraithong/Library/CloudStorage/OneDrive-Personal/Saraithong Code/Test"
if PROJECT not in sys.path:
    sys.path.insert(0, PROJECT)

import uvicorn  # noqa: E402

if __name__ == "__main__":
    uvicorn.run(
        "api.main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        reload_excludes=[".venv/*", "ui/*"]
    )
