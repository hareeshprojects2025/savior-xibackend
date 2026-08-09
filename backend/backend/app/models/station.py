from sqlalchemy import Column, Integer, String, Float, Text

from app.core.database import Base


class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # "police", "fire", "medical"
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(Text, nullable=False)
    phone = Column(String(50), nullable=True)

    def __repr__(self) -> str:
        return f"<Station(id={self.id}, name='{self.name}', type='{self.type}')>"
