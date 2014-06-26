"use strict"

var net = require('net');
var tls = require('tls');
var util = require('util');
var assert = require('assert');
var starttls = require('./starttls');
var etpan = require('libetpan').etpan;
var Constants = require('libetpan').Constants;
var EventEmitter = require('events').EventEmitter;

util.inherits(IMAPSession, EventEmitter);
function IMAPSession(port, hostname, option) {
  if (!(this instanceof IMAPSession)) {
    return new IMAPSession(arguments);
  }

  var args = normalize(arguments);
  if (!args.hostname) {
    throw new Error('hostname required');
  }
  if (!args.port) {
    if (option.secure !== 'none' || option.secure !== false) {
      args.port = 993;
    } else {
      args.port = 443;
    }
  }
  this.port = args.port;
  this.hostname = args.hostname;
  this.secure = args.option.secure || 'none';

  var authOption = args.option.auth;
  if (!authOption.username) {
    throw new Error('user required in authenticate');
  }
  if (!authOption.password) {
    this.authType = IMAPSession.OAUTH2;
    this.authOption = {
      username: authOption.username,
      clientId: authOption.clientId,
      clientSecret: authOption.clientSecret,
      refreshToken: authOption.refreshToken,
      accessToken: authOption.accessToken
    };
  } else {
    this.authType = IMAPSession.PLAIN;
    this.authOption = {
      username: authOption.username,
      password: authOption.password
    };
  }

  // define some state variables
  // @preQueues just used to store the callees before
  // having been connected to server.
  this._preQueues = [];
  this._preQueuesIdle = null;
  this._connected = false;
  this._tagCounter = 0;
}

function normalize(_arguments) {
  var args = {};
  if (_arguments.length === 3) {
    args.port = _arguments[0];
    args.hostname = _arguments[1];
    args.option = _arguments[2];
    return args;
  }
  for (var i = 0; i < _arguments.length; i++) {
    if (typeof _arguments[i] === 'number') {
      args.port = _arguments[i];
    } else if (typeof _arguments[i] === 'string') {
      args.hostname = _arguments[i];
    } else if (typeof _arguments[i] === 'object') {
      args.option = _arguments[i];
    }
  }
  return args;
}

IMAPSession.TASK_TIMEOUT = 30 * 1000;
IMAPSession.PLAIN = 0x01;
IMAPSession.OAUTH2 = 0x02;
IMAPSession.CLRL = '\r\n';

//
// Internal API
//

IMAPSession.prototype._free = function() {
  if (this._connection.close) {
    this._connection.close();
  }
  if (this._connection.socket && this._connection.socket.close) {
    this._connection.socket.close();
  }
  // clear some unused and remove listeners
  this.removeAllListeners();
  this._preQueues = [];
  this._preQueuesIdle = null;
  this._connected = false;
  this._tagCounter = 0;
  delete this._connection;
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
  setTimeout(ontimeout, IMAPSession.TASK_TIMEOUT);

  function ontimeout() {
    if (!isCalled) {
      var err = new Error('task timeout');
      err.description = 'Might be not callback in Public API';
      self.emit('error', err);
    }
  }
}

//
// Exports(User-land) API
//

