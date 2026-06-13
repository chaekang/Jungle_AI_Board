import unittest
from unittest.mock import patch

from app.schemas.agent import SeatRecommendationRequest
from app.services.seat_agent_service import recommend_seat


class FakeNestClient:
    def get_json(self, path, params=None):
        if path == "/theaters":
            return [{"id": "1", "name": "블루스퀘어 신한카드홀"}]

        if path == "/musicals":
            return [{"id": "1", "title": "팬텀"}]

        if path == "/seat-reviews/search":
            return {
                "items": [
                    {
                        "id": "10",
                        "theater": {"name": "블루스퀘어 신한카드홀"},
                        "musical": {"title": "팬텀"},
                        "performance": {"seasonLabel": "2025"},
                        "seat": {
                            "floor": "2층",
                            "section": "B",
                            "row": "3",
                            "number": "12",
                        },
                        "ratings": {
                            "view": 5,
                            "sound": 4,
                            "comfort": 5,
                            "expression": 4,
                            "stageVisibility": 4,
                        },
                        "tags": [{"name": "시야좋음"}],
                        "content": "중앙에 가까워 시야가 안정적이고 오래 앉기에도 괜찮았습니다.",
                    }
                ]
            }

        return []

    def post_json(self, path, body):
        return {
            "answer": "블루스퀘어 2층 3열 시야는 무난한 편이에요. 무대 전체는 따라가기 괜찮지만 표정은 오글이 있는 쪽이 안전합니다."
        }


class RowAwareFakeNestClient(FakeNestClient):
    def get_json(self, path, params=None):
        if path in {"/theaters", "/musicals"}:
            return super().get_json(path, params)

        if path == "/seat-reviews/search":
            if params and params.get("seatRow") == "3":
                return {
                    "items": [
                        {
                            "id": "20",
                            "theater": {"name": "블루스퀘어 신한카드홀"},
                            "musical": {"title": "지킬 앤 하이드"},
                            "performance": {"seasonLabel": "2025"},
                            "seat": {
                                "floor": "2층",
                                "section": "A",
                                "row": "3",
                                "number": "1",
                            },
                            "ratings": {
                                "view": 3,
                                "sound": 4,
                                "comfort": 5,
                                "expression": 3,
                                "stageVisibility": 4,
                            },
                            "tags": [{"name": "사이드시야"}],
                            "content": "무대 바닥과 대형은 보이지만 배우 얼굴은 오글이 필요했습니다.",
                        }
                    ]
                }

            return {
                "items": [
                    {
                        "id": "21",
                        "theater": {"name": "블루스퀘어 신한카드홀"},
                        "musical": {"title": "지킬 앤 하이드"},
                        "performance": {"seasonLabel": "2025"},
                        "seat": {
                            "floor": "2층",
                            "section": "C",
                            "row": "2",
                            "number": "35",
                        },
                        "ratings": {
                            "view": 4,
                            "sound": 5,
                            "comfort": 3,
                            "expression": 3,
                            "stageVisibility": 5,
                        },
                        "tags": [{"name": "사이드시야"}],
                        "content": "전체 무대는 잘 들어오지만 표정은 오글이 필요했습니다.",
                    },
                    {
                        "id": "22",
                        "theater": {"name": "블루스퀘어 신한카드홀"},
                        "musical": {"title": "지킬 앤 하이드"},
                        "performance": {"seasonLabel": "2025"},
                        "seat": {
                            "floor": "2층",
                            "section": "A",
                            "row": "3",
                            "number": "1",
                        },
                        "ratings": {
                            "view": 3,
                            "sound": 4,
                            "comfort": 5,
                            "expression": 3,
                            "stageVisibility": 4,
                        },
                        "tags": [{"name": "사이드시야"}],
                        "content": "무대 바닥과 대형은 보이지만 배우 얼굴은 오글이 필요했습니다.",
                    },
                    {
                        "id": "23",
                        "theater": {"name": "블루스퀘어 신한카드홀"},
                        "musical": {"title": "지킬 앤 하이드"},
                        "performance": {"seasonLabel": "2025"},
                        "seat": {
                            "floor": "2층",
                            "section": "B",
                            "row": "4",
                            "number": "20",
                        },
                        "ratings": {
                            "view": 4,
                            "sound": 4,
                            "comfort": 4,
                            "expression": 3,
                            "stageVisibility": 4,
                        },
                        "tags": [],
                        "content": "시야는 무난했고 무대 전체를 따라가기 좋았습니다.",
                    },
                ]
            }

        return []


