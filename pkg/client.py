from __future__ import annotations

import logging
from dataclasses import dataclass, asdict, is_dataclass
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)


class RebaseClientError(Exception):
    """Raised when the Rebase client fails to send or parse a request."""


def _drop_none(obj: Any) -> Any:
    """Recursively drop None values from dataclass/dict structures."""
    if is_dataclass(obj) and not isinstance(obj, type):
        return _drop_none(asdict(obj))
    if isinstance(obj, dict):
        return {k: _drop_none(v) for k, v in obj.items() if v is not None}
    if isinstance(obj, (list, tuple)):
        return type(obj)(_drop_none(v) for v in obj if v is not None)
    return obj

@dataclass
class Resolution:
    width: int
    height: int


@dataclass
class Sampler:
    steps: Optional[int] = None
    cfg: Optional[float] = None
    sampler_name: Optional[str] = None
    scheduler: Optional[str] = None


@dataclass
class IPAdapter:
    image: Optional[str] = None  # path
    weight: Optional[float] = None # 0-1
    enabled: Optional[bool] = None


@dataclass
class PromptReplaceDetail:
    positive_prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    resolution: Optional[Resolution] = None
    loras: Optional[str] = None
    sampler: Optional[Sampler] = None
    name: Optional[str] = None
    rescaleCfg: Optional[bool] = None
    perpNeg: Optional[bool] = None
    ipAdapter: Optional[IPAdapter] = None

    def to_wire(self) -> Dict[str, Any]:
        """
        Convert to a dict matching the frontend's expected shape,
        excluding any keys that are None.
        """
        return _drop_none(self)


class RebaseClient:
    """
    Minimal client for the Rebase endpoints.

    Endpoints:
      - POST {base_url}/rebase/forward  (event fanout to websocket)
      - POST {base_url}/rebase/reset    (load base workflow template)

    Events supported by /rebase/forward:
      - 'prompt_replace': data := PromptReplaceDetail
      - 'generate':       data := {'count': int in [1, 8]}
    """

    def __init__(self, base_url: str = "http://localhost:8191", timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._session = requests.Session()

    # ----- Low-level -----

    def _post_json(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            resp = self._session.post(url, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            # backend returns {'success': True} or {'error': ...}
            try:
                return resp.json()
            except ValueError:
                raise RebaseClientError(f"Non-JSON response from {url}: {resp.text[:200]}")
        except requests.RequestException as e:
            raise RebaseClientError(f"POST {url} failed: {e}") from e

    # ----- High-level convenience -----

    def prompt_replace(
        self,
        detail: PromptReplaceDetail | Dict[str, Any] = PromptReplaceDetail(),
    ) -> Dict[str, Any]:
        """
        Send a 'prompt_replace' event.
        """
        data = detail.to_wire() if isinstance(detail, PromptReplaceDetail) else _drop_none(detail)
        payload = {"event": "prompt_replace", "data": data}
        return self._post_json("/rebase/forward", payload)

    def generate(self, count: int) -> Dict[str, Any]:
        """
        Send a 'generate' event.
        """
        if not isinstance(count, int) or count < 1 or count > 8:
            raise ValueError("count must be an integer between 1 and 8")
        payload = {"event": "generate", "data": {"count": count}}
        return self._post_json("/rebase/forward", payload)

    def reset(self) -> Dict[str, Any]:
        """Trigger the special reset route (sends a 'load_graph' event with a base template)."""
        return self._post_json("/rebase/reset", {})
