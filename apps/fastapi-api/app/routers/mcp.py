from fastapi import APIRouter, HTTPException, Query

from app.schemas.mcp import (
    CacheRefreshResponse,
    ExternalMusicalProductionResponse,
    SeatLayoutResponse,
)
from app.services.external_musical_metadata_service import lookup_external_musical_production
from app.services.seat_metadata_service import get_seat_layout, refresh_cache

router = APIRouter(prefix="/mcp", tags=["mcp"])


@router.get("/seat-layouts/{theater_name}", response_model=SeatLayoutResponse)
def seat_layout(
    theater_name: str,
    simulate_failure: bool = Query(default=False, alias="simulateFailure"),
):
    return get_seat_layout(theater_name, simulate_failure=simulate_failure)


@router.get("/musical-productions/{musical_title}", response_model=ExternalMusicalProductionResponse)
def musical_production(musical_title: str):
    production = lookup_external_musical_production(musical_title)
    if production is None:
        raise HTTPException(status_code=404, detail="External musical production not found")

    return ExternalMusicalProductionResponse(
        musicalTitle=production.musical_title,
        theaterName=production.theater_name,
        startedOn=production.started_on,
        endedOn=production.ended_on,
        selectionStatus=production.selection_status,
        source=production.source,
        sourceUrl=production.source_url,
    )


@router.post("/cache/refresh", response_model=CacheRefreshResponse)
def refresh_mcp_cache():
    return CacheRefreshResponse(refreshed=True, clearedKeys=refresh_cache())
