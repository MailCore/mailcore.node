"use strict"

var util = require('util');
var IMAPBase = require('./imap-base');

util.inherits(IMAPSession, IMAPBase);
function IMAPSession(port, hostname, option) {
  if (!(this instanceof IMAPSession)) {
    return new IMAPSession(arguments);
  }
  IMAPBase.apply(this, arguments);

  // define some state variables
  // @preQueues just used to store the callees before
  // having been connected to server.
  this._preQueues = [];
  this._preQueuesIdle = null;
  this._connected = false;
  this._tagCounter = 0;
}

//
// Internal API
//

IMAPSession.prototype._free = function() {
  this._close();
  this._preQueues = [];
  this._preQueuesIdle = null;
  this._connected = false;
  this._tagCounter = 0;
  delete this._preQueues;
}

IMAPSession.prototype._handleQueue = function() {
  var self = this;
  var task = this._preQueues.shift();
  if (!task) {
    this._preQueuesIdle = true;
    return;
  } else {
    this._preQueuesIdle = false;
  }

  if (!task.func || !task.args) {
    return this.emit('error', new Error('invalid task, `func`/`args` required'));
  }

  // parse last argument(callback) and gen a new arguments for the internal queue
  var isCalled = false;
  var oldCallback = task.args[task.args.length - 1];
  var hasCallback = typeof oldCallback === 'function';
  if (hasCallback) {
    task.args[task.args.length - 1] = function(err, result) {
      if (err)
        return self.emit('error', err);
      oldCallback(result);
      self._handleQueue();
      isCalled = true;
    }
  } else {
    task.args[task.args.length] = function(err, result) {
      if (err) 
        return self.emit('error', err);
      self._handleQueue();
      isCalled = true;
    }
    task.args.length += 1;
  }

  // run functions
  task.func.apply(this, task.args);
  // task.func.apply(this, task.args);
  setTimeout(ontimeout, IMAPBase.TASK_TIMEOUT);

  function ontimeout() {
    if (!isCalled) {
      var err = new Error('task timeout');
      err.description = 'Might be not callback in Public API';
      self.emit('error', err);
    }
  }
}

//
// wrap networking function to session
//

function wrapAPI(name) {
  IMAPSession.prototype[name] = function() {
    this._preQueues.push({
      func: IMAPBase.prototype['_'+name].bind(this),
      args: arguments
    });
    if (this._preQueuesIdle) {
      this._handleQueue();
    }
  };
}

//
// Exports(User-land) API
//

wrapAPI('select');
wrapAPI('fetchMessagesByNumber');
wrapAPI('fetchMessagesByUID');
wrapAPI('search');
wrapAPI('appendMessage');
wrapAPI('copyMessages');

exports.IMAPSession = IMAPSession;
