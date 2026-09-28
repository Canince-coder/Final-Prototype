import re
import uuid
import zipfile
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

DOCUMENT_EXTS = {".pdf", ".docx", ".txt"}
PROOF_EXTS = DOCUMENT_EXTS | {".png", ".jpg", ".jpeg"}


def save_upload(upload: UploadFile, subdir: str, allowed: set[str]) -> tuple[str, int]:
    """Stream an upload to disk under a random name. Returns (stored_name, size)."""
    ext = Path(upload.filename or "").suffix.lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{ext or 'none'}'. Allowed: {', '.join(sorted(allowed))}",
        )
    folder = settings.upload_dir / subdir
    folder.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{ext}"
    path = folder / stored
    limit = settings.max_upload_mb * 1024 * 1024
    size = 0
    with path.open("wb") as out:
        while chunk := upload.file.read(1024 * 1024):
            size += len(chunk)
            if size > limit:
                out.close()
                path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    detail=f"File exceeds {settings.max_upload_mb} MB",
                )
            out.write(chunk)
    if size == 0:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")
    return f"{subdir}/{stored}", size


def stored_path(stored_name: str) -> Path:
    return settings.upload_dir / stored_name


def delete_stored(stored_name: str) -> None:
    stored_path(stored_name).unlink(missing_ok=True)


def extract_text(stored_name: str) -> str | None:
    """Best-effort plain text from txt/docx/pdf. None for images or unreadable files."""
    path = stored_path(stored_name)
    ext = path.suffix.lower()
    try:
        if ext == ".txt":
            return path.read_text(encoding="utf-8", errors="ignore")
        if ext == ".docx":
            with zipfile.ZipFile(path) as z:
                xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
            return re.sub(r"<[^>]+>", " ", xml.replace("</w:p>", "\n"))
        if ext == ".pdf":
            from pypdf import PdfReader

            return "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
    except Exception:  # noqa: BLE001 - corrupt/unsupported file: analysis just gets no text
        return None
    return None
