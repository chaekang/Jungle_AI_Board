from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_cors_origins
from app.routers.agent import router as agent_router
from app.routers.demo import router as demo_router
from app.routers.mcp import router as mcp_router

app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(demo_router)
app.include_router(mcp_router)
app.include_router(agent_router)
