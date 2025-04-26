from aiohttp import web
import os
from pathlib import Path
# from .utils import get_data_path, get_target_folder_files, get_info_filename


def get_data_path():
    return Path(__file__).parent / "data"


def get_evals_path():
    return get_data_path() / "evals"


def get_target_folder_files(subdir: str, filter_ext=(".png",".jpg",".jpeg")):
    # base = get_data_path()
    # target = os.path.join(base, data_type)
    target = get_evals_path() / subdir
    if not os.path.isdir(target): return None
    files = [f for f in target.iterdir() if os.path.isfile(os.path.join(target, f))]
    if filter_ext:
        files = [f for f in files if f.name.lower().endswith(filter_ext)]
    return sorted(files)


async def list_data_folders(request):
    base = get_evals_path()
    folders = [d for d in base.iterdir() if d.is_dir()]
    return web.json_response({
        "folders": [folder.stem for folder in sorted(folders)]
    })

async def list_images(request):
    folder = request.query.get("folder","cartoon")
    files = get_target_folder_files(folder)
    if files is None: raise web.HTTPNotFound()
    imgs = []
    for fn in files:
        imgs.append({
            "filename": fn,
            "url": f"/rebase/data/view?folder={folder}&filename={fn}"
        })
    return web.json_response({"images": imgs})
