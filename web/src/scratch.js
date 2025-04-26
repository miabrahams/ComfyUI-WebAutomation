
/* Python

# python
from aiohttp import web
import json, os
from .utils import get_parent_path, get_target_folder_files, get_info_filename

async def list_files(request):
    folder_type = request.query.get("folder_type", "outputs")
    folder_path = request.query.get("folder_path", "")
    files = get_target_folder_files(folder_path, folder_type=folder_type)
    if files is None:
        raise web.HTTPNotFound()
    return web.json_response({"files": files})

async def view_file(request):
    # GET /browser/files/view?folder_type=…&folder_path=…&filename=…
    folder_type = request.query.get("folder_type", "outputs")
    folder_path = request.query.get("folder_path", "")
    filename    = request.query.get("filename")
    if not filename:
        raise web.HTTPBadRequest()
    base = get_parent_path(folder_type)
    p = os.path.join(base, folder_path, filename)
    if not os.path.exists(p):
        raise web.HTTPNotFound()
    with open(p, "rb") as f:
        data = f.read()
    # always JSON if workflow‑embed, else image/video
    ctype = "application/json"
    ext = os.path.splitext(filename)[1].lower()
    if ext in (".png",".jpg",".jpeg",".webp"):
        ctype = f"image/{ext[1:]}"
    return web.Response(body=data, content_type=ctype)

# register in your aiohttp app:
app = web.Application()
app.add_routes([
    web.get  ("/browser/files",      list_files),
    web.get  ("/browser/files/view", view_file),
])

*/


export async function onLoadWorkflow(file, comfyApp) {
  const res = await fetch(file.url);
  const blob = await res.blob();
  const fileObj = new File([blob], file.name, {
    type: res.headers.get('Content-Type') || '',
  });
  await comfyApp.handleFile(fileObj);

  toast.show(false, 'Loaded', 'No workflow found here');
}

// javascript
app.registerExtension({
  name: "MyExtension.LoadEmbeddedWorkflow",
  setup() {
    // assume you have comfyUrl, folderType, folderPath and fileName from your UI
    async function loadEmbeddedWorkflow(comfyApp, fileEntry) {
      const { url, name } = fileEntry;
      const res  = await fetch(url);
      const blob = await res.blob();
      // wrap in a File, so ComfyUI “handleFile” sees correct name/contentType
      const fileObj = new File([blob], name, {
        type: res.headers.get("Content-Type") || "application/json",
      });
      // intercept ComfyUI’s loadGraphData to auto‑close your dialog
      const original = comfyApp.loadGraphData.bind(comfyApp);
      comfyApp.loadGraphData = async (graphData) => {
        // hide your iframe/dialog here, e.g.
        document.getElementById("my-extension-dialog")?.remove();
        await original(graphData);
      };
      await comfyApp.handleFile(fileObj);
    }

    // example: add a menu button to launch it
    const btn = document.createElement("button");
    btn.textContent = "🖼 Load Workflow";
    btn.onclick = () => {
      // you’d look up the selected file entry from your file list UI
      loadEmbeddedWorkflow(window.top.app, selectedFileEntry);
    };
    app.ui.menuContainer.appendChild(btn);
  }
});