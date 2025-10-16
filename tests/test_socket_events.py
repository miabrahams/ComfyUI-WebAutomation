import sys
import json
import types
import importlib
import builtins

import pytest


@pytest.mark.asyncio
async def test_forward_reset_request_loads_template_and_sends(tmp_path, monkeypatch):
    # Prepare a fake JSON template file
    template_data = {"hello": "world", "n": 42}
    template_str = json.dumps(template_data)
    tmp_template = tmp_path / "workflowTemplate.json"
    tmp_template.write_text(template_str, encoding="utf-8")

    # Stub the ComfyUI server module to capture websocket sends
    class DummyPromptServer:
        def __init__(self):
            self.sent = []

        async def send_json(self, event, data):
            self.sent.append((event, data))

    server_stub = types.SimpleNamespace(
        PromptServer=types.SimpleNamespace(instance=DummyPromptServer())
    )
    monkeypatch.setitem(sys.modules, "server", server_stub)

    # Patch open() so socket_events reads from our data dir file path
    real_open = builtins.open
    opened_paths: list[str] = []

    def fake_open(path, mode="r", *args, **kwargs):
        p = str(path)
        opened_paths.append(p)
        # Redirect the module's ../data/workflowTemplate.json to our temp file
        if p.endswith("../data/workflowTemplate.json") or p.endswith("data/workflowTemplate.json"):
            return real_open(tmp_template, mode, *args, **kwargs)
        return real_open(path, mode, *args, **kwargs)

    monkeypatch.setattr(builtins, "open", fake_open)

    # Import fresh to trigger file load at module import time
    sys.modules.pop("extension.socket_events", None)
    import extension.socket_events as se
    importlib.reload(se)

    # Invoke the handler
    class DummyRequest:
        pass

    resp = await se.forward_reset_request(DummyRequest())
    assert resp.status == 200
    assert resp.body is not None
    payload = json.loads(resp.body.decode())
    assert payload == {"success": True}

    # Assert the websocket event was sent with the JSON read from file
    sent = server_stub.PromptServer.instance.sent
    assert len(sent) == 1
    event, data = sent[0]
    assert event == "load_graph" # translated event type
    assert data == template_str  # sent as the raw JSON string

    # Sanity check that the module attempted to read the expected data path
    assert any("data/workflowTemplate.json" in p for p in opened_paths)
