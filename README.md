# ComfyUI SearchReplace

ComfyUI-SearchReplace ("Rebase") adds diff-aware editing, batch reruns, and remote prompts to ComfyUI. Install once with `make install`, then use `make dev` for day-to-day development; both commands copy the extension into `ComfyUI/custom_nodes/` and expose helper APIs under `/rebase/`.

## Toolbar Buttons (C · P · D · A · 🖼️)

- **C — Copy** caches every widget value and execution mode from the current graph so you can track later edits.
- **P — Paste** restores the cached values onto matching nodes and applies any stored field remaps to mirror settings across nodes.
- **D — Diff** compares live values against the cache, opens the diff popup, and lets you review/merge previous diffs or adjust remaps.
- **A — Apply** writes the staged diff back into the graph and refreshes the canvas.
- **🖼️ — Drop Picture** launches the drop modal. Drop an image to spawn a `LoadImage` node, upload the file, reapply the active diff (when present), and automatically queue three workflow runs.

![Diff toolbar](/images/diff-bar.png)

## Automations & Browser
Click the **⏩ Automations** button to open the evaluation browser. Folders under `data/evals/` (and other `data/*` categories) appear as collections you can preview, multi-select, or randomize. Choosing **Run Evaluation** hands control to the automation runner, which loads each image’s workflow via `/rebase/data/view`, reapplies your diff, triggers widget callbacks such as `beforeQueued`, and queues the requested number of generations while streaming status to a corner overlay. Need to abort? Run `rebased.evalRunner.cancelEvaluation()` in the browser console.

For unattended batches, run `batch_processor.py <directory>` against folders that pair `image.png` with `image.txt` prompts. The script pushes prompt and resolution updates for each pair, then requests the desired number of generations through the broadcast route below.



## Change Event Broadcast API
The backend bridges HTTP to the ComfyUI websocket via one route:

```
POST /rebase/forward
{
  "event": "promptReplace",
  "data": {
    "positive_prompt": "Astronaut riding a koi",
    "resolution": { "width": 1024, "height": 1024 }
  }
}
```

Current handlers implement two events:
- `promptReplace` updates the CLIP positive prompt and maps the supplied resolution to the nearest aspect-ratio widget.
- `generateImages` queues 1–8 renders through `app.queuePrompt`.

Other `event` strings are forwarded untouched, so you can wire additional listeners with `app.api.addEventListener` inside your own extensions.

## Data & Builds
Diff exports land in `data/diffs/`, remap presets in `data/remaps/`, and evaluation assets under `data/evals/`. Regenerate frontend assets with `make build` (or `npm run build` inside `web/`) whenever you change TypeScript, then reload your ComfyUI tab or rerun `make dev` to pick up the compiled bundle.
