from datetime import date

from app.services.external_musical_metadata_service import lookup_external_musical_production


def test_lookup_prefers_current_production_when_running():
    production = lookup_external_musical_production(
        "시카고 보려고 하는데 2층 괜찮을까?",
        reference_date=date(2026, 6, 17),
    )

    assert production is not None
    assert production.musical_title == "시카고"
    assert production.theater_name == "디큐브 링크아트센터"
    assert production.selection_status == "current"


def test_lookup_falls_back_to_most_recent_production_when_not_running():
    production = lookup_external_musical_production(
        "시카고 2층 시야 어때?",
        reference_date=date(2026, 12, 31),
    )

    assert production is not None
    assert production.musical_title == "시카고"
    assert production.theater_name == "디큐브 링크아트센터"
    assert production.selection_status == "most_recent"
