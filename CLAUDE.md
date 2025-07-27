# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is ComfyUI-SearchReplace, a ComfyUI custom node extension that provides diff-based workflow management functionality. It allows users to capture, compare, and apply differences between ComfyUI workflows, with features for image browsing and evaluation management.

## Build Commands

### Frontend (TypeScript/Vite)
- `cd web && npm run dev` - Start development server for frontend
- `cd web && npm run build` - Build TypeScript frontend to JavaScript
- `cd web && npm install` - Install frontend dependencies

### Development Environment
- `make build` - Build the frontend only
- `make dev` - Build and start ComfyUI development server with the extension
- `make install` - Full setup including ComfyUI installation and Python dependencies

## Architecture

### Backend (Python)
- **`__init__.py`** - Extension entry point, registers routes with ComfyUI server
- **`routes.py`** - HTTP API endpoints for file management and diff operations
- **`diff_manager.py`** - Core diff persistence logic (save/load/list/delete)
- **`server.py`** & **`socket.py`** - Additional server components (not integrated into main extension)

### Frontend (TypeScript)
- **`web/src/comfyRebase.ts`** - Main extension class implementing the Differ interface
- **`web/src/diffPopup.ts`** - UI for viewing and managing saved diffs
- **`web/src/dropModal.ts`** - Image drop interface for workflow application
- **`web/src/evalBrowser.ts`** - File browser for evaluation data
- **`web/src/evalRunner.ts`** - Workflow execution management

### Key Components

1. **ComfyRebase Class**: Core frontend controller that manages:
   - Node state capture/restore (`copyNodeValues`, `pasteNodeValues`)
   - Diff calculation and application (`diffNodeValues`, `applyDiff`)
   - Integration with UI modals and popups

2. **DiffManager**: Backend service for persistent diff storage in `data/diffs/` directory

3. **API Routes**: RESTful endpoints under `/rebase/` prefix:
   - `/data/folders` - List evaluation folders
   - `/data/images` - List images in folders
   - `/diff/save` - Save workflow diffs
   - `/diff/load/{filename}` - Load specific diff
   - `/diff/list` - List all saved diffs

### Data Structure
- **Stored Node Data**: Captures widget values and node modes
- **Diff Data**: Records old/new value pairs for changed widgets and modes
- **File Organization**: Images stored in `data/evals/`, diffs in `data/diffs/`

## Development Notes

- Frontend builds with Vite to `web/js/` directory
- Extension loads via ComfyUI's extension system
- Uses ComfyUI's native UI components (ComfyButton, ComfyButtonGroup)
- Diff format focuses on widget values and node execution modes
- No automated tests currently configured