from fastapi import APIRouter, Depends
from app.routers.users import get_current_user
from app.models import User

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/positions")
async def get_positions(current_user: User = Depends(get_current_user)):
    try:
        from app.services.alpaca import get_client
        client = get_client()
        positions = client.get_all_positions()
        return [
            {
                "symbol": p.symbol,
                "qty": float(p.qty),
                "avg_entry_price": float(p.avg_entry_price),
                "current_price": float(p.current_price),
                "unrealized_pl": float(p.unrealized_pl),
                "unrealized_plpc": round(float(p.unrealized_plpc) * 100, 2),
                "market_value": float(p.market_value),
                "side": str(p.side),
            }
            for p in positions
        ]
    except RuntimeError:
        # Alpaca keys not configured
        return []
    except Exception:
        return []
