from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from database.models.base import Base
import datetime

class Player(Base):
    __tablename__ = "players"

    uuid = Column(String, primary_key=True) # UUID is unique globally for a player
    server_id = Column(Integer, ForeignKey("servers.id"), primary_key=True) # Composite PK: Player per Server
    
    name = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    # Relationships
    detail = relationship("PlayerDetail", uselist=False, back_populates="player", cascade="all, delete-orphan")
    stats = relationship("PlayerStat", back_populates="player", cascade="all, delete-orphan")
    bans = relationship("PlayerBan", back_populates="player", cascade="all, delete-orphan")
    achievements = relationship("PlayerAchievement", back_populates="player", cascade="all, delete-orphan")
