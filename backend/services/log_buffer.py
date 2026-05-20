import collections
import logging
import threading
import time
from typing import TypedDict


class LogEntry(TypedDict):
    id: int
    ts: float
    level: str
    logger: str
    message: str


class _RingHandler(logging.Handler):
    def __init__(self, maxlen: int = 500):
        super().__init__()
        self._buf: collections.deque[LogEntry] = collections.deque(maxlen=maxlen)
        self._lock = threading.Lock()
        self._seq = 0

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = self.format(record)
        except Exception:
            msg = record.getMessage()
        with self._lock:
            self._seq += 1
            self._buf.append(
                LogEntry(
                    id=self._seq,
                    ts=record.created,
                    level=record.levelname,
                    logger=record.name,
                    message=msg,
                )
            )

    def since(self, after_id: int = 0) -> list[LogEntry]:
        with self._lock:
            return [e for e in self._buf if e["id"] > after_id]


_handler = _RingHandler(maxlen=500)
_handler.setLevel(logging.DEBUG)
_handler.setFormatter(logging.Formatter("%(message)s"))


def install(level: int = logging.INFO) -> None:
    root = logging.getLogger()
    if _handler not in root.handlers:
        root.addHandler(_handler)
    root.setLevel(level)


def get_entries(after_id: int = 0) -> list[LogEntry]:
    return _handler.since(after_id)
