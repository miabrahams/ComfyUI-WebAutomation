from pathlib import Path

import pytest

from extension.remap_manager import RemapManager


def test_save_and_load_remaps(tmp_path: Path):
    manager = RemapManager(tmp_path)

    payload = [{"source": 1, "target": 2}]
    filename = manager.save_remaps("Test Remap", payload)

    saved_file = tmp_path / filename
    assert saved_file.exists()

    loaded = manager.load_remaps(filename)
    assert loaded == payload

    listed = manager.list_remaps()
    assert listed[0]["filename"] == filename
    assert listed[0]["count"] == 1


def test_save_remaps_requires_name(tmp_path: Path):
    manager = RemapManager(tmp_path)

    with pytest.raises(ValueError):
        manager.save_remaps("", [])


def test_delete_remaps(tmp_path: Path):
    manager = RemapManager(tmp_path)
    filename = manager.save_remaps("Delete Me", [])

    assert manager.delete_remaps(filename) is True
    assert not (tmp_path / filename).exists()
    assert manager.delete_remaps("missing.json") is False
