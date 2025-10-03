from pathlib import Path

import pytest

from extension.diff_manager import DiffManager


def test_save_and_load_diff(tmp_path: Path):
    manager = DiffManager(tmp_path)

    filename = manager.save_diff("Test Diff", {"nodes": [1, 2, 3]})

    saved_file = tmp_path / filename
    assert saved_file.exists(), "Saved diff file should exist on disk"

    loaded = manager.load_diff(filename)
    assert loaded == {"nodes": [1, 2, 3]}

    listed = manager.list_diffs()
    assert listed[0]["filename"] == filename
    assert listed[0]["name"] == "Test Diff"


def test_save_diff_rejects_blank_name(tmp_path: Path):
    manager = DiffManager(tmp_path)

    with pytest.raises(ValueError):
        manager.save_diff("   ", {"foo": "bar"})


def test_list_diffs_skips_corrupt_files(tmp_path: Path):
    manager = DiffManager(tmp_path)
    filename = manager.save_diff("Valid", {"ok": True})

    corrupt_path = tmp_path / "corrupt.json"
    corrupt_path.write_text("not-json", encoding="utf-8")

    listed = manager.list_diffs()
    filenames = [entry["filename"] for entry in listed]
    assert filename in filenames
    assert "corrupt.json" not in filenames


def test_delete_diff(tmp_path: Path):
    manager = DiffManager(tmp_path)
    filename = manager.save_diff("To Delete", {})

    assert manager.delete_diff(filename) is True
    assert not (tmp_path / filename).exists()
    assert manager.delete_diff("missing.json") is False
