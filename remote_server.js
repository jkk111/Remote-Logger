var express = require("express");
var app = express();
app.use(express.static(__dirname));
var clc = require("cli-color");
var tag = clc.magenta;
var http = require("http").createServer(app).listen(8080);
var conf;
try {
  conf = JSON.parse(fs.readFileSync("config.json", "utf8"));
} catch(e) {
  console.error("Could not open \"config.json\"");
  // process.exit();
}

if(!conf)
  conf = {};
conf.socketsCanStreamToRoom = true;

var io = require("socket.io")(http);
var levels = ["info", "log", "warn", "debug", "error"];
var connEvents = ["disco", "conn", "recon"];
var baseEvents = connEvents.concat(levels);

io.on("connection", function(socket) {
  console.log(socket.request.headers.referer);
  var logged = 0;
  var roomKey;
  var authTimer = setTimeout(function() {
    console.log("disconnecting socket %s for inactivity", socket.id);
    socket.disconnect();
  }, 5000);

  socket.on("auth", function(data) {
    /*
     * {
     *   type: ["logger", "listener"]
     *   reconnect: <Boolean>
     *   apiKey: <String>
     * }
     */
    console.log(data);
    clearTimeout(authTimer);
    roomKey = data.key;
    var auth = true; // Add in actual authentication, will probably require an async callback
    if(auth) {
      socket.isAuthenticated = true;
      socket.canStreamToRoom = conf.socketsCanStreamToRoom;
      socket.leave(socket.id);
      socket.join(data.key);
      socket.emit("auth", true);
    } else {
      socket.disconnect();
    }
  });



  socket.on("logEvent", function(data) {
    /*
     * {
     *   type: ["log", "info", "debug", "warn", "error", "disco", "conn", "recon", "custom"],
     *   custom: <String>,
     *   tag: <String>,
     *   arguments: (...<Object>)
     * }
     */
    if(socket.isAuthenticated) {
      pushToDb(data.type, data.arguments || data.ts);
      if(socket.canStreamToRoom)
        io.to(roomKey).emit("logEvent", data);
    } else {
      console.log(clc.red("Rejecting message from: %d"), socket.id);
      socket.emit("auth", false); // "This should never happen"
      socket.emit("reject", data); // However if it does happen, make sure the client has another chance to send the data
    }
  });



})

function validLevel(level) {
  return levels.indexOf(level) != -1;
}

function isConnEvent(event) {
  return connEvents.indexOf(event) != -1;
}

function pushToDb(level, args) {
  console.log("database not implemented yet, dropping data");
  console.log(clc.yellow(level), args);
}