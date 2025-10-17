import time
from pkg.client import RebaseClient, PromptReplaceDetail, Resolution, Sampler, IPAdapter

client = RebaseClient("http://localhost:8191")

# Send prompt + resolution
detail = PromptReplaceDetail(
    positive_prompt="a cozy cabin in the woods, golden hour",
    negative_prompt="low quality, blurry",
    resolution=Resolution(width=1152, height=896),
    sampler=Sampler(steps=28, cfg=5.5, sampler_name="euler", scheduler="normal"),
    name="cabin_test",
    # rescaleCfg=True,
    # perpNeg=False,
    # ipAdapter=IPAdapter(image="/path/to/ref.png", weight=0.65, enabled=True),
)
client.prompt_replace(detail)

# Queue 3 generations
# client.generate(3)

time.sleep(1)

# Reset the graph to the base template
client.reset()
