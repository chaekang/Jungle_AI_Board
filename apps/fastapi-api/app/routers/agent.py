from fastapi import APIRouter, Request

from app.schemas.agent import SeatRecommendationRequest, SeatRecommendationResponse
from app.services.seat_agent_service import recommend_seat

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/seat-recommendations", response_model=SeatRecommendationResponse)
def seat_recommendations(payload: SeatRecommendationRequest, http_request: Request):
    forwarded_for = http_request.headers.get("x-forwarded-for")
    if not forwarded_for and http_request.client:
        forwarded_for = http_request.client.host
    return recommend_seat(payload, client_ip=forwarded_for)
