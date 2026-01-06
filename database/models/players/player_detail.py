from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, PrimaryKeyConstraint, ForeignKeyConstraint
from sqlalchemy.orm import relationship
from database.models.base import Base
import datetime

class PlayerDetail(Base):
    __tablename__ = "player_details"

    player_uuid = Column(String, nullable=False)
    server_id = Column(Integer, nullable=False)
    
    total_playtime_seconds = Column(Integer, default=0)
    last_joined_at = Column(DateTime)
    last_ip = Column(String, nullable=True)
    
    # Expanded stats from NBT data
    health = Column(Integer, default=20)
    xp_level = Column(Integer, default=0)
    position_x = Column(Integer, default=0)
    position_y = Column(Integer, default=0)
    position_z = Column(Integer, default=0)
    
    
    # Composite Primary Key to match Player
    # We use explicit ForeignKeyConstraint for robustness with composite keys
    __table_args__ = (
        PrimaryKeyConstraint('player_uuid', 'server_id'),
        ForeignKeyConstraint(
            ['player_uuid', 'server_id'],
            ['players.uuid', 'players.server_id'],
            name='fk_player_details_player'
        ),
    )

    player = relationship("Player", back_populates="detail")
