import server
import logging
from aiohttp import web

# add current dir to sys.path
import os
import sys
sys.path.append(os.path.dirname(__file__))

from extension.routes import (
    list_data_folders, list_images, view_file,
    save_diff_route, list_diffs_route, load_diff_route, delete_diff_route,
    save_remaps_route, list_remaps_route, load_remaps_route, delete_remaps_route,
    forward_to_websocket
)

logger = logging.getLogger(__name__)

# API for rebase-specific functionality
rebase_app = web.Application()
rebase_app.add_routes([
    web.get("/data/folders", list_data_folders),
    web.get("/data/images", list_images),
    web.get("/data/view", view_file),  # Add route to view files
    # Diff management routes
    web.post("/diff/save", save_diff_route),
    web.get("/diff/list", list_diffs_route),
    web.get("/diff/load/{filename}", load_diff_route),
    web.delete("/diff/delete/{filename}", delete_diff_route),
    # Remap management routes
    web.post("/remaps/save", save_remaps_route),
    web.get("/remaps/list", list_remaps_route),
    web.get("/remaps/load/{filename}", load_remaps_route),
    web.delete("/remaps/delete/{filename}", delete_remaps_route),
    # API forwarding route
    web.post("/forward", forward_to_websocket),
])
server.PromptServer.instance.app.add_subapp("/rebase/", rebase_app)

WEB_DIRECTORY = "./web/js"
NODE_CLASS_MAPPINGS = { }
NODE_DISPLAY_NAME_MAPPINGS = { }
NODE_CATEGORY_MAPPINGS = { }

logger.info("Rebase routes registered :3")
