var logger = {
  connected: false,
  levels: ["info", "log", "warn", "debug", "error"],
  initiateRemoteLogger: function(options) {
    this.options = options || {};
    this.long = options.long || false;
    this.remote = {}
    this.pending = [];
    this.key = options.key;
    this.host = options.host || "http://localhost:8082";
    this.socket = io(this.host);
    this.socket.on("connect", this.connectHandler.bind(this));
    this.socket.on("reject", this.rejectHandler.bind(this));
    this.socket.on("disconnect", this.disconnectHandler.bind(this));
    // this.levels.forEach(this.registerLevel, this.remote);
    this.registerLevels(this.levels);
    if(options.customLevels) {
      if(typeof this.options.customLevels === "string")
        this.options.customLevels = [this.options.customLevels];
      if(!Array.isArray(this.options.customLevels))
        throw new Error("customLevels Must be an array!");
      this.registerLevels(this.options.customLevels);
    }
    this.showMessage(this.options)
    return this.remote;
  },
  registerLevels: function(items) {
    for(var i = 0; level = items[i], i < items.length; i++) {
      this.registerLevel(level);
    }
  },
  registerLevel: function(item) {
    var tmp = item;
    var self = this;
    this.remote[item] = function() {
      if(arguments.length < 2 && !self.options.canSendTagOnly) {
        throw new Error("Too Few arguments");
      } else if(typeof arguments[0] != "string") {
        throw new Error("No tag specified!");
      }
      var sendObj = self.generateSendObj.apply(self, arguments);
      if(self.validLevel(item)) {
        sendObj.type = item;
      }
      else {
        sendObj.type = "custom";
        sendObj.custom = item;
      }
      if(self.socket.connected) {
        self.sendMessage("logEvent", sendObj)
      }
      else {
        self.pending.push(sendObj);
        if(self.long) {
          self.socket.connect();
        }
      }
    }
  },

  validLevel: function(level) {
    return this.levels.indexOf(level) != -1;
  },
  generateSendObj: function() {
    var sendObj = {};
    arguments = this.objArrToArr(arguments);
    sendObj.tag = arguments[0];
    sendObj.arguments = arguments.splice(1);
    sendObj.connId = this.firstId;
    sendObj.ts = new Date().getTime();
    return sendObj;
  },
  disconnectHandler: function() {
    if(this.options.verbose)
      this.showMessage("Disconnected at: ", new Date())
  },
  connectHandler: function() {
    var connTime = new Date();
    this.sendMessage("auth", { key: this.key,
                               type: "logger",
                               reconnect: this.connected,
                               ts: connTime.getTime(),
                               connId: (this.firstId === undefined ? this.socket.id : this.firstId)});
    if(!this.connected) {
      if(this.options.verbose)
        this.showMessage("Connected at: ", connTime)
      this.firstId = this.socket.id;
      this.sendMessage("logEvent", { type: "conn",
                                     tag: "connected",
                                     ts: connTime.getTime(),
                                     connId: this.firstId });
    }
    else {
      if(this.options.verbose)
        this.showMessage("Reconnected at: ", connTime)
      this.sendMessage("logEvent", { type: "recon",
                                     tag: "reconnected",
                                     ts: connTime.getTime(),
                                     connId: this.firstId });
    }
    if(this.pending.length > 0) {
      while(this.pending.length > 0) {
        var item = this.pending.splice(0, 1)[0];
        if(!item.connId)
          item.connId = this.firstId || this.socket.id;
        this.sendMessage("logEvent", item);
      }
    }
    this.connected = true;
  },
  objArrToArr: function(obj) {
    var keys = Object.keys(obj);
    var arr = [];
    for(var i = 0 ; i < keys.length; i++) {
      arr.push(obj[keys[i]]);
    }

    console.log(keys, obj, arr);
    return arr;
  },
  rejectHandler: function(data) {
    this.pending.push(data);
  },
  sendMessage: function(type, data) {
    this.socket.emit(type, data);
    if(this.options.verbose)
      this.showMessage("Sent log event: ", type, ", with data ", data);
  },
  showMessage: function() {
    if(!this.messageWrapper) {
      this.messageWrapper = document.createElement("div")
      this.messageWrapper.style = `position: absolute;
                                   width: 100%;
                                   height: 100%;
                                   top: 0;
                                   bottom: 0;
                                   left: 0;
                                   right: 0;
                                   zIndex: 1000000;
                                   transform: rotateX(180deg);
                                   pointer-events: none;
                                   box-sizing: border-box;
                                   padding: 20px`
      document.body.appendChild(this.messageWrapper);
    }
    var message = "";
    for(var i = 0; i < arguments.length; i++) {
      if(arguments[i]) {
        if(typeof arguments[i] === "object")
          message += JSON.stringify(arguments[i], null, "  ");
        else
          message += arguments[i].toString()
      }
    }
    if(this.options.silentFailure)
      return;
    var el = document.createElement("div");
    el.style.position = "relative";
    el.style.marginTop = "5px";
    el.style.minHeight = "34px"
    el.style.left = "50%";
    el.style.transform = "translateX(-50%) rotateX(180deg)"
    el.style.backgroundColor = "#333";
    el.style.color = "white";
    el.style.padding = "10px 20px";
    el.style.borderRadius = "15px";
    el.style.opacity = "0";
    el.style.fontSize = "24px"
    el.style.transition = "opacity 1s ease-in-out";
    el.style.maxWidth = "75%";
    el.style.minWidth = "50%";
    el.style.textAlign = "center";
    el.style.wordBreak = "break-all";
    // var pre = document.createElement("pre");
    // pre.innerHTML = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // el.appendChild(pre);
    el.innerHTML = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // this.messageWrapper.prependChild(el);
    this.prepend(this.messageWrapper, el);
    setTimeout(function() {
      el.style.opacity = "1";
    })
    setTimeout(function() {
      el.style.opacity = "0";
      setTimeout(function() {
        el.parentElement.removeChild(el);
      }, 1100)
    }, 5000)
  },
  prepend: function(element, child) {
    if(element.children.length == 0)
      return element.appendChild(child);
    element.insertBefore(child, element.children[0])
  }
}