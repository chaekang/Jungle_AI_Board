from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Priority = Literal[
    "view",
    "sound",
    "comfort",
    "expression",
    "stageVisibility",
    "lowObstruction",
]


class SeatCandidateRequest(BaseModel):
    floor: str = Field(min_length=1)
    section: str | None = None
    row: str = Field(min_length=1)
    seat_number: str = Field(alias="seatNumber", min_length=1)

    @field_validator("floor", "section", "row", "seat_number", mode="before")
    @classmethod
    def strip_seat_parts(cls, value):
        return value.strip() if isinstance(value, str) else value

    model_config = {"populate_by_name": True}


class SeatRecommendationRequest(BaseModel):
    question: str = Field(min_length=2)
    theater_name: str | None = Field(default=None, alias="theaterName")
    musical_title: str | None = Field(default=None, alias="musicalTitle")
    season_label: str | None = Field(default=None, alias="seasonLabel")
    priorities: list[Priority] = Field(default_factory=list)
    candidates: list[SeatCandidateRequest] = Field(default_factory=list, max_length=3)
    budget: int | None = None
    limit: int = Field(default=5, ge=1, le=10)
    use_rag: bool = Field(default=True, alias="useRag")

    @model_validator(mode="after")
    def validate_comparison_candidates(self):
        if not self.candidates:
            return self
        if len(self.candidates) < 2:
            raise ValueError("candidates must contain at least two seats")
        keys = {
            tuple(
                "".join((part or "").split()).upper()
                for part in (
                    candidate.floor,
                    candidate.section,
                    candidate.row,
                    candidate.seat_number,
                )
            )
            for candidate in self.candidates
        }
        if len(keys) != len(self.candidates):
            raise ValueError("candidates must contain unique seats")
        return self

    model_config = {"populate_by_name": True}


class AgentFilters(BaseModel):
    theater_name: str | None = Field(default=None, alias="theaterName")
    musical_title: str | None = Field(default=None, alias="musicalTitle")
    season_label: str | None = Field(default=None, alias="seasonLabel")
    seat_floor: str | None = Field(default=None, alias="seatFloor")
    seat_section: str | None = Field(default=None, alias="seatSection")
    seat_row: str | None = Field(default=None, alias="seatRow")
    seat_number: str | None = Field(default=None, alias="seatNumber")
    side: Literal["left", "center", "right", "side"] | None = None
    center_core: bool = Field(default=False, alias="centerCore")
    aisle_block: Literal["left", "center", "right", "side"] | None = Field(
        default=None,
        alias="aisleBlock",
    )
    aisle_offset: int | None = Field(default=None, alias="aisleOffset")
    priorities: list[Priority]
    budget: int | None = None

    model_config = {"populate_by_name": True}


class EvidenceReview(BaseModel):
    id: str
    theater_name: str = Field(alias="theaterName")
    musical_title: str = Field(alias="musicalTitle")
    season_label: str | None = Field(default=None, alias="seasonLabel")
    seat: str
    ratings: dict[str, int]
    tags: list[str]
    content: str

    model_config = {"populate_by_name": True}


class SeatRecommendationResponse(BaseModel):
    recommendation: str
    official_section: str | None = Field(default=None, alias="officialSection")
    descriptive_block: str | None = Field(default=None, alias="descriptiveBlock")
    direction: str
    reasons: list[str]
    cautions: list[str]
    evidence_reviews: list[EvidenceReview] = Field(alias="evidenceReviews")
    filters: AgentFilters
    mcp_status: str = Field(alias="mcpStatus")
    rag_status: str = Field(alias="ragStatus")
    rag_answer: str | None = Field(default=None, alias="ragAnswer")

    model_config = {"populate_by_name": True}
