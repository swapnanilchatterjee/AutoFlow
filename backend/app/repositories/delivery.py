"""Data access for the delivery log."""
from __future__ import annotations

from app.models.delivery import Delivery
from app.repositories.base import BaseRepository


class DeliveryRepository(BaseRepository[Delivery]):
    model = Delivery
