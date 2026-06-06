from fastapi import FastAPI


app = FastAPI(title="agentic-board FastAPI", version="0.1.0")


@app.get("/")
def read_root() -> dict[str, str]:
    return {"service": "fastapi-api", "status": "ok"}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy"}