IMAPSession.prototype.connect = 
function connectToIMAPServer(callback) {
  var self = this;
  var bufs = [];
  var len = 0;

  if (this.secure === 'tls') {
    this._connection = tls.connect(this.port, this.hostname, {rejectUnauthorized:false}, onconnect);
  } else {
    this._connection = net.connect(this.port, this.hostname);
    this._connection.once('connect', onconnect);
  }
  this._connection.once('error', onerror);

  function onconnect() {
    if (self._connection.setKeepAlive) {
      self._connection.setKeepAlive(true);
    }
    if (self._connection.socket && self._connection.socket.setKeepAlive) {
      self._connection.socket.setKeepAlive(true);
    }

    self._connection.on('data', oncapdata);
    self._connection.once('end', onend);
  }

  function oncapdata(chunk) {
    var res, r;
    bufs.push(chunk);
    len += chunk.length;
    res = Buffer.concat(bufs, len);
    r = etpan.responseParse(res, Constants.PARSER_ENABLE_GREETING);
    if (r.result === Constants.MAILIMAP_NO_ERROR && 
      r.result !== Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {

      // clear variables
      bufs = [];
      len = 0;
      
      // remove the `oncapdata` and on next step(login/auth);
      self._connection.removeListener('data', oncapdata);
      self._connection.addListener('data', onlogindata);
      self._capabilities = r.getCapabilitiesFromResponse();

      // to send the `login/auth` command
      if (self.authType === IMAPSession.PLAIN) {
        self._connection.write(util.format('x%d login "%s" "%s"', 
          self._tagCounter++, self.authOption.username, self.authOption.password));
      } else if (self.authType === IMAPSession.OAUTH2) {
        // TODO(Yorkie): auto extra accessToken by provided refreshToken
        if (!self.authOption.accessToken) {
          self.emit('error', new Error('accessToken required'));
        }
        var authToken = new Buffer(util.format('user=%s\u0001auth=Bearer %s\u0001\u0001',
          self.authOption.username, self.authOption.accessToken));
        self._connection.write(util.format('x%d authenticate XOAUTH2 %s',
          self._tagCounter++, authToken));
      }
      // write >> EOF <<
      self._connection.write(IMAPSession.CLRL);
    }
  }

  function onlogindata(chunk) {
    var res, r;
    bufs.push(chunk);
    len += chunk.length;
    res = Buffer.concat(bufs, len);
    r = etpan.responseParse(res, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result === Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA)
      return;

    self._connection.removeListener('data', onlogindata);
    if (r.result === Constants.MAILIMAP_NO_ERROR) {
      // TODO(Yorkie): queue poping
      self._connected = true;
      self.emit('connect');
      self._handleQueue();
    } else {
      self.emit('error', new Error('authentication error'));
    }
  }

  function onend() {
    self.emit('end');
  }

  function onerror(err) {
    self.emit('error', err);
  }
}

IMAPSession.prototype.disconnect =
function disconnectFromIMAPServer() {
  var socket = this._connection;
  socket.write(util.format('x%d logout', this._tagCounter));
  socket.write(IMAPSession.CLRL);
  this._free();
}

IMAPSession.prototype._select =
function selectMailFolder(folderPath, callback) {
  var socket = this._connection;
  var bufs = [];
  var len = 0;
  socket.write(util.format('x%d select "%s"', this._tagCounter, folderPath));
  socket.write(IMAPSession.CLRL);
  socket.on('data', ondata);
  function ondata(chunk) {
    var res, r;
    bufs.push(chunk);
    len += chunk.length;
    res = Buffer.concat(bufs, len);
    r = etpan.responseParse(res, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result === Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA)
      return;

    socket.removeListener('data', ondata);
    if (r.result !== Constants.MAILIMAP_NO_ERROR)
      return callback(new Error(res+''));

    callback(null, r.getSelectResponseFromResponse());
  }
}

IMAPSession.prototype._fetchMessagesByNumber = 
function fetchMessagesByNumber(start, end, option, callback) {
  if (!start || util.isNumber(start)) {
    return callback(new Error('start(Number) required'));
  }
  if (!end || util.isNumber(end)) {
    return callback(new Error('end(Number) required'));
  }
  if (!option || util.isFunction(option)) {
    callback = option;
    option = null;
  }
  // TODO(Yorkie): to be implement
}

IMAPSession.prototype._fetchMessagesByUID =
function fetchMessagesByUID(start, end, option, callback) {
  if (typeof option === 'function') {
    callback = option;
    option = 'UID ENVELOPE BODYSTRUCTURE';
  }
  if (!option) {
    option = 'UID ENVELOPE BODYSTRUCTURE';
  }

  var socket = this._connection;
  var bufs = [], len = 0;
  var uidset = util.format('%s:%s', start, end);
  var cmd = util.format('x%d uid fetch %s (%s)', this._tagCounter++, uidset, option);
  socket.write(cmd);
  socket.write(IMAPSession.CLRL);
  socket.on('data', ondata);
  function ondata(chunk) {
    var res, r;
    bufs.push(chunk);
    len += chunk.length;
    res = Buffer.concat(bufs, len);
    console.log(res+'');
    r = etpan.responseParse(res, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result === Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA)
      return;

    socket.removeListener('data', ondata);
    if (r.result !== Constants.MAILIMAP_NO_ERROR)
      return callback(new Error(res+''));

    callback(null, r.getFetchItemsFromResponse()); 
  }
}

IMAPSession.prototype._search =
function search(query, callback) {
  // TODO
}

IMAPSession.prototype._appendMessage =
function appendMessage(folder, data, flags, uid, callback) {
  // TODO
}

IMAPSession.prototype._copyMessages =
function copyMessages(folder, uidset, dest) {
  // TODO
}

function wrapAPI(hostobj, name) {
  hostobj.prototype[name] = function() {
    this._preQueues.push({
      func: hostobj.prototype['_'+name].bind(this),
      args: arguments
    });
    if (this._preQueuesIdle) {
      this._handleQueue();
    }
  };
}

wrapAPI(IMAPSession, 'select');
wrapAPI(IMAPSession, 'fetchMessagesByNumber');
wrapAPI(IMAPSession, 'fetchMessagesByUID');
wrapAPI(IMAPSession, 'search');
wrapAPI(IMAPSession, 'appendMessage');
wrapAPI(IMAPSession, 'copyMessages');

exports.IMAPSession = IMAPSession;