class ObstructionRangeFakeNestClient(FakeNestClient):
    def get_json(self, path, params=None):
        if path == "/theaters":
            return [{"id": "50", "name": "세종문화회관 대극장"}]

        if path == "/musicals":
            return []

        if path == "/seat-reviews/search":
            self.last_params = params
            return {
                "items": [
                    {
                        "id": "101",
                        "theater": {"name": "세종문화회관 대극장"},
                        "musical": {"title": "웃는 남자"},
                        "performance": {"seasonLabel": "2022"},
                        "seat": {
                            "floor": "1층",
                            "section": "A",
                            "row": "1",
                            "number": "3",
                        },
                        "ratings": {
                            "view": 2,
                            "sound": 4,
                            "comfort": 3,
                            "expression": 3,
                            "stageVisibility": 3,
                        },
                        "tags": [{"name": "시야방해"}],
                        "content": "난간 때문에 시야방해가 있었습니다.",
                    },
                    {
                        "id": "102",
                        "theater": {"name": "세종문화회관 대극장"},
                        "musical": {"title": "웃는 남자"},
                        "performance": {"seasonLabel": "2022"},
                        "seat": {
                            "floor": "1층",
                            "section": "D",
                            "row": "18",
                            "number": "9",
                        },
                        "ratings": {
                            "view": 3,
                            "sound": 4,
                            "comfort": 3,
                            "expression": 3,
                            "stageVisibility": 4,
                        },
                        "tags": [{"name": "시야방해"}],
                        "content": "앞사람 영향으로 가리는 순간이 있었습니다.",
                    },
                    {
                        "id": "103",
                        "theater": {"name": "세종문화회관 대극장"},
                        "musical": {"title": "웃는 남자"},
                        "performance": {"seasonLabel": "2022"},
                        "seat": {
                            "floor": "2층",
                            "section": "G",
                            "row": "19",
                            "number": "12",
                        },
                        "ratings": {
                            "view": 3,
                            "sound": 4,
                            "comfort": 3,
                            "expression": 2,
                            "stageVisibility": 4,
                        },
                        "tags": [{"name": "시야방해"}],
                        "content": "난간 때문에 장면 일부가 가렸습니다.",
                    },
                ],
                "hasNext": False,
            }

        return []

    def post_json(self, path, body):
        return {
            "answer": "세종문화회관 대극장 2층 몇열 시야는 좋은 편이에요. 정확히 맞는 후기가 적어서 2층 전체 후기까지 넓혀 봤습니다."
        }


class TheaterAliasFakeNestClient(FakeNestClient):
    def get_json(self, path, params=None):
        if path == "/theaters":
            return [
                {"id": "15", "name": "TOM 1관"},
                {"id": "16", "name": "TOM 2관"},
                {"id": "45", "name": "블루스퀘어 신한카드홀"},
                {"id": "50", "name": "세종문화회관 대극장"},
            ]

        if path == "/musicals":
            return []

        if path == "/seat-reviews/search":
            return {"items": [], "hasNext": False}

        return []

    def post_json(self, path, body):
        return {}


class SeatAgentServiceTest(unittest.TestCase):
    @patch("app.services.seat_agent_service.NestClient", return_value=FakeNestClient())
    def test_recommends_with_evidence_and_mcp_status(self, _):
        result = recommend_seat(
            SeatRecommendationRequest(
                question="블루스퀘어 팬텀 2층 시야 좋고 편한 자리 추천해줘",
                theaterName="블루스퀘어 신한카드홀",
                limit=3,
            )
        )

        self.assertEqual(result.official_section, "B")
        self.assertEqual(result.direction, "중앙블록")
        self.assertEqual(result.mcp_status, "ok")
        self.assertEqual(len(result.evidence_reviews), 1)

    @patch("app.services.seat_agent_service.NestClient", return_value=FakeNestClient())
    def test_resolves_theater_alias_from_question(self, _):
        result = recommend_seat(
            SeatRecommendationRequest(
                question="블퀘 2층 3열 괜찮아?",
                limit=3,
            )
        )

        self.assertEqual(result.filters.theater_name, "블루스퀘어 신한카드홀")
        self.assertEqual(result.mcp_status, "ok")

    @patch(
        "app.services.seat_agent_service.NestClient",
        return_value=TheaterAliasFakeNestClient(),
    )
    def test_resolves_more_theater_aliases_from_question(self, _):
        cases = [
            ("신카홀 2층 시야 어때?", "블루스퀘어 신한카드홀"),
            ("세종 1층 시야방해 몇열까지야?", "세종문화회관 대극장"),
            ("티오엠 2관 1층 시야 어때?", "TOM 2관"),
        ]

        for question, theater_name in cases:
            with self.subTest(question=question):
                result = recommend_seat(SeatRecommendationRequest(question=question, limit=3))
                self.assertEqual(result.filters.theater_name, theater_name)

    @patch("app.services.seat_agent_service.NestClient", return_value=RowAwareFakeNestClient())
    def test_assesses_view_question_with_nearby_rows_instead_of_recommending(self, _):
        result = recommend_seat(
            SeatRecommendationRequest(
                question="블루스퀘어 2층 3열 시야 어때?",
                limit=5,
            )
        )

        self.assertEqual(result.filters.theater_name, "블루스퀘어 신한카드홀")
        self.assertEqual(result.filters.seat_floor, "2층")
        self.assertEqual(result.filters.seat_row, "3")
        self.assertIn("시야는", result.recommendation)
        self.assertNotIn("2~4열", result.recommendation)
        self.assertNotIn("정확히", result.recommendation)
        self.assertNotIn("후기까지 같이", result.recommendation)
        self.assertNotIn("추천 범위", result.recommendation)

    @patch(
        "app.services.seat_agent_service.NestClient",
        return_value=ObstructionRangeFakeNestClient(),
    )
    def test_answers_obstruction_range_by_floor(self, _):
        result = recommend_seat(
            SeatRecommendationRequest(
                question="세종문화회관 2층에서 난간 시야 방해 있는 게 몇열까지야?",
                limit=5,
            )
        )

        self.assertEqual(result.filters.theater_name, "세종문화회관 대극장")
        self.assertEqual(result.filters.seat_floor, "2층")
        self.assertIsNone(result.filters.seat_row)
        self.assertIn("2층은 시야방해 태그가 19열까지", result.recommendation)
        self.assertNotIn("시야는 좋은 편", result.recommendation)
        self.assertNotIn("정확히 맞는 후기가 적어서", result.recommendation)


if __name__ == "__main__":
    unittest.main()
