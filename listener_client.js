var socket, logs, logNumber = 0, lastMouseX = 0, lastMouseY = 0,
    settingsOpen = false, settings, search, searchOpen = false,
    connectedInfo, receivedInfo;
var settingsValues = {
  expandOnHover: {
    type: "boolean",
    default: true
  },
  autoScroll: {
    type: "boolean",
    default: false
  },
  maxLines: {
    type: "number",
    default: 100
  },
  allowLargerLogStore: {
    type: "boolean",
    default: false
  }
}
var logsArray = [];

var connectedClients = {};

var inlineEls = ["img", "input"], worker;

function buildDomElementString(type, params, contents) {
  //Faster than document.createElement
  return "<" + type + " " + params + ">" + (contents || "") + "</" + type + ">";
}

function addClients(clients) {
  for(var i = 0 ; i < clients.length; i++) {
    if(!connectedClients[clients[i]]) {
      var client = clients[i];
      connectedClients[client] = {}
      connectedClients[client].messages = 0;
      var messagesEl = document.createElement("tr");
      var name = document.createElement("td");
      name.innerHTML = client;
      var messages = document.createElement("td");
      messages.innerHTML = 0;
      messagesEl.appendChild(name);
      messagesEl.appendChild(messages);
      activity.appendChild(messagesEl);
      connectedClients[client].messagesEl = messagesEl;
    }
  }
}

function buildEntry2(logData) {
  if(!worker)
    worker = new Worker("worker.js");
  worker.postMessage(logData);
  worker.onmessage = function(e) {
    var tmp = document.createElement("div");
    tmp.innerHTML = e.data.substring(5, e.data.length-5);
    var docFrag = document.createDocumentFragment();
    while(tmp.childNodes[0]) {
      tmp.childNodes[0].addEventListener("mouseover", hoverHandler);
      tmp.childNodes[0].addEventListener("mouseout", leaveHandler);
      tmp.childNodes[0].addEventListener("wheel", wheelHandler)
      tmp.childNodes[0].addEventListener("click", clickHandler)
      docFrag.appendChild(tmp.childNodes[0]);
    }
    logs.appendChild(docFrag);
  }
}

function incrementClient(client) {
  if(!client)
    return;
  if(connectedClients[client])
    connectedClients[client].messages++;
  else {
    addClients([client])
    connectedClients[client].messages = 1;
  }
  connectedClients[client].messagesEl.children[1].innerHTML = connectedClients[client].messages;
}

document.addEventListener("DOMContentLoaded", function() {
  // var w = new Worker("worker.js");
  console.log("starting array build")
  var start = new Date().getTime();
  var test = [];
  for(var i = 0 ;i < 1000000; i++) {
    test.push({});
  }
  console.log("array built in %dms", ((new Date).getTime()) - start);
  settings = document.getElementById("settings-wrapper");
  search = document.getElementById("search-wrapper");
  connectedInfo = document.getElementById("connected-info");
  receivedInfo = document.getElementById("received-info");
  getUserSettings();
  buildSettings();
  document.addEventListener("mousemove", function(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });
  logs = document.getElementById("logs");
  socket = io();

  socket.on("logEvent", function(data) {
    var lineno = document.createElement("span");
    var el = document.createElement("div");
    var icon = document.createElement("img");
    icon.src = "warning-icon.png";
    var iconw = document.createElement("span");
    incrementClient(data.connId);
    iconw.appendChild(icon);
    el.appendChild(lineno)
    el.appendChild(iconw);
    var text = document.createElement("span");
    text.innerHTML = JSON.stringify(data);
    el.appendChild(text);
    buildEntry3(data);
    receivedInfo.innerHTML = `${logNumber} Messages Received`;
    if(settingsValues.autoScroll.get()) {
      setTimeout(function() {
        logs.parentElement.scrollTop = logs.parentElement.scrollHeight;
      }, 5);
    }
    expanded = document.getElementsByClassName("expanded");
    el = document.elementFromPoint(lastMouseX, lastMouseY);
    for(var i = 0 ; i < expanded.length ; i++) {
      if(expanded[i] != el)
        expanded[i].classList.remove("expanded");
    }
    if(el && (el.classList.contains("logline") || el.parentElement.type === "tr")) {
      hoverHandler({target: el})
    }
    if(logs.children.length > (settingsValues.maxLines.value || settingsValues.maxLines.default )+ 1) {
      logs.children[1].style.display = "none";
      setTimeout(function() {
        if(logs.children[1]) {
          logs.removeChild(logs.children[1]);
        }
        expanded = document.getElementsByClassName("expanded");
        el = document.elementFromPoint(lastMouseX, lastMouseY);
        for(var i = 0 ; i < expanded.length ; i++) {
          if(expanded[i] != el)
            expanded[i].classList.remove("expanded");
        }
        if(el.classList.contains("logline") || el.parentElement.type === "tr") {
          hoverHandler({target: el})
        }
      }, 1000);
    }
  });

  socket.on("clients", function(clients) {
    connectedInfo.innerHTML = `${clients.length} Connected Clients`;
    addClients(clients);
  });
  var levels = ["info", "log", "warn", "debug", "error"];
  function validLevel(level) {
    return levels.indexOf(level) != -1;
  }
});


