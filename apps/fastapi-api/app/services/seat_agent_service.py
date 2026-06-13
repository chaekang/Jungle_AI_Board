from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass

from app.schemas.agent import (
    AgentFilters,
    EvidenceReview,
    SeatRecommendationRequest,
    SeatRecommendationResponse,
)
from app.services.nest_client import NestClient, NestClientError
from app.services.seat_metadata_service import get_seat_layout, list_supported_theaters


PRIORITY_KEYWORDS = {
    "view": ("시야", "잘 보여", "잘보여", "가림", "난간", "시방"),
    "sound": ("음향", "소리", "넘버", "오케", "대사"),
    "comfort": ("편한", "편해", "편안", "다리", "허리", "오래 앉아"),
    "expression": ("표정", "얼굴", "배우", "배역", "가까이"),
    "stageVisibility": ("전체", "무대", "군무", "연출", "동선"),
    "lowObstruction": ("시야 방해", "시야방해", "가림 적", "안 가려"),
}
SIDE_KEYWORDS = {
    "left": ("왼쪽", "좌측", "왼블", "좌블"),
    "center": ("중앙", "가운데", "센터", "중블"),
    "right": ("오른쪽", "우측", "오블", "우블"),
}
RATING_KEYS = {
    "view": "view",
    "sound": "sound",
    "comfort": "comfort",
    "expression": "expression",
    "stageVisibility": "stageVisibility",
}
THEATER_ALIASES = {
    "세종": "세종문화회관 대극장",
    "세종대극장": "세종문화회관 대극장",
    "세종 대극장": "세종문화회관 대극장",
    "세종문화회관": "세종문화회관 대극장",
    "세문": "세종문화회관 대극장",
    "세문회": "세종문화회관 대극장",
    "세종문회": "세종문화회관 대극장",
    "세종 m씨어터": "세종문화회관 M씨어터",
    "세종 m": "세종문화회관 M씨어터",
    "세종 엠씨어터": "세종문화회관 M씨어터",
    "m씨어터": "세종문화회관 M씨어터",
    "엠씨어터": "세종문화회관 M씨어터",
    "세종 s씨어터": "세종문화회관 S씨어터",
    "세종 s": "세종문화회관 S씨어터",
    "세종 에스씨어터": "세종문화회관 S씨어터",
    "s씨어터": "세종문화회관 S씨어터",
    "에스씨어터": "세종문화회관 S씨어터",
    "블루스퀘어": "블루스퀘어 신한카드홀",
    "블루 스퀘어": "블루스퀘어 신한카드홀",
    "블퀘": "블루스퀘어 신한카드홀",
    "블스": "블루스퀘어 신한카드홀",
    "블루스퀘어 신카홀": "블루스퀘어 신한카드홀",
    "신카홀": "블루스퀘어 신한카드홀",
    "신한카드홀": "블루스퀘어 신한카드홀",
    "tom": "TOM 1관",
    "tom 1관": "TOM 1관",
    "티오엠": "TOM 1관",
    "티오엠 1관": "TOM 1관",
    "톰": "TOM 1관",
    "톰 1관": "TOM 1관",
    "대학로 tom": "TOM 1관",
    "대학로 티오엠": "TOM 1관",
    "tom 2관": "TOM 2관",
    "티오엠 2관": "TOM 2관",
    "톰 2관": "TOM 2관",
}


@dataclass
class CandidateScore:
    review: dict
    score: float


@dataclass
class ReviewSearchScope:
    reviews: list[dict]
    label: str
    exact_count: int


