import json
import time
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class RemapManager:
    """Manages saving, loading, and listing of field remap configurations."""

    def __init__(self, remaps_dir: Optional[Path] = None):
        if remaps_dir is None:
            # Default to a 'remaps' subdirectory in the extension root
            self.remaps_dir = Path(__file__).parent.parent / "data" / "remaps"
        else:
            self.remaps_dir = remaps_dir

        # Ensure the directory exists
        self.remaps_dir.mkdir(parents=True, exist_ok=True)

    def save_remaps(self, name: str, remaps_data: List[Dict[str, Any]]) -> str:
        """
        Save remaps with the given name.
        Returns the filename of the saved remaps.
        """
        if not name.strip():
            raise ValueError("Name cannot be empty")

        # Create a safe filename
        safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_name = safe_name.replace(' ', '_')

        timestamp = int(time.time())
        filename = f"{safe_name}_{timestamp}.json"
        filepath = self.remaps_dir / filename

        # Prepare the data to save
        save_data = {
            "name": name,
            "created": timestamp,
            "remaps": remaps_data
        }

        # Save to file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(save_data, f, indent=2)

        return filename

    def load_remaps(self, filename: str) -> List[Dict[str, Any]]:
        """Load remaps by filename."""
        filepath = self.remaps_dir / filename

        if not filepath.exists():
            raise FileNotFoundError(f"Remap file not found: {filename}")

        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return data.get("remaps", [])

    def list_remaps(self) -> List[Dict[str, Any]]:
        """List all available remap configurations."""
        remaps = []

        for filepath in self.remaps_dir.glob("*.json"):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                remaps.append({
                    "filename": filepath.name,
                    "name": data.get("name", filepath.stem),
                    "created": data.get("created", filepath.stat().st_mtime),
                    "count": len(data.get("remaps", []))
                })
            except (json.JSONDecodeError, IOError) as e:
                # Skip corrupted files
                logger.warning(f"Warning: Could not read remap file {filepath}: {e}")
                continue

        # Sort by creation time, newest first
        remaps.sort(key=lambda x: x["created"], reverse=True)
        return remaps

    def delete_remaps(self, filename: str) -> bool:
        """Delete remaps by filename. Returns True if successful."""
        filepath = self.remaps_dir / filename

        if not filepath.exists():
            return False

        try:
            filepath.unlink()
            return True
        except OSError:
            return False