function buildEntry3(logData) {
  // if(!worker) {
  //   worker = new Worker("worker.js");
  //   worker.onmessage = function(e) {
  //     var tmp = document.createElement("table");
  //     tmp.innerHTML = e.data.domString;
  //     logNumber = e.data.logNumber;
  //     if(!e.data.domString) return;
  //     var fragment = document.createDocumentFragment();
  //     for(var i = 0; i < tmp.children[0].children.length; i++) {
  //       tmp.children[0].children[i].addEventListener("mouseover", hoverHandler);
  //       tmp.children[0].children[i].addEventListener("mouseout", leaveHandler);
  //       tmp.children[0].children[i].addEventListener("wheel", wheelHandler)
  //       tmp.children[0].children[i].addEventListener("click", clickHandler)
  //       fragment.appendChild(tmp.children[0].children[i]);
  //     }
  //     logs.appendChild(fragment);
  //   }
  // }
  // worker.postMessage(logData);
  if(logsArray.length < 250000 || settingsValues.allowLargerLogStore.get()) {
    logsArray.push(logData);
    logNumber = logsArray.length
  }
}

function login() {
  socket.on("connect", function() {
    socket.emit("auth", { key: "abcdefg", type: "listener", reconnect: false });
  }).connect();
}

function toggleSettings() {
  if(!settings)
    return;
  if(settingsOpen) {
    settings.classList.remove("open");
    settingsOpen = false;
  } else {
    settings.classList.add("open");
    settingsOpen = true;
  }
}

function toggleSearch() {
  if(!search)
    return
  if(searchOpen) {
    search.classList.remove("search-open");
    searchOpen = false;
  } else {
    search.classList.add("search-open");
    searchOpen = true;
  }
}

function buildSettings() {
  for(setting in settingsValues) {
    settingsValues[setting].get = function() {
      return this.value === undefined ? this.default : this.value;
    }
    var name = formatName(setting);
    var el = "";
    switch(settingsValues[setting].type) {
      case "boolean":
        el = buildBool(name, setting);
        break;
      case "text":
      case "number":
        el = buildText(name, setting);
        break;
      default: break;
    }
    if(el && el != "") {
      settings.children[0].appendChild(el);
    }
  }
}

function formatName(str) {
  var words = getWords(str);
  var name = "";
  for(var i = 0; i < words.length; i++) {
    if(i > 0)
      name += " ";
    name += words[i]
  }
  return name;
}

function buildBool(name, setting) {
  var span = document.createElement("span");
  var label = document.createElement("label");
  var input = document.createElement("input");
  input.checked = settingsValues[setting].value || settingsValues[setting].default
  input.type = "checkbox";
  label.innerText = name;
  span.appendChild(label);
  span.appendChild(input);
  listenerHandler(input, setting);
  return span;
}

function buildText(name, setting) {
  var span = document.createElement("span");
  var label = document.createElement("label");
  var input = document.createElement("input");
  input.type = settingsValues[setting].type;
  input.value = settingsValues[setting].get();
  label.innerText = name;
  span.appendChild(label);
  span.appendChild(input);
  listenerHandler(input, setting);
  return span;
}

function getWords(str) {
  var words = [];
  var currentWord = "";
  for(var i = 0 ; i < str.length; i++) {
    if(i === 0) {
      currentWord += str.charAt(0).toUpperCase();
      continue;
    }
    if(str.charAt(i).toUpperCase() === str.charAt(i)) {
      words.push(currentWord);
      currentWord = str.charAt(i);
    } else {
      currentWord += str.charAt(i);
    }
  }
  words.push(currentWord);
  return words;
}

function getUserSettings() {

}