def recommend_seat(request: SeatRecommendationRequest) -> SeatRecommendationResponse:
    client = NestClient()
    filters = _extract_filters(request, client)
    intent = _detect_intent(request.question)
    mcp_status = "not_requested"
    rag_status = "skipped"
    rag_answer = None

    if filters.theater_name:
        mcp = get_seat_layout(filters.theater_name)
        mcp_status = mcp.status

    search_scope = _load_review_scope(client, filters, request.limit, intent)
    reviews = search_scope.reviews

    if request.use_rag:
        try:
            rag = client.post_json(
                "/rag/questions",
                {"question": request.question, "limit": 10},
            )
            rag_answer = rag.get("answer") if isinstance(rag, dict) else None
            rag_status = "ok" if rag_answer else "empty"
        except NestClientError:
            rag_status = "fallback"

    scored = sorted(
        (_score_review(review, filters) for review in reviews),
        key=lambda item: item.score,
        reverse=True,
    )
    evidence = [_to_evidence(item.review) for item in scored[: request.limit]]
    best = scored[0].review if scored else None
    official_section = _select_official_section(reviews, best)
    descriptive_block = _select_descriptive_block(filters, official_section, best)

    reasons = _build_reasons(filters, evidence, official_section, descriptive_block, rag_answer)
    cautions = _build_cautions(evidence, official_section)
    local_answer = _build_answer(
        intent,
        filters,
        evidence,
        official_section,
        descriptive_block,
        search_scope,
    )
    recommendation = local_answer if intent == "obstruction_range" else rag_answer or local_answer

    return SeatRecommendationResponse(
        recommendation=recommendation,
        officialSection=official_section,
        descriptiveBlock=descriptive_block,
        direction=_direction_label(descriptive_block),
        reasons=reasons,
        cautions=cautions,
        evidenceReviews=evidence,
        filters=filters,
        mcpStatus=mcp_status,
        ragStatus=rag_status,
        ragAnswer=rag_answer,
    )


def _extract_filters(request: SeatRecommendationRequest, client: NestClient) -> AgentFilters:
    question = request.question
    theaters = _safe_get(client, "/theaters")
    musicals = _safe_get(client, "/musicals")

    theater_name = request.theater_name or _find_name(question, theaters, "name")
    musical_title = request.musical_title or _find_name(question, musicals, "title")
    season_label = request.season_label or _extract_season(question)
    priorities = list(dict.fromkeys([*request.priorities, *_extract_priorities(question)]))

    if not priorities:
        priorities = ["view"]

    seat_row = _extract_regex(question, r"(\d+|[A-Z가-힣]+)\s*(열|row)", lambda match: match.group(1).upper())

    if _asks_range(question) and seat_row and _parse_int(seat_row) is None:
        seat_row = None

    return AgentFilters(
        theaterName=theater_name,
        musicalTitle=musical_title,
        seasonLabel=season_label,
        seatFloor=_extract_regex(question, r"(\d+)\s*(층|F)", lambda match: f"{match.group(1)}{_floor_unit(match.group(2))}"),
        seatSection=_extract_regex(question, r"([A-Z가-힣0-9]+)\s*(구역|블록|블럭)", lambda match: match.group(1).upper()),
        seatRow=seat_row,
        seatNumber=_extract_regex(question, r"(\d+)\s*(번|number)", lambda match: match.group(1)),
        side=_extract_side(question),
        priorities=priorities,
        budget=request.budget or _extract_budget(question),
    )


def _detect_intent(question: str) -> str:
    if _asks_obstruction_range(question):
        return "obstruction_range"
    if any(keyword in question for keyword in ("추천", "골라", "어디", "좋은 자리", "좋을까")):
        return "recommendation"
    if any(keyword in question for keyword in ("어때", "어떰", "괜찮", "보여", "가려", "시야", "음향", "편해")):
        return "assessment"
    return "recommendation"


def _asks_range(question: str) -> bool:
    return bool(re.search(r"몇\s*열까지|어느\s*열까지|어디까지|범위|까지야|까지니", question))


def _asks_obstruction_range(question: str) -> bool:
    return _asks_range(question) and any(
        keyword in question for keyword in ("시야방해", "시야 방해", "시방", "가림", "난간")
    )


def _safe_get(client: NestClient, path: str) -> list[dict]:
    try:
        value = client.get_json(path)
        return value if isinstance(value, list) else []
    except NestClientError:
        return []


