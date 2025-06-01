import json
import os
import time
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class DiffManager:
    """Manages saving, loading, and listing of diff files."""

    def __init__(self, diffs_dir: Optional[Path] = None):
        if diffs_dir is None:
            # Default to a 'diffs' subdirectory in the extension root
            self.diffs_dir = Path(__file__).parent / "data" / "diffs"
        else:
            self.diffs_dir = diffs_dir

        # Ensure the directory exists
        self.diffs_dir.mkdir(parents=True, exist_ok=True)

    def save_diff(self, name: str, diff_data: Dict[str, Any]) -> str:
        """
        Save a diff with the given name.
        Returns the filename of the saved diff.
        """
        if not name.strip():
            raise ValueError("Name cannot be empty")

        # Create a safe filename
        safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_name = safe_name.replace(' ', '_')

        timestamp = int(time.time())
        filename = f"{safe_name}_{timestamp}.json"
        filepath = self.diffs_dir / filename

        # Prepare the data to save
        save_data = {
            "name": name,
            "created": timestamp,
            "diff": diff_data
        }

        # Save to file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(save_data, f, indent=2)

        return filename

    def load_diff(self, filename: str) -> Dict[str, Any]:
        """Load a diff by filename."""
        filepath = self.diffs_dir / filename

        if not filepath.exists():
            raise FileNotFoundError(f"Diff file not found: {filename}")

        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return data.get("diff", {})

    def list_diffs(self) -> List[Dict[str, Any]]:
        """List all available diffs."""
        diffs = []

        for filepath in self.diffs_dir.glob("*.json"):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                diffs.append({
                    "filename": filepath.name,
                    "name": data.get("name", filepath.stem),
                    "created": data.get("created", filepath.stat().st_mtime)
                })
            except (json.JSONDecodeError, IOError) as e:
                # Skip corrupted files
                logger.warning(f"Warning: Could not read diff file {filepath}: {e}")
                continue

        # Sort by creation time, newest first
        diffs.sort(key=lambda x: x["created"], reverse=True)
        return diffs

    def delete_diff(self, filename: str) -> bool:
        """Delete a diff by filename. Returns True if successful."""
        filepath = self.diffs_dir / filename

        if not filepath.exists():
            return False

        try:
            filepath.unlink()
            return True
        except OSError:
            return False
