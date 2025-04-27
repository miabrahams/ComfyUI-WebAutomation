from aiohttp import web
import os
from pathlib import Path
import json

def get_parent_path():
    """Get the ComfyUI-SearchReplace root directory"""
    return Path(__file__).parent

def get_data_path(folder_type="evals"):
    """Get the data directory with optional subfolder"""
    return get_parent_path() / "data" / folder_type

def get_target_folder_files(folder, folder_type="evals", filter_ext=None):
    """List files in a specific folder with optional extension filtering"""
    target = get_data_path(folder_type) / folder
    if not target.exists() or not target.is_dir():
        return None

    files = [f.name for f in target.iterdir() if f.is_file()]
    if filter_ext:
        if isinstance(filter_ext, str):
            filter_ext = (filter_ext,)
        files = [f for f in files if any(f.lower().endswith(ext) for ext in filter_ext)]
    return sorted(files)

async def list_data_folders(request):
    """List available evaluation folders"""
    folder_type = request.query.get("type", "evals")
    base_path = get_data_path(folder_type)

    if not base_path.exists():
        # Create directory if it doesn't exist
        base_path.mkdir(parents=True, exist_ok=True)
        return web.json_response({"folders": []})

    folders = [d.name for d in base_path.iterdir() if d.is_dir()]
    return web.json_response({"folders": sorted(folders)})

async def list_images(request):
    """List images in a specific folder with metadata"""
    folder_type = request.query.get("type", "evals")
    folder = request.query.get("folder", "")

    if not folder:
        return web.json_response({"images": []})

    files = get_target_folder_files(folder, folder_type, filter_ext=(".png", ".jpg", ".jpeg", ".webp"))
    if files is None:
        raise web.HTTPNotFound(text=f"Folder '{folder}' not found")

    images = []
    for filename in files:
        # Check for associated workflow json
        # Build API URL for retrieving this file
        url = f"/rebase/data/view?type={folder_type}&folder={folder}&filename={filename}"

        images.append({
            "filename": filename,
            "url": url
        })

    return web.json_response({"images": images})

async def view_file(request):
    """Return file contents (image or JSON)"""
    folder_type = request.query.get("type", "evals")
    folder = request.query.get("folder", "")
    filename = request.query.get("filename")

    if not filename or not folder:
        raise web.HTTPBadRequest(text="Missing required parameters")

    # Build full path
    file_path = get_data_path(folder_type) / folder / filename

    if not file_path.exists():
        raise web.HTTPNotFound(text=f"File not found: {filename}")

    # Read file
    with open(file_path, "rb") as f:
        data = f.read()

    # Set content type based on extension
    ext = os.path.splitext(filename)[1].lower()
    content_type = "application/json"
    if ext in (".png", ".jpg", ".jpeg", ".webp"):
        content_type = f"image/{ext[1:]}"

    return web.Response(body=data, content_type=content_type)
