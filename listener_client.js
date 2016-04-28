var socket, logs, logNumber = 0, lastMouseX = 0, lastMouseY = 0, settingsOpen = false, settings;
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
  }
}
document.addEventListener("DOMContentLoaded", function() {
  settings = document.getElementById("settings-wrapper");
  getUserSettings();
  buildSettings();
  document.addEventListener("mousemove", function(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });
  logs = document.getElementById("logs");
  socket = io("http://localhost:8082")
  socket.on("join", function() {
    console.log("someone joined!");
  })

  socket.on("logEvent", function(data) {
    // if(validLevel(data.type)) {
    //   console[data.type].apply(console, data.arguments);
    // } else {
    //   console.log.apply(console, data.arguments);
    // }
    var lineno = document.createElement("span");
    // lineno.innerHTML = ++logNumber;
    var el = document.createElement("div");
    var icon = document.createElement("img");
    icon.src = "warning-icon.png";
    var iconw = document.createElement("span");
    iconw.appendChild(icon);
    // console.log(eventIcons);
    // console.log(eventIcons[data.type])
    el.appendChild(lineno)
    el.appendChild(iconw);
    var text = document.createElement("span");
    text.innerHTML = JSON.stringify(data);
    el.appendChild(text);
    logs.appendChild(buildEntry(data));
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
      // var hovered = document.querySelectorAll(":hover")
      // hovered[hovered.length - 1].classList.add("expanded");
      logs.children[1].style.display = "none";
      setTimeout(function() {
        if(logs.children[1]);
          logs.removeChild(logs.children[1]);
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
  var levels = ["info", "log", "warn", "debug", "error"];
  function validLevel(level) {
    return levels.indexOf(level) != -1;
  }
});

function login() {
  // var user = document.getElementById("username").value;
  // var pass = document.getElementById("pass").value;
  // console.log("connecting");
  socket.connect().emit("auth", { key: "abcdefg", type: "listener", reconnect: false });
  // console.log(socket.id);
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

function buildSettings() {
  for(setting in settingsValues) {
    var name = formatName(setting);
    var el = "";
    if(settingsValues[setting].type === "boolean") {
      el = buildBool(name, settingsValues[setting]);
    }
    if(el != "") {
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

function buildBool(name, obj) {
  var span = document.createElement("span");
  var label = document.createElement("el");
  var input = document.createElement("input");
  input.checked = settingsValues[setting].value || settingsValues[setting].default
  input.type = "checkbox";
  label.innerText = name;
  span.appendChild(label);
  span.appendChild(input);
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
  var tr = document.createElement("tr");

  var lineno = document.createElement("td");
  lineno.innerHTML = ++logNumber;
  lineno.classList.add("lineno");
  tr.appendChild(lineno);

  var type = document.createElement("td");
  var typeImage = document.createElement("img");
  typeImage.src = "warning-icon.png";
  type.appendChild(typeImage);
  tr.appendChild(type);

  var connId = document.createElement("td");
  connId.innerText = logData.connId || "";
  if(!logData.connId || logData.connId === "")
    console.log(logData);
  tr.appendChild(connId);

  var tag = document.createElement("td");
  tag.innerText = logData.tag || "";
  tr.appendChild(tag);

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

function clickHandler(e) {
  var url = e.target.dataId;
  console.log(url, e.target);
}

function hoverHandler(e) {
  if(!settingsValues.expandOnHover) return;
  // e.target.classList.add("expanded");
  var el;
  if(!e.target)
    return;
  if(e.target.classList.contains("logline"))
    el = e.target;
  else {
    var children = e.target.parentElement.children
    el = children[children.length - 1].children[0]
  }
  if(!el)
    console.log(e);
  else {
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