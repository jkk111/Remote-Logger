var socket, remote, long, connected = false, key, firstId, pending;
var levels = ["info", "log", "warn", "debug", "error"];

function initiateRemoteLogger(options) {
  options = options || {};
  long = options.long || false;
  remote = {}
  pending = [];
  key = options.key;
  host = options.host || "http://localhost:8080";
  socket = io(host);
  socket.on("connect", connectHandler);
  socket.on("reject", rejectHandler);
  levels.forEach(registerLevel);
  if(options.customLevels) {
    if(typeof options.customLevels === "string")
      options.customLevels = [options.customLevels];
    if(!Array.isArray(options.customLevels))
      throw new Error("customLevels Must be an array!");
    options.customLevels.forEach(registerLevel);
  }
  return remote;
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
    if(validLevel(item)) {
      sendObj.type = item;
    }
    else {
      sendObj.type = "custom";
      sendObj.custom = item;
    }
    if(socket.connected) {
      socket.emit("logEvent", sendObj);
    }
    else {
      pending.push(sendObj);
      if(long) {
        socket.connect();
      }
    }
  }
}

function validLevel(level) {
  return levels.indexOf(level) != -1;
}

function generateSendObj() {
  var sendObj = {};
  arguments = objArrToArr(arguments);
  sendObj.tag = arguments[0];
  sendObj.arguments = arguments.splice(1);
  return sendObj;
}

function connectHandler() {
  socket.emit("auth", { key: key, type: "logger", reconnect: connected });
  var connTime = new Date();
  if(!connected) {
    socket.emit("logEvent", { type: "conn", ts: connTime.getTime() });
  }
  else {
    socket.emit("logEvent", { type: "recon", ts: connTime.getTime() });
  }
  if(pending.length > 0) {
    while(pending.length > 0) {
      var item = pending.splice(0, 1)[0];
      socket.emit("logEvent", item);
    }
  }
  connected = true;
}

function objArrToArr(obj) {
  var keys = Object.keys(obj);
  var arr = [];
  for(var i = 0 ; i < keys.length; i++) {
    arr.push(obj[keys[i]]);
  }
  return arr;
}

function rejectHandler(data) {
  pending.push(data);
}