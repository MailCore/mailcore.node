"use strict"

var net = require('net');
var tls = require('tls');
var util = require('util');
var etpan = require('libetpan').etpan;
var Constants = require('libetpan').Constants;
var EventEmitter = require('events').EventEmitter;

util.inherits(IMAPBase, EventEmitter);
function IMAPBase(port, hostname, option) {
  EventEmitter.call(this);
  
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
    this.authType = IMAPBase.OAUTH2;
    this.authOption = {
      username: authOption.username,
      clientId: authOption.clientId,
      clientSecret: authOption.clientSecret,
      refreshToken: authOption.refreshToken,
      accessToken: authOption.accessToken
    };
  } else {
    this.authType = IMAPBase.PLAIN;
    this.authOption = {
      username: authOption.username,
      password: authOption.password
    };
  }
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

IMAPBase.TASK_TIMEOUT = 30 * 1000;
IMAPBase.PLAIN = 0x01;
IMAPBase.OAUTH2 = 0x02;
IMAPBase.CLRL = '\r\n';

IMAPBase.prototype._close = function() {
  if (this._connection.close) {
    this._connection.close();
  }
  if (this._connection.socket && this._connection.socket.close) {
    this._connection.socket.close();
  }
  this.removeAllListeners();
  delete this._connection;
}

IMAPBase.prototype.connect = 
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
      if (self.authType === IMAPBase.PLAIN) {
        self._connection.write(util.format('x%d login "%s" "%s"', 
          self._tagCounter++, self.authOption.username, self.authOption.password));
      } else if (self.authType === IMAPBase.OAUTH2) {
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
      self._connection.write(IMAPBase.CLRL);
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

IMAPBase.prototype.disconnect =
function disconnectFromIMAPServer() {
  var socket = this._connection;
  socket.write(util.format('x%d logout', this._tagCounter));
  socket.write(IMAPBase.CLRL);
  this._free();
}

IMAPBase.prototype._select =
function selectMailFolder(folderPath, callback) {
  var socket = this._connection;
  var bufs = [];
  var len = 0;
  socket.write(util.format('x%d select "%s"', this._tagCounter, folderPath));
  socket.write(IMAPBase.CLRL);
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

IMAPBase.prototype._fetchMessagesByNumber = 
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

IMAPBase.prototype._fetchMessagesByUID =
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
  socket.write(IMAPBase.CLRL);
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

    callback(null, r.getFetchItemsFromResponse()); 
  }
}

IMAPBase.prototype._search =
function search(query, callback) {
  // TODO
}

IMAPBase.prototype._appendMessage =
function appendMessage(folder, data, flags, uid, callback) {
  // TODO
}

IMAPBase.prototype._copyMessages =
function copyMessages(folder, uidset, dest) {
  // TODO
}

module.exports = IMAPBase;

