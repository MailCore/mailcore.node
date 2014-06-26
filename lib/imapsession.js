"use strict"

var util = require('util');
var EE = require('events').EventEmitter;
var Constants = require('libetpan').Constants;
var IMAPBase = require('./imapbase').IMAPBase;
var IMAPSet = require('./imapset').IMAPSet;

util.inherits(IMAPSession, EE);
function IMAPSession(port, hostname, option) {
  if (!(this instanceof IMAPSession)) {
    return new IMAPSession(arguments);
  }
  var args = normalize(arguments);
  if (!args.hostname) {
    throw new Error('hostname required');
  }
  this.connectionInfo = {
    port: args.port,
    hostname: args.hostname,
    connectionType: args.option.secure || null
  };
  var authOption = args.option.auth;
  if (!authOption.username) {
    throw new Error('user required in authenticate');
  }
  if (!authOption.password) {
    this.auth = {
      saslType: IMAPSession.AuthTypes.XOAUTH2,
      username: authOption.username,
      token: authOption.accessToken
    };
  } else {
    this.auth = {
      saslType: IMAPSession.AuthTypes.PLAIN,
      username: authOption.username,
      password: authOption.password
    };
  }

  EE.call(this);
  this.base = new IMAPBase();
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

IMAPSession.AuthTypes = {
  PLAIN: null,
  XOAUTH2: 'xoauth2'
};

IMAPSession.prototype.connect = function(callback) {
  this.base.connect(this.connectionInfo, onconnect.bind(this));
  function onconnect() {
    var self = this;
    this.base.login(this.auth, function(err) {
      if (err) {
        self.emit('error', err);
      } else {
        self.emit('connect');
        callback();
      }
    });
  }
}

IMAPSession.prototype.disconnect = function(callback) {
  this.base.logout(callback);
  this.emit('disconnect');
  this.removeAllListeners();
  delete this.base;
}

IMAPSession.prototype.select = function(folder, callback) {
  this.base.select(folder, this.makeTrigger(callback));
}

IMAPSession.prototype.fetchMessagesByNumber = function(start, end, option, callback) {
  var numbers = new IMAPSet(start, end);
  var option = option || Constants.FetchTypeAll;
  this.base.fetch(numbers, option, {}, this.makeTrigger(callback));
}

IMAPSession.prototype.fetchMessagesByUID = function(start, end, option, callback) {
  var numbers = new IMAPSet(start, end);
  var option = option || Constants.FetchTypeAll;
  this.base.fetch(numbers, option, {'byUID':true}, this.makeTrigger(callback));
}

IMAPSession.prototype.search = function(query, callback) {
  this.base.search(query, this.makeTrigger(callback));
}

IMAPSession.prototype.appendMessage = function(folder, data, flags, date, callback) {
  this.base.appendMessage(folder, data, flags, date, this.makeTrigger(callback));
}

IMAPSession.prototype.copyMessages = function(uids, dest, options, callback) {
  this.base.copy(uids, dest, options, this.makeTrigger(callback));
}

IMAPSession.prototype.makeTrigger = function(callback) {
  var self = this;
  return function(err, result) {
    if (err)
      return self.emit('error', err);
    else
      return callback(result);
  }
}

exports.IMAPSession = IMAPSession;
