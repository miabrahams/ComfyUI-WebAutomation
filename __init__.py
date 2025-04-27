import server
import logging
from aiohttp import web
from .routes import list_data_folders, list_images, view_file

logger = logging.getLogger(__name__)

# API for rebase-specific functionality
rebase_app = web.Application()
rebase_app.add_routes([
    web.get("/data/folders", list_data_folders),
    web.get("/data/images", list_images),
    web.get("/data/view", view_file),  # Add route to view files
])
server.PromptServer.instance.app.add_subapp("/rebase/", rebase_app)

WEB_DIRECTORY = "./web/js"
NODE_CLASS_MAPPINGS = { }
NODE_DISPLAY_NAME_MAPPINGS = { }
NODE_CATEGORY_MAPPINGS = { }

logger.info("Rebase routes registered :3")
