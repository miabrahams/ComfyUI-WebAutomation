import sys
import types
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class _DummyPromptServer:
    def __init__(self) -> None:
        self.sent = []
        self.app = types.SimpleNamespace(add_subapp=lambda *args, **kwargs: None)

    async def send_json(self, event, data):
        self.sent.append((event, data))


dummy_server = _DummyPromptServer()

sys.modules.setdefault(
    "server",
    types.SimpleNamespace(PromptServer=types.SimpleNamespace(instance=dummy_server)),
)
