from unittest.mock import patch

from app.services.nest_client import NestClient


class FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return b'{"answer":"ok"}'


def test_nest_client_forwards_original_client_address():
    captured = {}

    def fake_urlopen(request, timeout):
        captured["headers"] = dict(request.header_items())
        captured["timeout"] = timeout
        return FakeResponse()

    with patch("app.services.nest_client.urlopen", side_effect=fake_urlopen):
        result = NestClient(forwarded_for="203.0.113.7").post_json(
            "/rag/questions", {"question": "seat"}
        )

    assert result == {"answer": "ok"}
    assert captured["headers"]["X-forwarded-for"] == "203.0.113.7"
    assert captured["timeout"] == 8
