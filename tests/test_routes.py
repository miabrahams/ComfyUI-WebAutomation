import asyncio
import json
from typing import Any, Dict

import pytest
from aiohttp import web
from multidict import MultiDict, MultiDictProxy

from extension import routes
from extension.diff_manager import DiffManager
from extension.remap_manager import RemapManager


class DummyRequest:
    def __init__(
        self,
        method: str = "GET",
        query: Dict[str, Any] | None = None,
        json_data: Dict[str, Any] | None = None,
        match_info: Dict[str, Any] | None = None,
    ) -> None:
        self.method = method
        self.query = MultiDictProxy(MultiDict(query or {}))
        self._json = json_data
        self.match_info = match_info or {}

    async def json(self) -> Dict[str, Any]:
        if self._json is None:
            raise ValueError("No JSON payload provided")
        return self._json


def decode_response(response: web.Response) -> Dict[str, Any]:
    assert response.content_type == "application/json"
    assert response.body is not None
    return json.loads(response.body.decode())


def run_sync(coro):
    return asyncio.run(coro)


@pytest.mark.asyncio
async def test_list_data_folders_creates_directory(tmp_path, monkeypatch):
    monkeypatch.setattr(routes, "get_parent_path", lambda: tmp_path)

    request = DummyRequest(query={"type": "evals"})
    response = await routes.list_data_folders(request)

    assert (tmp_path / "data" / "evals").exists()
    assert decode_response(response) == {"folders": []}


@pytest.mark.asyncio
async def test_list_images_returns_only_supported_types(tmp_path, monkeypatch):
    monkeypatch.setattr(routes, "get_parent_path", lambda: tmp_path)

    folder = tmp_path / "data" / "evals" / "sample"
    folder.mkdir(parents=True)
    (folder / "image.png").write_bytes(b"fakepng")
    (folder / "note.txt").write_text("skip")

    request = DummyRequest(query={"type": "evals", "folder": "sample"})
    response = await routes.list_images(request)
    payload = decode_response(response)

    assert payload == {
        "images": [
            {
                "filename": "image.png",
                "url": "/rebase/data/view?type=evals&folder=sample&filename=image.png",
            }
        ]
    }


@pytest.mark.asyncio
async def test_view_file_returns_binary_contents(tmp_path, monkeypatch):
    monkeypatch.setattr(routes, "get_parent_path", lambda: tmp_path)

    folder = tmp_path / "data" / "evals" / "sample"
    folder.mkdir(parents=True)
    (folder / "image.png").write_bytes(b"fakepng")

    request = DummyRequest(query={"type": "evals", "folder": "sample", "filename": "image.png"})
    response = await routes.view_file(request)

    assert response.status == 200
    assert response.content_type == "image/png"
    assert response.body == b"fakepng"


@pytest.mark.asyncio
async def test_save_and_load_diff_route(tmp_path, monkeypatch):
    manager = DiffManager(tmp_path)
    monkeypatch.setattr(routes, "diff_manager", manager)

    save_request = DummyRequest(
        method="POST",
        json_data={"name": "Route Diff", "diff": {"value": 1}},
    )
    save_response = await routes.save_diff_route(save_request)
    filename = decode_response(save_response)["filename"]

    load_request = DummyRequest(match_info={"filename": filename})
    load_response = await routes.load_diff_route(load_request)
    assert decode_response(load_response) == {"diff": {"value": 1}}


@pytest.mark.asyncio
async def test_save_and_list_remaps_route(tmp_path, monkeypatch):
    manager = RemapManager(tmp_path)
    monkeypatch.setattr(routes, "remap_manager", manager)

    save_request = DummyRequest(
        method="POST",
        json_data={"name": "Sample Remap", "remaps": [{"field": "value"}]},
    )
    save_response = await routes.save_remaps_route(save_request)
    filename = decode_response(save_response)["filename"]

    list_request = DummyRequest()
    list_response = await routes.list_remaps_route(list_request)
    payload = decode_response(list_response)

    assert payload["remaps"][0]["filename"] == filename
    assert payload["remaps"][0]["count"] == 1