def _find_name(question: str, items: list[dict], key: str) -> str | None:
    lowered = question.lower()
    compact_question = _compact(question)
    for item in items:
        value = item.get(key)
        if isinstance(value, str) and (
            value.lower() in lowered or _compact(value) in compact_question
        ):
            return value

    if key == "name":
        alias_match = _find_theater_alias(lowered)
        if alias_match:
            return alias_match

    for theater in list_supported_theaters():
        if theater.lower() in lowered:
            return theater

    return None


def _find_theater_alias(lowered_question: str) -> str | None:
    supported = {theater.lower(): theater for theater in list_supported_theaters()}
    compact_question = _compact(lowered_question)

    for alias, theater in sorted(THEATER_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
        if alias.lower() not in lowered_question and _compact(alias) not in compact_question:
            continue

        canonical = supported.get(theater.lower())
        if canonical:
            return canonical

    return None


def _compact(value: str) -> str:
    return re.sub(r"\s+", "", value.lower())


def _extract_priorities(question: str) -> list[str]:
    return [
        priority
        for priority, keywords in PRIORITY_KEYWORDS.items()
        if any(keyword in question for keyword in keywords)
    ]


def _extract_side(question: str):
    for side, keywords in SIDE_KEYWORDS.items():
        if any(keyword in question for keyword in keywords):
            return side
    return None


def _extract_season(question: str) -> str | None:
    match = re.search(r"(\d{2,4}(?:-\d{2,4})?\s*시즌)", question)
    return match.group(1).replace(" ", "") if match else None


def _extract_budget(question: str) -> int | None:
    match = re.search(r"(\d+)\s*(만원|원)", question)
    if not match:
        return None

    value = int(match.group(1))
    return value * 10000 if match.group(2) == "만원" else value


def _extract_regex(question: str, pattern: str, transform):
    match = re.search(pattern, question, flags=re.IGNORECASE)
    return transform(match) if match else None


def _floor_unit(value: str) -> str:
    return "F" if value.upper() == "F" else "층"


def _to_search_params(
    filters: AgentFilters,
    limit: int,
    intent: str = "",
    page: int = 1,
) -> dict[str, object | None]:
    primary_priority = filters.priorities[0] if filters.priorities else "view"
    sort = RATING_KEYS.get(primary_priority, "view")
    return {
        "theater": filters.theater_name,
        "musical": filters.musical_title,
        "seasonLabel": filters.season_label,
        "seatFloor": filters.seat_floor,
        "seatSection": filters.seat_section,
        "seatRow": filters.seat_row,
        "seatNumber": filters.seat_number,
        "tag": "시야방해" if intent == "obstruction_range" else None,
        "hasObstruction": True
        if intent == "obstruction_range"
        else False
        if "lowObstruction" in filters.priorities
        else None,
        "sort": sort,
        "page": page,
        "limit": max(limit, 10),
    }


def _load_review_scope(
    client: NestClient,
    filters: AgentFilters,
    limit: int,
    intent: str,
) -> ReviewSearchScope:
    if intent == "obstruction_range":
        reviews = _search_obstruction_range_reviews(client, filters)
        return ReviewSearchScope(
            reviews=reviews,
            label="obstruction_range",
            exact_count=len(reviews),
        )

    exact_reviews = _search_reviews(client, filters, limit)

    if len(exact_reviews) >= min(3, limit) or not filters.seat_row:
        return ReviewSearchScope(reviews=exact_reviews, label="exact", exact_count=len(exact_reviews))

    broad_filters = filters.model_copy(update={"seat_row": None, "seat_number": None})
    broad_reviews = _search_reviews(client, broad_filters, 50)
    nearby_reviews = _nearby_row_reviews(broad_reviews, filters.seat_row)

    if nearby_reviews:
        return ReviewSearchScope(
            reviews=nearby_reviews[: max(limit, 10)],
            label="nearby_row",
            exact_count=len(exact_reviews),
        )

    return ReviewSearchScope(
        reviews=broad_reviews[: max(limit, 10)],
        label="same_scope",
        exact_count=len(exact_reviews),
    )


def _search_reviews(client: NestClient, filters: AgentFilters, limit: int) -> list[dict]:
    try:
        search_result = client.get_json("/seat-reviews/search", _to_search_params(filters, limit))
        return search_result.get("items", []) if isinstance(search_result, dict) else []
    except NestClientError:
        return []


def _search_obstruction_range_reviews(client: NestClient, filters: AgentFilters) -> list[dict]:
    reviews: list[dict] = []
    range_filters = filters.model_copy(update={"seat_row": None, "seat_number": None})

    for page in range(1, 26):
        try:
            search_result = client.get_json(
                "/seat-reviews/search",
                _to_search_params(range_filters, 50, intent="obstruction_range", page=page),
            )
        except NestClientError:
            break

        if not isinstance(search_result, dict):
            break

        items = search_result.get("items", [])
        if isinstance(items, list):
            reviews.extend(items)

        if not search_result.get("hasNext"):
            break

    return reviews


def _nearby_row_reviews(reviews: list[dict], target_row: str) -> list[dict]:
    target_number = _parse_int(target_row)
    if target_number is None:
        return reviews

    nearby = [
        review
        for review in reviews
        if (row_number := _parse_int(review.get("seat", {}).get("row"))) is not None
        and abs(row_number - target_number) <= 1
    ]
    return nearby


def _score_review(review: dict, filters: AgentFilters) -> CandidateScore:
    ratings = review.get("ratings", {})
    score = 0.0
    for priority in filters.priorities:
        rating_key = RATING_KEYS.get(priority)
        if rating_key:
            score += float(ratings.get(rating_key, 0)) * 2

    tags = [tag.get("name", "") for tag in review.get("tags", [])]
    if "lowObstruction" in filters.priorities and any("시야방해" in tag or "사이드" in tag for tag in tags):
        score -= 4
    if filters.side and _section_to_side(review.get("seat", {}).get("section")) == filters.side:
        score += 2
    if filters.seat_row:
        target_row = _parse_int(filters.seat_row)
        review_row = _parse_int(review.get("seat", {}).get("row"))
        if target_row is not None and review_row is not None:
            distance = abs(target_row - review_row)
            if distance == 0:
                score += 3
            elif distance == 1:
                score += 2
            elif distance == 2:
                score += 1

    return CandidateScore(review=review, score=score)


def _parse_int(value: object) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    return int(text) if text.isdigit() else None


def _select_official_section(reviews: list[dict], best: dict | None) -> str | None:
    if best:
        section = best.get("seat", {}).get("section")
        if section:
            return section

    sections = [
        review.get("seat", {}).get("section")
        for review in reviews
        if review.get("seat", {}).get("section")
    ]
    return Counter(sections).most_common(1)[0][0] if sections else None


def _select_descriptive_block(filters: AgentFilters, official_section: str | None, best: dict | None) -> str | None:
    if filters.side:
        return filters.side
    if best:
        return _section_to_side(best.get("seat", {}).get("section"))
    return _section_to_side(official_section)


def _section_to_side(section: str | None) -> str | None:
    if not section:
        return None
    first = section[0].upper()
    if first in {"A", "D", "G"}:
        return "left"
    if first in {"B", "E", "H"}:
        return "center"
    if first in {"C", "F"}:
        return "right"
    return None


def _direction_label(block: str | None) -> str:
    return {
        "left": "왼쪽블록",
        "center": "중앙블록",
        "right": "오른쪽블록",
    }.get(block or "", "근거 후기 중심")


def _build_answer(
    intent: str,
    filters: AgentFilters,
    evidence: list[EvidenceReview],
    official_section: str | None,
    block: str | None,
    search_scope: ReviewSearchScope,
) -> str:
    if intent == "obstruction_range":
        return _build_obstruction_range(filters, search_scope.reviews)
    if intent == "assessment":
        return _build_assessment(filters, evidence, search_scope)
    return _build_recommendation(official_section, block, evidence)


def _build_obstruction_range(filters: AgentFilters, reviews: list[dict]) -> str:
    ranges: dict[str, tuple[int, int, int]] = {}

    for review in reviews:
        seat = review.get("seat", {})
        floor = seat.get("floor")
        row = _parse_int(seat.get("row"))

        if not floor or row is None:
            continue

        current = ranges.get(floor)
        if current is None:
            ranges[floor] = (row, row, 1)
        else:
            ranges[floor] = (
                min(current[0], row),
                max(current[1], row),
                current[2] + 1,
            )

    if not ranges:
        target = " ".join(value for value in [filters.theater_name, filters.seat_floor] if value)
        return f"{target or '해당 조건'}에서는 시야방해가 몇 열까지 있는지 확인할 만한 후기를 찾지 못했습니다."

    theater = filters.theater_name or "해당 극장"

    if filters.seat_floor and filters.seat_floor in ranges:
        _, max_row, count = ranges[filters.seat_floor]
        return f"{theater} {filters.seat_floor}은 시야방해 태그가 {max_row}열까지 확인됩니다. 이건 {filters.seat_floor} 전체가 다 방해된다는 뜻이 아니라, 후기에서 난간이나 가림 같은 방해 요소가 기록된 좌석이 {max_row}열까지 있었다는 의미예요. 현재 확인한 시야방해 후기는 {count}개입니다."

    floor_text = ", ".join(
        f"{floor}은 {min_row}열부터 {max_row}열까지"
        for floor, (min_row, max_row, _) in sorted(ranges.items(), key=lambda item: _parse_int(item[0]) or 0)
    )
    total = sum(count for _, _, count in ranges.values())
    return f"{theater}은 시야방해 태그가 {floor_text} 확인됩니다. 전체 좌석이 다 방해된다는 뜻은 아니고, 방해 요소가 기록된 후기가 그 범위까지 있다는 의미예요. 현재 확인한 시야방해 후기는 {total}개입니다."


def _build_assessment(
    filters: AgentFilters,
    evidence: list[EvidenceReview],
    search_scope: ReviewSearchScope,
) -> str:
    seat_label = _target_seat_label(filters)

    if not evidence:
        return f"{seat_label}는 아직 참고할 만한 후기가 부족합니다. 층이나 구역 정도로 조금 넓게 물어보면 더 안정적으로 볼 수 있어요."

    view_average = _average_rating(evidence, "view")
    expression_average = _average_rating(evidence, "expression")
    stage_average = _average_rating(evidence, "stageVisibility")
    obstruction_count = sum(1 for review in evidence if any("시야방해" in tag for tag in review.tags))
    side_count = sum(1 for review in evidence if any("사이드" in tag for tag in review.tags))

    parts = [
        f"{seat_label} 시야는 {_rating_phrase(view_average)}.",
    ]

    if expression_average < 4:
        parts.append("배우 표정까지 선명하게 보려면 오글은 챙기는 쪽이 안전합니다.")
    if stage_average >= 4:
        parts.append("대신 무대 전체나 장면 전환을 따라가는 쪽은 괜찮게 볼 가능성이 큽니다.")
    if obstruction_count:
        parts.append("시야방해 언급이 일부 있어서 난간이나 앞사람 영향은 좌석표로 한 번 더 확인하는 게 좋아요.")
    elif side_count:
        parts.append("사이드 시야 언급이 있어서 중앙이 아니라면 시선이 한쪽으로 살짝 쏠릴 수 있습니다.")

    return " ".join(parts)


def _target_seat_label(filters: AgentFilters) -> str:
    values = [
        filters.theater_name,
        filters.seat_floor,
        f"{filters.seat_section}구역" if filters.seat_section else None,
        f"{filters.seat_row}열" if filters.seat_row else None,
        f"{filters.seat_number}번" if filters.seat_number else None,
    ]
    return " ".join(value for value in values if value) or "해당 좌석"


def _average_rating(evidence: list[EvidenceReview], key: str) -> float:
    values = [review.ratings.get(key, 0) for review in evidence]
    return sum(values) / len(values) if values else 0


def _rating_phrase(value: float) -> str:
    if value >= 4.5:
        return "좋은 편이에요"
    if value >= 3.8:
        return "괜찮은 편이에요"
    if value >= 3:
        return "무난하지만 아주 탁 트인 느낌까지는 아닐 수 있어요"
    return "아쉬울 가능성이 있어요"


def _build_recommendation(official_section: str | None, block: str | None, evidence: list[EvidenceReview]) -> str:
    if official_section:
        return f"{official_section}구역 {_direction_label(block)} 위주로 보는 편이 좋습니다."
    if block:
        return f"공식 구역 대신 {_direction_label(block)} 범위로 잡는 편이 안전합니다."
    if evidence:
        return "근거 후기의 평점이 높은 좌석 범위부터 확인하는 편이 좋습니다."
    return "조건에 맞는 후기가 부족해 특정 구역보다 검색 범위를 넓히는 편이 좋습니다."


def _build_reasons(
    filters: AgentFilters,
    evidence: list[EvidenceReview],
    official_section: str | None,
    block: str | None,
    rag_answer: str | None,
) -> list[str]:
    reasons = []
    if filters.theater_name:
        reasons.append(f"{filters.theater_name} 후기를 우선 검색했습니다.")
    if filters.musical_title:
        reasons.append(f"{filters.musical_title} 후기를 우선 검색했습니다.")
    if filters.priorities:
        reasons.append(f"{', '.join(filters.priorities)} 조건을 평점과 태그 정렬에 반영했습니다.")
    if official_section:
        reasons.append(f"공식 구역 {official_section}를 추천 범위로 사용할 수 있습니다.")
    elif block:
        reasons.append(f"공식 구역이 부족해 설명용 { _direction_label(block) } 기준으로 안내했습니다.")
    if rag_answer:
        reasons.append("RAG 답변을 참고 근거로 보강했습니다.")
    reasons.append(f"근거 후기 {len(evidence)}개를 함께 반환했습니다.")
    return reasons


def _build_cautions(evidence: list[EvidenceReview], official_section: str | None) -> list[str]:
    cautions = []
    if len(evidence) < 3:
        cautions.append("근거 후기가 적어 추천 확신도가 높지 않습니다.")
    if official_section is None:
        cautions.append("공식 구역이 없거나 부족해 설명용 블록으로만 안내합니다.")
    if any(any("시야방해" in tag or "사이드" in tag for tag in review.tags) for review in evidence):
        cautions.append("일부 근거에 시야방해나 사이드 시야 태그가 있어 예매 전 좌석표를 확인하세요.")
    return cautions or ["공연별 무대 연출에 따라 체감이 달라질 수 있습니다."]


def _to_evidence(review: dict) -> EvidenceReview:
    seat = review.get("seat", {})
    tags = [tag.get("name", "") for tag in review.get("tags", []) if tag.get("name")]
    performance = review.get("performance") or {}
    return EvidenceReview(
        id=review.get("id", ""),
        theaterName=review.get("theater", {}).get("name", ""),
        musicalTitle=review.get("musical", {}).get("title", ""),
        seasonLabel=performance.get("seasonLabel"),
        seat=" ".join(
            value
            for value in [
                seat.get("floor"),
                f"{seat.get('section')}구역" if seat.get("section") else None,
                f"{seat.get('row')}열" if seat.get("row") else None,
                f"{seat.get('number')}번" if seat.get("number") else None,
            ]
            if value
        ),
        ratings=review.get("ratings", {}),
        tags=tags,
        content=review.get("content", "")[:220],
    )
