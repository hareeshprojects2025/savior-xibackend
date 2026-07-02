# from fastapi import APIRouter, Depends
# from sqlalchemy.orm import Session

# from app.database import get_db
# from app.schemas import EmergencyCreate, EmergencyResponse
# from app.crud import create_emergency

# router = APIRouter(prefix="/api", tags=["Emergency"])


# @router.post("/emergency", response_model=EmergencyResponse)
# def report_emergency(data: EmergencyCreate, db: Session = Depends(get_db)):
#     """Receive emergency data from Bolna AI and store it in MySQL."""
#     try:
#         create_emergency(db, data)
#         return {"status": "success", "message": "Emergency recorded successfully."}
#     except Exception as e:
#         return {"status": "error", "message": f"Failed to record emergency: {str(e)}"}





# from fastapi import APIRouter, Depends, Request
# from sqlalchemy.orm import Session

# from app.database import get_db

# router = APIRouter(prefix="/api", tags=["Emergency"])


# @router.post("/emergency")
# async def report_emergency(
#     request: Request,
#     db: Session = Depends(get_db)
# ):
#     body = await request.json()
#     print("\n========================")
#     print("Bolna Payload:")
#     print(body)
#     print("========================\n")

#     return {
#         "status": "received"
#     }








# from fastapi import APIRouter, Request

# router = APIRouter(prefix="/api", tags=["Emergency"])


# @router.post("/emergency")
# async def report_emergency(request: Request):

#     print("\n========== HEADERS ==========")
#     print(dict(request.headers))

#     body = await request.body()

#     print("\n========== RAW BODY ==========")
#     print(body)

#     print("=============================\n")

#     return {"status": "received"}




from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import EmergencyCreate, EmergencyResponse
from app.crud import create_emergency

router = APIRouter(prefix="/api", tags=["Emergency"])


@router.post("/emergency", response_model=EmergencyResponse)
def report_emergency(data: EmergencyCreate, db: Session = Depends(get_db)):
    create_emergency(db, data)
    return {
        "status": "success",
        "message": "Emergency recorded successfully."
    }



