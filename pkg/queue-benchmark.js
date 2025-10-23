/* Run the following in browser console to benchmark prompt queueing */

(async (batches = 200, perBatch = 4) => {
  console.groupCollapsed('Queue Benchmark');
  console.time('Total time');
  for (let i = 0; i < batches; i++) {
    const start = performance.now();
    await app.queuePrompt(0, perBatch);
    console.log(
      `Batch ${i + 1}/${batches} took ${Math.round(
        performance.now() - start
      )}ms`
    );
  }
  console.timeEnd('Total time');
  console.groupEnd();
})();
