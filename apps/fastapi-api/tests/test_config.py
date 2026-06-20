from app.config import get_cors_origins


def test_get_cors_origins_uses_local_defaults_when_unset(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)

    assert get_cors_origins() == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_get_cors_origins_parses_comma_separated_values(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com, https://admin.example.com ")

    assert get_cors_origins() == ["https://app.example.com", "https://admin.example.com"]
