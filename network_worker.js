importScripts("/socket.io/socket.io.js");
var socket = io();

socket.on("connect", function() {
  socket.emit("auth", { key: "abcdefg", type: "listener", reconnect: false });
})

socket.on("logEvent", function(data) {
  postMessage({ type: "network", data: data });
});