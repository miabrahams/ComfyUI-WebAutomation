
/*
queue.Pending[0]

queue.Pending[0].prompt[2]

get_queue = await app.api.getQueue();

app.api.getQueue().then(queue => {
  items = queue.Pending.sort((item1, item2) => {return item1.prompt[0] - item2.prompt[0]})
  items.forEach(async (queue_item) => {
      try {
        const ckpt_name = queue_item.prompt[2][474].inputs.ckpt_name
        console.log(ckpt_name, queue_item.prompt[0]);
        // await api.deleteItem('queue', queue_item.prompt[1])
      } catch (e) {
        console.log(queue_item.prompt[2]);
      }
  });
});

for (const i in queue.Pending) {
    const ckpt_name = queue.Pending[i].prompt[2][474].inputs.ckpt_name

    if (ckpt_name !== "fifthMixIllustrious_bananaDaiquiri.safetensors") {
      console.log(`item ${i} is ${ckpt_name}`);
    }
}

  await api.deleteItem('queue', queue_item.prompt[1])


queue.Pending[0].prompt[2][474].inputs.ckpt_name
*/