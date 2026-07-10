from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.routers import auth, balances, groups, transactions

app = FastAPI(title="Debt Splitter", docs_url="/api/docs", redoc_url=None)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(groups.router, prefix="/api/groups", tags=["groups"])
app.include_router(transactions.router, prefix="/api", tags=["transactions"])
app.include_router(balances.router, prefix="/api", tags=["balances"])

STATIC_DIR = Path(__file__).parent / "static"


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    if not STATIC_DIR.exists():
        return {"message": "Frontend not built. Run: npm run build in /frontend"}
    candidate = STATIC_DIR / full_path
    if candidate.exists() and candidate.is_file():
        return FileResponse(str(candidate))
    return FileResponse(str(STATIC_DIR / "index.html"))