function stripData(data) {
  var strip = ["connId", "type", "tag", "ts"];
  var stripped = {};
  for(var key in data) {
    if(strip.indexOf(key) == -1) {
      stripped[key] = data[key]
    }
  }
  return stripped;
}

function buildEntry(logData) {
  // var tr = document.createElement("tr");
  var tr = document.createElement("tr");


  var lineno = document.createElement("td");
  lineno.innerHTML = ++logNumber;
  lineno.classList.add("lineno");
  tr.appendChild(lineno);

  // var lineno = buildDomElementString("td", "class=\"lineno\"", ++logNumber);

  // var img = buildDomElementString("img", "src=\"warning-icon.png\"");

  // var type = buildDomElementString("td", "class=\"type\"", img);
  var type = document.createElement("td");
  var typeImage = document.createElement("img");
  typeImage.src = "warning-icon.png";
  type.appendChild(typeImage);
  type.classList.add("type");
  tr.appendChild(type);

  var connId = document.createElement("td");
  connId.innerText = logData.connId || "";
  connId.classList.add("connId");
  tr.appendChild(connId);
  // var connId = buildDomElementString("td", "class=\"connId\"", logData.connId);

  var tag = document.createElement("td");
  tag.innerText = ((logData.tag || "") + "").substring(0, 32);
  tag.classList.add("tag");
  tr.appendChild(tag);

  // var tag = buildDomElementString("td", "class=\"tag\"", ((logData.tag || "") + "").substring(0, 32));

  // var pre = buildDomElementString("pre", "class=\"logline\"", JSON.stringify(logData.arguments, null, "  "));
  // var data = buildDomElementString("td", "", pre);
  var data = document.createElement("td");
  var pre = document.createElement("pre");
  pre.innerHTML = JSON.stringify(logData.arguments, null, "  ");
  pre.classList.add("logline");
  data.appendChild(pre);
  tr.appendChild(data);
  tr.addEventListener("mouseover", hoverHandler);
  tr.addEventListener("mouseout", leaveHandler);
  tr.addEventListener("wheel", wheelHandler)
  tr.addEventListener("click", clickHandler)
  return tr;
}

function cutEls(el, numCloses) {
  var index = 0;
  var strContent = el.innerHTML;
  for(var i = 0; i < numCloses; i++) {
    index = strContent.indexOf(">", index) + 1;
  }
  console.log(strContent.substring(0, index));
  el.innerHTML = el.innerHTML.substring(index);
}

function clickHandler(e) {
  var url = e.target.dataId;
}

function hoverHandler(e) {
  if(!settingsValues.expandOnHover.get()) return;
  var el;
  if(!e.target)
    return;
  if(e.target.classList.contains("logline"))
    el = e.target;
  else {
    var children = e.target.parentElement.children
    el = children[children.length - 1].children[0]
  }
  if(el) {
    el.classList.add("expanded");
  }
}

function wheelHandler(e) {
  var el = document.elementFromPoint(e.clientX, e.clientY);
  var expanded = document.getElementsByClassName("expanded");
  for(var i = 0 ; i < expanded.length ; i++) {
    if(expanded[i] != el)
      expanded[i].classList.remove("expanded");
  }
  if(el.classList.contains("logline") || el.parentElement.type === "tr") {
    hoverHandler({target: el})
  }
}

function leaveHandler(e) {
  if(!e.target)
    return;
  if(!e.target.classList.contains("logline")) {
    var children = e.target.parentElement.children;
    if(children[children.length - 1].children[0])
      children[children.length - 1].children[0].classList.remove("expanded");
  } else {
    e.target.classList.remove("expanded");
  }
}

function boolListenerHandler(el, setting) {
  el.addEventListener("change", function() {
    settingsValues[setting].value = el.checked;
    if(settingsValues[setting].listeners) {
      var listeners = settingsValues[setting].listeners;
      for(var i = 0; i < listeners.length; i++) {
        if(typeof listeners[i] === "function") {
          listeners[i](el.checked);
        }
      }
    }
  });
}

function listenerHandler(el, setting) {
  if(settingsValues[setting].type === "boolean") {
    boolListenerHandler(el, setting);
  } else {
    el.addEventListener("input", function() {
      settingsValues[setting].value = el.value;
      if(settingsValues[setting].listeners) {
        var listeners = settingsValues[setting].listeners;
        for(var i = 0; i < listeners.length; i++) {
          if(typeof listeners[i] === "function") {
            listeners[i](el.value);
          }
        }
      }
    });
  }
}