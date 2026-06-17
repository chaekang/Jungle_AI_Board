from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class ExternalMusicalProduction:
    musical_title: str
    theater_name: str
    started_on: date
    ended_on: date | None
    source: str
    selection_status: str = "unknown"
    source_url: str | None = None

    def with_selection_status(self, selection_status: str) -> ExternalMusicalProduction:
        return ExternalMusicalProduction(
            musical_title=self.musical_title,
            theater_name=self.theater_name,
            started_on=self.started_on,
            ended_on=self.ended_on,
            source=self.source,
            selection_status=selection_status,
            source_url=self.source_url,
        )


EXTERNAL_MUSICAL_PRODUCTIONS: tuple[ExternalMusicalProduction, ...] = (
    ExternalMusicalProduction(
        musical_title="시카고",
        theater_name="블루스퀘어 신한카드홀",
        started_on=date(2024, 6, 7),
        ended_on=date(2024, 9, 29),
        source="external-musical-metadata",
    ),
    ExternalMusicalProduction(
        musical_title="시카고",
        theater_name="디큐브 링크아트센터",
        started_on=date(2026, 5, 1),
        ended_on=date(2026, 8, 31),
        source="external-musical-metadata",
    ),
    ExternalMusicalProduction(
        musical_title="오페라의 유령",
        theater_name="블루스퀘어 신한카드홀",
        started_on=date(2023, 7, 21),
        ended_on=date(2023, 11, 17),
        source="external-musical-metadata",
    ),
)

EXTERNAL_MUSICAL_ALIASES = {
    "chicago": "시카고",
    "시카고": "시카고",
    "오페라의유령": "오페라의 유령",
    "오페라의 유령": "오페라의 유령",
    "phantom": "오페라의 유령",
    "phantomoftheopera": "오페라의 유령",
}


def lookup_external_musical_production(
    query: str | None,
    reference_date: date | None = None,
) -> ExternalMusicalProduction | None:
    if not query:
        return None

    today = reference_date or date.today()
    normalized_query = _normalize(query)
    title = _match_external_title(normalized_query)
    if title is None:
        return None

    productions = [
        production
        for production in EXTERNAL_MUSICAL_PRODUCTIONS
        if production.musical_title == title
    ]
    current_productions = [
        production
        for production in productions
        if production.started_on <= today and (production.ended_on is None or today <= production.ended_on)
    ]
    if current_productions:
        return max(current_productions, key=lambda production: production.started_on).with_selection_status("current")

    ended_productions = [
        production
        for production in productions
        if production.ended_on is not None and production.ended_on < today
    ]
    if ended_productions:
        return max(
            ended_productions,
            key=lambda production: (production.ended_on or date.min, production.started_on),
        ).with_selection_status("most_recent")

    return None


def _match_external_title(normalized_query: str) -> str | None:
    for alias, title in sorted(EXTERNAL_MUSICAL_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
        if _normalize(alias) in normalized_query:
            return title

    for production in EXTERNAL_MUSICAL_PRODUCTIONS:
        if _normalize(production.musical_title) in normalized_query:
            return production.musical_title

    return None


def _normalize(value: str) -> str:
    return "".join(value.lower().split())
