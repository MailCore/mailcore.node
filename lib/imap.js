"use strict"

var net = require('net');
var tls = require('tls');
var util = require('util');
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

IMAPSession.PLAIN = 0X01;
IMAPSession.OAUTH2 = 0x02;
IMAPSession.CLRL = '\r\n';

//
// Public API
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

    this._connection.on('data', oncapdata);
    this._connection.once('end', onend);
  }

  function oncapdata(chunk) {
    var res, r;
    bufs.push(chunk);
    len += chunk.length;
    res = Buffer.concat(bufs, len);
    r = etpan.responseParse(res, Constants.PARSER_ENABLE_GREETING);
    if (r.result !== Constants.MAILIMAP_NO_ERROR && 
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
        self._connection.write(util.format('x%d login %s %s', 
          self._tagCounter++, self.authOption.username, self.authOption.password));
        self._connection.write(IMAPSession.CLRL);
      } else if (self.authType === IMAPSession.OAUTH2) {
        // TODO(Yorkie): auto extra accessToken by provided refreshToken
        if (!self.authOption.accessToken) {
          self.emit('error', new Error('accessToken required'));
        }
        var authToken = new Buffer(util.format('user=%s\u0001auth=Bearer %s\u0001\u0001',
          self.authOption.username, self.authOption.accessToken));
        self._connection.write(util.format('x%d authenticate XOAUTH2 %s',
          self._tagCounter++, authToken));
        self._connection.write(IMAPSession.CLRL);
      }
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

    if (r.result !== Constants.MAILIMAP_NO_ERROR) {
      // TODO(Yorkie): queue poping
      self._connected = true;
      self.emit('connect');
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
function disconnectFromIMAPServer(callback) {
  // TODO
}

IMAPSession.prototype.select =
function selectMailFolder(folderPath, callback) {
  // TODO
}

IMAPSession.prototype.fetchMessagesByNumber = 
function fetchMessagesByNumber(start, end, option, callback) {
  // TODO
}

IMAPSession.prototype.fetchMessagesByUID =
function fetchMessagesByUID(start, end, option, callback) {
  // TODO
}

IMAPSession.prototype.search =
function search(query, callback) {
  // TODO
}

IMAPSession.prototype.appendMessage =
function appendMessage(folder, data, flags, uid, callback) {
  // TODO
}

IMAPSession.prototype.copyMessages =
function copyMessages(folder, uidset, dest) {
  // TODO
}

exports.IMAPSession = IMAPSession;
