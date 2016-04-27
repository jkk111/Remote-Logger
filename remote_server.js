var express = require("express");
var app = express();
app.use(express.static(__dirname));
var clc = require("cli-color");
var tag = clc.magenta;
var r = require("rethinkdb"), conn;
var conn, http, io;
var MIN_SKIP = 100;
r.connect({user: "admin", password: "", db: "logs"}, function(err, connection) {
  if(err) return console.log(err);
  conn = connection;
  http = require("http").createServer(app).listen(8082);
  io = require("socket.io")(http);
  io.on("connection", handleConn);
})
var conf;
try {
  conf = JSON.parse(fs.readFileSync("config.json", "utf8"));
} catch(e) {
  console.error("Could not open \"config.json\"");
}

if(!conf)
  conf = {};
conf.socketsCanStreamToRoom = true;
var levels = ["info", "log", "warn", "debug", "error"];
var connEvents = ["disco", "conn", "recon"];
var baseEvents = connEvents.concat(levels);
function handleConn(socket) {
  io.to("kek").emit("kekklez", "Lol");
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

  socket.on("disconnect", function() {
    io.emit("logEvent", { type: "disco", ts: new Date().getTime()})
  })


  socket.on("logEvent", function(data) {
    /*
     * {
     *   type: ["log", "info", "debug", "warn", "error", "disco", "conn", "recon", "custom"],
     *   custom: <String>?,
     *   tag: <String>,
     *   arguments: (...<Object>)
     * }
     */
    if(socket.isAuthenticated) {
      console.log(data);
      pushToDb((data.type === "custom" ? data.custom : data.type), data, roomKey);
      if(socket.canStreamToRoom)
        io.to(roomKey).emit("logEvent", data);
    } else {
      console.log(clc.red("Rejecting message from: %d"), socket.id);
      socket.emit("auth", false); // "This should never happen"
      socket.emit("reject", data); // However if it does happen, make sure the client has another chance to send the data
    }
  });
}

function validLevel(level) {
  return levels.indexOf(level) != -1;
}

function isConnEvent(event) {
  return connEvents.indexOf(event) != -1;
}

function pushToDb(level, data, roomKey) {
  var serverTime = new Date().getTime();
  console.log(clc.magenta.underline(level), clc.yellow(data.tag), data.args, serverTime);
  r.table(roomKey).insert({
    level: level,
    tag: data.tag || "ERR_NO_TAG",
    connId: data.connId,
    args: data.arguments || [],
    client_ts: data.ts,
    server_ts: serverTime
  }).run(conn, function(err, data) {
    r.table(roomKey).orderBy(r.desc("server_ts")).skip(MIN_SKIP).delete().run(conn, function(err2, data2) {
      console.log(err, err2, data, data2)
    })
  })
}