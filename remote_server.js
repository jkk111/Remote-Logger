var express = require("express");
var app = express();
app.use(express.static(__dirname));
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
var baseEvents = ["disco", "conn", "recon"].concat(levels);

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
     *   apiKey: <String>
     * }
     */
    clearTimeout(authTimer);
    roomKey = data.apikey;
    var auth = true;
    if(auth) {
      socket.isAuthenticated = true;
      socket.canStreamToRoom = conf.socketsCanStreamToRoom;
      socket.leave(socket.id);
      socket.join(apikey);
      socket.emit("auth", true);
    } else {
      socket.disconnect();
    }
  })

  socket.on("logEvent", function(data) {
    /*
     * {
     *   type: ["log", "info", "debug", "warn", "error", "disco", "conn", "recon"],
     *   tag: <String>,
     *   arguments: (...<Object>)
     * }
     */
    if(socket.isAuthenticated) {
      pushToDb(data.type, args);
      if(socket.canStreamToRoom)
        io.to(roomKey).emit("logEvent", data);
    } else {
      socket.emit("auth", false);
    }
  });



})

function validLevel(level) {
  return levels.indexOf(level) != -1;
}

function pushToDb(level, args) {
  console.log("database not implemented yet, dropping data");
}