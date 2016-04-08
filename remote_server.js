var express = require("express");
var app = express();
app.use(express.static(__dirname));
var http = require("http").createServer(app).listen(8080);

var logs = {

}

var io = require("socket.io")(http);
var levels = ["info", "log", "warn", "debug"];
io.on("connection", function(socket) {
  console.log(socket.request.headers.referer);
  var logged = 0;
  var authTimer = setTimeout(function() {
    console.log("disconnecting socket %s for inactivity", socket.id);
    socket.disconnect();
  }, 5000);

  socket.on("auth", function(apikey) {
    clearTimeout(authTimer);
    var auth = true;
    if(auth) {

    } else {
      socket.disconnect();
    }
  })
  levels.forEach(function(level) {
    logged++;
    socket.on(level, function(args) {
      if(!logs[level]) {
        logs[level] = [];
      }
      logs[level].push(args);
      console.log(args);
    })
  })
  socket.on("errorEvent", function(args) {
    logged++;
    var level = "error";
    if(!logs[level]) {
      logs[level] = [];
    }
    logs[level].push(args);
    console.log(args);
  })

  socket.on("disconnectEvent", function(time) {
    console.log(time);
    console.log("disconnected at %d", time)
  });
})

app.get("/logs/:level", function(req, res) {
  var level = req.params.level;
  if(logs[level]) {
    res.json(logs[level])
  } else {
    res.status(404).send(`Level ${level} could not be found`);
  }
});

app.get("/clear", function() {
  logs = {};
  initLogs;
})

initLogs();

function initLogs() {
  levels.forEach(addLevel);
  addLevel("error");
}

function addLevel(level) {
  logs[level] = logs[level] || [];
}