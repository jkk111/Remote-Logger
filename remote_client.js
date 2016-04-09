var socket, remote, long, connected = false, key;
var levels = ["info", "log", "warn", "debug"];
function initiateRemoteLogger(options) {
  options = options || {};
  long = options.long || false;
  remote = {}
  remote.pending = [];
  key = optiosn.key;
  host = options.host || "http://localhost:8080";
  socket = io(host);
  socket.on("connect", connectHandler);
  socket.on("disconnect", disconnectHandler)
  levels.forEach(registerLevel);
  registerErrorHandler();
  return remote;
}

function objArrToArr(obj) {
  var keys = Object.keys(obj);
  var arr = [];
  for(var i = 0 ; i < keys.length; i++) {
    arr.push(obj[keys[i]]);
  }
  return arr;
}

function registerLevel(item) {
  var tmp = item;
  remote[item] = function() {
    if(arguments.length < 2) {
      throw new Error("Too Few arguments");
    } else if(typeof arguments[0] != "string") {
      throw new Error("No tag specified!");
    }
    var sendObj = generateSendObj.apply(this, arguments);
    if(socket.connected) {
      socket.emit(item, sendObj);
    }
    else {
      remote.pending.push({type: item, data: sendObj });
      if(long)
        socket.connect();
    }
  }
}

function generateSendObj() {
  var sendObj = {};
  arguments = objArrToArr(arguments);
  sendObj.tag = arguments[0];
  sendObj.arguments = arguments.splice(1);
  return sendObj;
}

function registerErrorHandler() {
  remote.error = function() {
    if(arguments.length < 2) {
      throw new Error("Too Few arguments");
    } else if(typeof arguments[0] != "string") {
      throw new Error("No tag specified!");
    }
    var sendObj = generateSendObj.apply(this, arguments);
    if(socket.connected) {
      socket.emit("errorEvent", sendObj);
    } else {
      remote.pending.push({type: "errorEvent", data: sendObj});
      if(long)
        socket.connect();
    }
  }
}

function connectHandler() {
  socket.emit("auth", key);
  if(!connected) {
    socket.emit("info", "Connected at: " + new Date());
  }
  else {
    socket.emit("info", "Reconnected at: " + new Date());
  }
  if(remote.pending.length > 0) {
    while(remote.pending.length > 0) {
      var item = remote.pending.splice(0, 1)[0];
      socket.emit(item.type, item.data);
    }
  }
  connected = true;
}

function disconnectHandler() {
  var discoTime = new Date();
  remote.pending.push({type: "disconnectEvent", data: discoTime.getTime() });
}