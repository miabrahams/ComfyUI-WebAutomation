import server
from pathlib import Path
from aiohttp import web

SUPPORTED_EVENTS = [
    'prompt_replace',
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

        if event not in SUPPORTED_EVENTS:
           return web.json_response({'error': f'Unsupported event: {event}'}, status=400)

        # Forward to all connected websockets
        await server.PromptServer.instance.send_json(event, event_data)

        return web.json_response({'success': True})

    except Exception as e:
        return web.json_response({'error': f'Failed to forward message: {str(e)}'}, status=500)


base_template = None
with open(Path(__file__).parent.parent / "data" / "workflowTemplate.json", 'r') as templateFile:
    base_template = templateFile.read()


async def forward_reset_request(request):
    """Forward HTTP requests to websocket as events."""
    try:
        # No validation...
        await server.PromptServer.instance.send_json('load_graph', base_template)

        return web.json_response({'success': True})

    except Exception as e:
        return web.json_response({'error': f'Failed to forward message: {str(e)}'}, status=500)
