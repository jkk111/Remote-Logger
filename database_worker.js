var data = [];
var keys = [];
if(typeof Worker === "undefined") {
  importScripts("subworker.js"); // Allows instantiating child workers in chrome.
}
var networkWorker = new Worker("network_worker.js");
var currentQuery = "";
var currentMode = "active";
var firstMessage = true;
var variableForm = false;
var acceptingNewLogs = true; // Can be used to stop at (x) logs or just arbitrarily stop accepting logs.
var lastPush = 0;
var pending = [];
var settings = {
  maxResults: 100
}

console.log(URL.createObjectURL);

networkWorker.onmessage = function(logData) {
  if(typeof logData == "object" && !Array.isArray(logData) && acceptingNewLogs) {
    data.push(logData.data);
    postMessage({type: "count", count: data.length});
    if(data.length % 100000 == 0 && data.length > 0) {
      var str = JSON.stringify(data, null, "  ");
      var blob = new Blob([str], {type: "octet/stream"});
      var url = URL.createObjectURL(blob);
      postMessage({type: "blob", data: url})
    }
    if(variableForm)
      pushKeys(logData.data);
    else if(firstMessage) {
      firstMessage = false;
      pushKeys(logData.data);
    }
  }
}

onmessage = function(message) {
  var type = message.data.type;
  var data = message.data.data;
  switch(type) {
    case "search":
      postMessage({type: "search", data: search(data)});
    case "settings":
      updateSettings(data);
  }
}

function search(data) {
  var q = data.q;
  var type = data.type;
  var offset = data.offset;
  var rows = [];
  switch(type) {
    case "active":
      rows = activeSearch(offset);
      break;
    case "string":
      rows = stringSearch(q, offset);
      break;
  }
  currentQuery = q;
  currentMode = type;
  return buildRows(rows);
}

function checkMatches(row) {
  q = currentQuery.trim();
  switch(currentMode) {
    case "string":
      return stringMatches(row, q);
    case "tag":
      return tagSearch(row, q);
    case "id":
      return idSearch(row, q);
    case "type":
      return typeSearch(row, q);
    case "active":
      return true;
  }
}

// Used in incremental updates, check against existing search and posts an update piece as necessary.
function updateUserView(row) {
  if(checkMatches(row)) {
    pending.push(rowBuilder(row));
  }
}

// Much slower, but more results, each row is converted to a string and then comparison is checked
function stringSearch(q, i) {
  q = q.trim();
  i = i || data.length -1;
  var matches = { deepestIndex: -1, matches: [] };
  for(; i >= 0 && matches.matches.length < settings.maxResults; i--) {
    if(stringMatches(data[i], q)) {
      matches.matches.push(data[i]);
      matches.deepestIndex = i;
    }
  }
  return matches;
}

// Not a search per se, however keeping with the naming conventions
// returns the most recent values from logs.
function activeSearch(i) {
  i = i || data.length -1;
  var matches = { deepestIndex: -1, matches: [] };
  for(; i >= 0 && matches.matches.length < settings.maxResults; i--) {
    matches.matches.push(data[i]);
  }
  return matches;
}

function stringMatches(row, q) {
  var str = JSON.stringify(row, null, "  ");
  return str.indexOf(q) > -1;
}

// Updates the settings with user defined settings.
function updateSettings(newSettings) {
  settings = newSettings;
}

// Adds keys in object to object "schema" allowing for key search
function pushKeys(data) {
  for(key in data) {
    if(keys.indexOf(key) == -1)
      keys.push(key);
  }
}

function buildRows(rows) {
  console.log(rows)
  var formattedRows = "";
  if(!rows || rows.length == 0)
    return;
  for(var i = 0 ; i < rows.matches.length; i++) {
    formattedRows += rowBuilder(rows.matches[i]);
  }
  return formattedRows;
}


function rowBuilder(row) {
  var template = `<tr>
  <td class="type"><img src="warning-icon.png"></td>
  <td class="connId">${row.connId}</td>
  <td class="tag">${row.tag}</td>
  <td>
    <pre class="logline">${JSON.stringify(row.arguments, null, "  ")}</pre>
  </td>
</tr>`;
  return template;
}

console.log(search({q:null, type:"active"}));
console.log(search({q:"2", type: "string"}));
console.log(buildRows(stringSearch("sample")));