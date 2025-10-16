from aiohttp import web
import os
from pathlib import Path
from .diff_manager import DiffManager
from .remap_manager import RemapManager
import server

def get_parent_path():
    """Get the ComfyUI-SearchReplace root directory"""
    return Path(__file__).parent.parent

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

diff_manager = DiffManager()
remap_manager = RemapManager()

async def save_diff_route(request):
    """Save a diff with a given name."""
    try:
        data = await request.json()
        name = data.get('name', '').strip()
        diff_data = data.get('diff', {})

        if not name:
            return web.json_response({'error': 'Name is required'}, status=400)

        if not diff_data:
            return web.json_response({'error': 'Diff data is required'}, status=400)

        filename = diff_manager.save_diff(name, diff_data)
        return web.json_response({'success': True, 'filename': filename})

    except ValueError as e:
        return web.json_response({'error': str(e)}, status=400)
    except Exception as e:
        return web.json_response({'error': f'Failed to save diff: {str(e)}'}, status=500)

async def list_diffs_route(request):
    """List all saved diffs."""
    try:
        diffs = diff_manager.list_diffs()
        return web.json_response({'diffs': diffs})
    except Exception as e:
        return web.json_response({'error': f'Failed to list diffs: {str(e)}'}, status=500)

async def load_diff_route(request):
    """Load a specific diff."""
    try:
        filename = request.match_info['filename']
        diff_data = diff_manager.load_diff(filename)
        return web.json_response({'diff': diff_data})
    except FileNotFoundError:
        return web.json_response({'error': 'Diff not found'}, status=404)
    except Exception as e:
        return web.json_response({'error': f'Failed to load diff: {str(e)}'}, status=500)

async def delete_diff_route(request):
    """Delete a diff."""
    try:
        filename = request.match_info['filename']
        success = diff_manager.delete_diff(filename)
        if success:
            return web.json_response({'success': True})
        else:
            return web.json_response({'error': 'Diff not found'}, status=404)
    except Exception as e:
        return web.json_response({'error': f'Failed to delete diff: {str(e)}'}, status=500)

# Remap management routes
async def save_remaps_route(request):
    """Save remaps with a given name."""
    try:
        data = await request.json()
        name = data.get('name', '').strip()
        remaps_data = data.get('remaps', [])

        if not name:
            return web.json_response({'error': 'Name is required'}, status=400)

        if not remaps_data:
            return web.json_response({'error': 'Remaps data is required'}, status=400)

        filename = remap_manager.save_remaps(name, remaps_data)
        return web.json_response({'success': True, 'filename': filename})

    except ValueError as e:
        return web.json_response({'error': str(e)}, status=400)
    except Exception as e:
        return web.json_response({'error': f'Failed to save remaps: {str(e)}'}, status=500)

async def list_remaps_route(request):
    """List all saved remap configurations."""
    try:
        remaps = remap_manager.list_remaps()
        return web.json_response({'remaps': remaps})
    except Exception as e:
        return web.json_response({'error': f'Failed to list remaps: {str(e)}'}, status=500)

async def load_remaps_route(request):
    """Load a specific remap configuration."""
    try:
        filename = request.match_info['filename']
        remaps_data = remap_manager.load_remaps(filename)
        return web.json_response({'remaps': remaps_data})
    except FileNotFoundError:
        return web.json_response({'error': 'Remaps not found'}, status=404)
    except Exception as e:
        return web.json_response({'error': f'Failed to load remaps: {str(e)}'}, status=500)

async def delete_remaps_route(request):
    """Delete a remap configuration."""
    try:
        filename = request.match_info['filename']
        success = remap_manager.delete_remaps(filename)
        if success:
            return web.json_response({'success': True})
        else:
            return web.json_response({'error': 'Remaps not found'}, status=404)
    except Exception as e:
        return web.json_response({'error': f'Failed to delete remaps: {str(e)}'}, status=500)


SUPPORTED_EVENTS = [
    'prepare',
    'set_prompt',
    'generate',
]
async def forward_to_websocket(request):
    """Forward HTTP requests to websocket as events."""
    try:
        data = await request.json()
        event = data.get('event')
        event_data = data.get('data', {})

        if not event:
            return web.json_response({'error': 'Event field is required'}, status=400)

        # if event not in SUPPORTED_EVENTS:
        #    return web.json_response({'error': f'Unsupported event: {event}'}, status=400)

        # Forward to all connected websockets
        await server.PromptServer.instance.send_json(event, event_data)

        return web.json_response({'success': True})

    except Exception as e:
        return web.json_response({'error': f'Failed to forward message: {str(e)}'}, status=500)
