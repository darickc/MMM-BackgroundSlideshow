// The `message` event is fired in a web worker any time `worker.postMessage(<data>)` is called.
// `event.data` represents the data being passed into a worker via `worker.postMessage(<data>)`.
self.addEventListener('message', (event) => {
  //   console.log('Worker received:', event.data);
  var data = event.data;
  fetch(data).then((response) => {
    response.blob().then((blob) => {
      self.postMessage({
        blob: blob,
      });
    });
  });
});
