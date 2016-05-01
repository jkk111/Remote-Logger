var express = require("express");
var app = express();
app.use(express.static(__dirname));
var cluster = require("cluster");
var clc = require("cli-color");
var longjohn = require('longjohn');
longjohn.async_trace_limit = -1;
var tag = clc.magenta;
var r = require("rethinkdb"), conn;
var conn, http, io;
var MIN_SKIP = 100;
r.connect({user: "admin", password: "", db: "logs"}, function(err, connection) {
  if(err) return console.log(err);
  console.log("Connected To Database")
  conn = connection;
  http = require("http").createServer(app).listen(8082, function() {
    console.log("Webserver started on port 8082");
  });
  io = require("socket.io")(http);
  io.on("connection", handleConn);
})
var conf;
try {
  conf = JSON.parse(fs.readFileSync("config.json", "utf8"));
} catch(e) {
  console.error("Could not open \"config.json\"");
}

var logsSinceGc = 0;

if(!conf)
  conf = {};
conf.socketsCanStreamToRoom = true;
var levels = ["info", "log", "warn", "debug", "error"];
var connEvents = ["disco", "conn", "recon"];
var baseEvents = connEvents.concat(levels);
function handleConn(socket) {
  var logged = 0;
  var roomKey;
  var connId = "NO_AUTH";
  // var authTimer = setTimeout(function() {
  //   console.log("disconnecting socket %s for inactivity", socket.id);
  //   socket.disconnect();
  // }, 5000);

  function getLoggersInRoom(room) {
    var clients = io.nsps["/"].adapter.rooms[room];
    var loggers = [];
    if(clients && clients.sockets) {
      for(key in clients.sockets) {
        if(key === "NO_AUTH")
          continue;
        if(io.sockets.connected[key] && io.sockets.connected[key].clientType === "logger") {
          if(key.charAt(0) == "/")
            key = key.substring(2);
          loggers.push(key)
        }
      }
    }
    return loggers;
  }

  function sendToListeners(type, data, room) {
    var clients = io.nsps["/"].adapter.rooms[room];
    var listeners = [];
    if(clients && clients.sockets) {
      for(key in clients.sockets) {
        if(io.sockets.connected[key] && io.sockets.connected[key].clientType === "listener") {
          io.sockets.connected[key].emit(type, data);
        }
      }
    }
  }

  socket.on("auth", function(data) {
    /*
     * {
     *   type: ["logger", "listener"]
     *   reconnect: <Boolean>
     *   apiKey: <String>
     * }
     */
    // clearTimeout(authTimer);
    roomKey = data.key;
    var auth = true; // Add in actual authentication, will probably require an async callback
    if(auth) {
      socket.isAuthenticated = true;
      socket.canStreamToRoom = conf.socketsCanStreamToRoom;
      socket.leave(socket.id);
      socket.join(data.key);
      socket.room = roomKey;
      socket.clientType = data.type;
      socket.emit("auth", true);
      // io.to(socket.room).emit("clients", getLoggersInRoom(socket.room));
      setImmediate(function() {
        sendToListeners("clients", getLoggersInRoom(socket.room), socket.room);
      })
      if(data.type === "listener") {
        console.log("listener auth");
      } else {
        console.info("logger connected")
      }
    } else {
      socket.disconnect();
    }
  });

  socket.on("disconnect", function() {
    if(socket.isAuthenticated) {
      // Attempting to prevent stack overflow
      if(socket.clientType === "listener") {
        console.info("listener disconnected")
      }
      setImmediate(function() {
        sendToListeners("logEvent", { type: "disco", connId: connId === "NO_AUTH" ?
                                      socket.id.substring(2) : connId, tag: "disconnected",
                                      ts: new Date().getTime()});
        sendToListeners("clients", getLoggersInRoom(socket.room), socket.room);
      })
    }
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
      pushToDb((data.type === "custom" ? data.custom : data.type), data, roomKey);
      // if(socket.canStreamToRoom)
      //   io.to(roomKey).emit("logEvent", data);
      setImmediate(function() {
        sendToListeners("logEvent", data, roomKey);
      });
      if(gc && ++logsSinceGc % 100000 === 0) {
        console.log("Received:", logsSinceGc);
        // gc();
      }
    } else {
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
  // console.log(clc.magenta.underline(level), clc.yellow(data.tag), data.args);
  // io.to("databaseHandler").emit("logEvent", data);
  r.table(roomKey).insert({
    level: level,
    tag: data.tag || "ERR_NO_TAG",
    connId: data.connId,
    args: data.arguments || [],
    client_ts: data.ts,
    server_ts: r.now()
  }).run(conn, function(err, data) {
    // r.table(roomKey).orderBy(r.desc("server_ts")).skip(MIN_SKIP).delete().run(conn, function(err2, data2) {
    //   // console.log(err, err2, data, data2)
    // })
  })
}