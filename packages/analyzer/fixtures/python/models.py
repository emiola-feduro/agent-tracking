"""Domain models."""
from __future__ import annotations

import os.path as osp
from dataclasses import dataclass
from .base import Base

MAX_ITEMS: int = 100
_private_value = 1
default_name = "x"

type Price = float


@dataclass
class Item(Base):
    name: str

    def total(self, qty: int) -> float:
        return qty

    @staticmethod
    async def fetch() -> "Item":
        ...

    def _internal(self):
        pass


def make_item(name: str) -> Item:
    return Item(name)


async def _load():
    pass
