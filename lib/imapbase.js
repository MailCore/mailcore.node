/*
 * libEtPan! -- a mail stuff library
 *
 * Copyright (C) 2001, 2013 - DINH Viet Hoa
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the libEtPan! project nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHORS AND CONTRIBUTORS ``AS IS'' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHORS OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 */

"use strict";

var net = require('net');
var tls = require('tls');
var starttls = require('starttls');
var etpan = require('libetpan').etpan;
var Constants = require('libetpan').Constants;
var IMAPSet = require('./imapset').IMAPSet;
var debug = require('debug')('imapbase');

// TODO:
// idle: get result
//
// later:
// SASL
// namespace
// condstore
// qresync
// quota
// compress

function IMAPBase() {
  // * private
  // _state
  // _currentCallback
  // _appendState
  // _queue
  // _idleState
  // _socket
  // _originalSocket
  // _currentTag
  
  this._init();
}

// Public API

/*
 imap.append('Anna', 'From ...', Constants.IMAPFlagSeen, new Date(), function(error, uids) {
   // do something
 });
*/
IMAPBase.prototype.append = function(folder, messageData, flags, date, callback) {
  this._append(folder, messageData, flags, date, callback);
};

/*
 imap.connect({'hostname':'imap.gmail.com', 'port':993, 'connectionType':'ssl'}, function(error, capabilities) {
   // do something
 });
*/
IMAPBase.prototype.connect = function(connectInfo, callback) {
  this._connect(connectInfo, callback);
};

/*
 imap.login({'username':'my-login', 'password':'mypassword'}, function(error) {
   // do something
 });

 imap.login({'username':'my-login', 'password':'mypassword', 'saslType':'crammd5'}, function(error) {
   // do something
 });

 imap.login({'username':'my-login', 'token':'theoauthtoken', 'saslType':'xoauth2'}, function(error) {
   // do something
 });
*/
IMAPBase.prototype.login = function(options, callback) {
  if (options.saslType == 'xoauth2') {
    this._oauth2Authenticate(options, callback);
  }
  else if (options.saslType != null) {
    this._authenticate(options, callback);
  }
  else {
    this._login(options, callback);
  }
};

/*
 imap.logout(function(error) {
   // do something
 });
*/
IMAPBase.prototype.logout = function(callback) {
  this._logout(callback);
};

/*
 // happens synchronously.

 imap.disconnect();
*/
IMAPBase.prototype.disconnect = function() {
  this._disconnect();
};

/*
 imap.noop(function(error) {
   // do something
 });
*/
IMAPBase.prototype.noop = function(callback) {
  this._noop(callback);
};

/*
 imap.capability(function(error, capabilities) {
   // do something
 });
*/
IMAPBase.prototype.capability = function(callback) {
  this._capability(callback);
};

/*
 imap.check(function(error) {
   // do something
 });
*/
IMAPBase.prototype.check = function(callback) {
  this._check(callback);
};

/*
 imap.close(function(error) {
   // do something
 });
*/
IMAPBase.prototype.close = function(callback) {
  this._close(callback);
};

/*
 imap.expunge(function(error) {
   // do something
 });
*/
IMAPBase.prototype.expunge = function(callback) {
  this._expunge(callback);
};

/*
 imap.copy([1453, 3456], 'Anna', {}, function(error, copyInfo) {
   // do something
 });

 imap.copy([1453, 3456], 'Anna', { 'byuid': true }, function(error, copyInfo) {
   // do something
 });
*/
IMAPBase.prototype.copy = function(uids, destFolder, options, callback) {
  this._copy(uids, destFolder, options, callback);
};

/*
 imap.create('Anna', function(error) {
   // do something
 });
*/
IMAPBase.prototype.create = function(folder, callback) {
  this._create(folder, callback);
};

/*
 imap.delete('Anna', function(error) {
   // do something
 });
*/
IMAPBase.prototype.delete = function(folder, callback) {
  this._delete(folder, callback);
};

/*
 imap.rename('Anna', 'Anna Emails', function(error) {
   // do something
 });
*/
IMAPBase.prototype.rename = function(folder, otherName, callback) {
  this._rename(folder, callback);
};

/*
 imap.examine('INBOX', function(error) {
   // do something
 });
*/
IMAPBase.prototype.examine = function(folder, callback) {
  this._examine(folder, callback);
};

/*
 fetchAtt = [{type:Constants.FetchEnvelope}, {type:Constants.FetchBodySection, param:'1.2'}];
 imap.fetch(new IndexSet(1, MAX_UID), fetchAtt, {}, function(error, messages) {
   // do something
 });

 imap.fetch(new IndexSet(1, MAX_UID), fetchAtt, { 'byuid': true }, function(error, messages) {
   // do something
 });
*/
IMAPBase.prototype.fetch = function(numbers, fetchAtt, options, callback) {
  this._fetch(numbers, fetchAtt, options, callback);
};

/*
 imap.lsub(prefix, pattern, function(error, folders) {
   // do something
 });
*/
IMAPBase.prototype.lsub = function(prefix, pattern, callback) {
  this._lsub(prefix, pattern, callback);
};

/*
 imap.list(prefix, pattern, function(error, folders) {
   // do something
 });
*/
IMAPBase.prototype.list = function(prefix, pattern, callback) {
  this._list(prefix, pattern, callback);
};

/*
 imap.search('foo', searchKey, { 'charset': 'utf-8' }, function(error) {
   // do something
 });

 imap.search('foo', searchKey, { 'byuid': true }, function(error) {
   // do something
 });
*/
IMAPBase.prototype.search = function(searchKey, options, callback) {
  this._search(searchKey, options, callback);
};


/*
 imap.select(folder, function(error, folderInfos) {
   // do something
 });
*/
IMAPBase.prototype.select = function(folder, callback) {
  this._select(folder, callback);
};

/*
 imap.status('INBOX', IMAPStatusSeen | IMAPStatusMessages, function(error, folderInfos) {
   // do something
 });
*/
IMAPBase.prototype.status = function(folder, callback) {
  this._status(folder, callback);
};

/*
 msgSet = new imapset();;
 msgSet.addIndex(1453);
 msgSet.addIndex(3456);
 imap.store(msgSet, {'flags':MessageFlagDeleted, 'type':StoreAdd, 'byuid': true }, function(error) {
   // do something
 });

 imap.store(msgSet, {'gmailLabels':['mylabel'], 'type':StoreAdd, 'byuid': true }, function(error) {
   // do something
 });
*/
IMAPBase.prototype.store = function(uids, options, callback) {
  this._store(uids, options, callback);
};

/*
 imap.subscribe('Anna', function(error) {
   // do something
 });
*/
IMAPBase.prototype.subscribe = function(folder, callback) {
  this._subscribe(folder, callback);
};

/*
 imap.unsubscribe('Anna', function(error) {
   // do something
 });
*/
IMAPBase.prototype.unsubscribe = function(folder, callback) {
  this._unsubscribe(folder, callback);
};

/*
 imap.starttls(function(error) {
   // do something
 });
*/
IMAPBase.prototype.starttls = function(callback) {
  this._starttls(callback);
};

/*
 imap.idle(function(error, foldersInfo) {
   // do something
 });
*/
IMAPBase.prototype.idle = function(callback) {
  this._idle(callback);
};

IMAPBase.prototype.idleDone = function() {
  this._idleDone();
}

/*
 imap.enable([CapabilityRresync], function(error, enableEnabled) {
   // do something
 });
*/
IMAPBase.prototype.enable = function(capabilities, callback) {
  this._enable(capabilities, callback);
}

/*
 imap.id({'name': 'libetpan', 'version': '1.2'}, function(error, foldersInfo) {
   // do something
 });
*/
IMAPBase.prototype.id = function(clientInfo, callback) {
  this._id(clientInfo, callback);
};

// Private - implementation

IMAPBase.DISCONNECTED = 0;
IMAPBase.CONNECTED = 1;
IMAPBase.LOGGEDIN = 2;
IMAPBase.SELECTED = 3;

IMAPBase.prototype._init = function() {
  this._currentCallback = null;
  this._queue = [];
  this._state = IMAPBase.DISCONNECTED;
  
  this._idleState = Constants.IDLE_STATE_WAIT_NONE;
  this._originalSocket = null;
  this._currentTag = 1;
};

IMAPBase.prototype._closeSocket = function() {
  if (this._socket != null) {
    this._socket.removeAllListeners('data');
    this._socket.removeAllListeners('end');
    this._socket.removeAllListeners('error');
    this._socket.removeAllListeners('timeout');
    this._socket.destroy();
    this._socket = null;
  }
  this._state = IMAPBase.DISCONNECTED;
  
  if (this._originalSocket != null) {
    this._socket = this._originalSocket;
    this._originalSocket = null;
    this._closeSocket();
  }
};

IMAPBase.prototype._stopListening = function() {
  if (this._socket != null) {
    this._socket.removeAllListeners('data');
  }
};

IMAPBase.prototype._queueIfNeeded = function(f, args) {
  if (this._currentCallback == null) {
    debug('not queued');
    return false;
  }
  
  this._queue.push({'f':f, 'args':args});
  debug('queued');
  debug(this._queue);
  return true;
};

IMAPBase.prototype._runQueue = function() {
  if (this._queue.length == 0)
    return;
  
  var f = this._queue[0].f;
  var args = this._queue[0].args;
  this._queue.shift();
  f.apply(this, args);
};

IMAPBase.prototype._runCallback = function() {
  this._stopListening();
  if (this._currentCallback != null) {
    var currentCallback = this._currentCallback;
    this._currentCallback = null;
    currentCallback.apply(null, arguments);
  }
  
  this._runQueue();
};

IMAPBase.prototype._closeSocketWithError = function(error) {
  debug('close socket');
  this._closeSocket();
  
  this._runCallback(error);
}

IMAPBase.prototype._connect = function(connectInfo, callback) {
  if (this._queueIfNeeded(this._connect, arguments)) {
    return;
  }
  
  if (this._state != IMAPBase.DISCONNECTED) {
    var error = new Error('Already connected');
    error.type = 'state_error';
    callback(error);
    return
  }
  
  debug(connectInfo);
  
  this._buffer = new Buffer(0);
  if ((connectInfo.connectionType == null) || (connectInfo.connectionType == Constants.ConnectionClear)) {
    this._socket = net.connect({
      'port':connectInfo.port,
      'host':connectInfo.hostname,
    }, this._connected.bind(this, callback));
  }
  else if (connectInfo.connectionType == Constants.ConnectionSSL || connectInfo.connectionType == 'ssl') {
    this._socket = tls.connect({
      'port':connectInfo.port,
      'host':connectInfo.hostname,
    }, this._connected.bind(this, callback));
  }
  this._currentCallback = callback;

  this._socket.on('data', function(data) {
    debug(data.toString());
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_GREETING);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      this._state = IMAPBase.CONNECTED;
      debug('cap');
      var capabilities = r.getCapabilitiesFromResponse();
      debug('cap: ' + capabilities);
      this._runCallback(null, capabilities);
    }
    else {
      var error = new Error('Stream error');
      error.type = 'stream_error';
      this._closeSocketWithError(error);
    }
  }.bind(this));
  
  this._socket.on('end', function() {
    var error = new Error('Connection closed');
    error.type = 'stream_error';
    this._closeSocketWithError(error);
  }.bind(this));
  
  this._socket.on('error', function() {
    var error = new Error('Stream error');
    error.type = 'stream_error';
    this._closeSocketWithError(error);
  }.bind(this));
  
  this._socket.on('timeout', function() {
    var error = new Error('Stream error');
    error.type = 'stream_error';
    this._closeSocketWithError(error);
  }.bind(this));
};

IMAPBase.prototype._connected = function(callback) {
  debug('socket connected');
};

IMAPBase.prototype._login = function(options, callback) {
  if (this._queueIfNeeded(this._login, arguments)) {
    return;
  }
  
  if (this._state != IMAPBase.CONNECTED) {
    var error;
    if (this._state == IMAPBase.DISCONNECTED) {
      error = new Error('Not connected');
    }
    else  {
      error = new Error('Already logged in');
    }
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' login ' + options.username + ' ' + options.password + '\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      this._state = IMAPBase.LOGGEDIN;
      debug('logged in');
      var capabilities = r.getCapabilitiesFromResponse();
      this._runCallback(null, capabilities);
    }
    else {
      var error = new Error('Authentication error');
      error.type = 'auth_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._oauth2Authenticate = function(options, callback) {
  if (this._queueIfNeeded(this._oauth2Authenticate, arguments)) {
    return;
  }
  
  if (this._state != IMAPBase.CONNECTED) {
    var error;
    if (this._state == IMAPBase.DISCONNECTED) {
      error = new Error('Not connected');
    }
    else  {
      error = new Error('Already logged in');
    }
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  var authenticationToken = new Buffer('user=' + options.username + '\u0001auth=Bearer ' + options.token + '\u0001\u0001').toString('base64');
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' authenticate XOAUTH2 ' + this.authenticationToken + '\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      this._state = IMAPBase.LOGGEDIN;
      debug('logged in');
      this._runCallback(null);
    }
    else {
      var error = new Error('Authentication error');
      error.type = 'auth_error';
      this._runCallback(error);
    }
  }.bind(this));
};

// TODO: SASL
IMAPBase.prototype._authenticate = function(options, callback) {
  if (this._queueIfNeeded(this._authenticate, arguments)) {
    return;
  }
  
  if (this._state != IMAPBase.CONNECTED) {
    var error;
    if (this._state == IMAPBase.DISCONNECTED) {
      error = new Error('Not connected');
    }
    else  {
      error = new Error('Already logged in');
    }
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  //this._socket.write('01 authenticate XOAUTH2 ' + this.authenticationToken + '\r\n', 'utf8');
  this._currentCallback = callback;
  
  var error = new Error('Not implemented');
  error.type = 'auth_error';
  this._runCallback(error);
};

IMAPBase.prototype._select = function(folder, callback) {
  if (this._queueIfNeeded(this._select, arguments)) {
    return;
  }
  
  if ((this._state == IMAPBase.CONNECTED) || (this._state == IMAPBase.DISCONNECTED)) {
    var error;
    if (this._state == IMAPBase.DISCONNECTED) {
      error = new Error('Not connected');
    }
    else {
      error = new Error('Not logged in');
    }
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' select ' + this._toQuotedString(folder) + '\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('selected');
      this._state = IMAPBase.SELECTED;
      var info = r.getSelectResponseFromResponse();
      this._runCallback(null, info);
    }
    else {
      var error = new Error('select error');
      error.type = 'select_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._logout = function(callback) {
  if (this._queueIfNeeded(this._logout, arguments)) {
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' logout\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('logged out');
      this._closeSocketWithError(null);
    }
    else {
      var error = new Error('logout error');
      error.type = 'logout_error';
      this._runCallback(error);
    }
  }.bind(this));
}

IMAPBase.prototype._disconnect = function() {
  this._closeSocketWithError(null);
}

IMAPBase.prototype._noop = function(callback) {
  if (this._queueIfNeeded(this._noop, arguments)) {
    return;
  }
  
  if (this._state == IMAPBase.DISCONNECTED) {
    var error = new Error('Not connected');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' noop\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('noop done');
      var info = r.getNoopResponseFromResponse();
      this._runCallback(null, info);
    }
    else {
      var error = new Error('select error');
      error.type = 'auth_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._lsub = function(prefix, pattern, callback) {
  if (this._queueIfNeeded(this._lsub, arguments)) {
    return;
  }

  if ((this._state == IMAPBase.DISCONNECTED) || (this._state == IMAPBase.CONNECTED)) {
    var error = new Error('Not logged in');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' lsub ' + this._toQuotedString(prefix) + ' ' + this._toQuotedString(pattern) + '\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;

  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    debug(r);
    
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
      debug('needs more data?');
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('parsed');
      var folders = r.getFoldersFromResponseLsub();
      this._runCallback(null, folders);
    }
    else {
      var error = new Error('Fetch folders error');
      error.type = 'list_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._list = function(prefix, pattern, callback) {
  if (this._queueIfNeeded(this._list, arguments)) {
    return;
  }

  if ((this._state == IMAPBase.DISCONNECTED) || (this._state == IMAPBase.CONNECTED)) {
    var error = new Error('Not logged in');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' list ' + this._toQuotedString(prefix) + ' ' + this._toQuotedString(pattern) + '\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;

  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    debug(this._buffer.toString());
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    debug(r);
    
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
      debug('needs more data?');
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('parsed');
      var folders = r.getFoldersFromResponseList();
      this._runCallback(null, folders);
    }
    else {
      var error = new Error('Fetch folders error');
      error.type = 'list_error';
      this._runCallback(error);
    }
  }.bind(this));
};

Constants.APPEND_STATE_WAITING_CONT_REQ = 0;
Constants.APPEND_STATE_WAITING_RESPONSE = 1;

IMAPBase.prototype._append = function(prefix, pattern, callback) {
  if (this._queueIfNeeded(this._append, arguments)) {
    return;
  }

  if ((this._state == IMAPBase.DISCONNECTED) || (this._state == IMAPBase.CONNECTED)) {
    var error = new Error('Not logged in');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._appendState = Constants.APPEND_STATE_WAITING_CONT_REQ;
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' append ' + this._toQuotedString(folder) + ' (\Seen) {' + messageData.length + '}\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    
    if (this._appendState == Constants.APPEND_STATE_WAITING_CONT_REQ) {
      debug('append: cont req');
      var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE | Constants.PARSER_CONT_REQ);
      debug(r);
      
      if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
        // Wait for more data.
        debug('needs more data?');
      }
      else if (r.result == Constants.MAILIMAP_NO_ERROR) {
        if (r.type == Constants.PARSER_CONT_REQ) {
          // ok to append the message
          this._buffer = new Buffer(0);
          this._socket.write(messageData);
          this._socket.write('\r\n');
        }
        else if (r.type == Constants.PARSER_ENABLE_RESPONSE) {
          var error = new Error('append error');
          error.type = 'append_error';
          this._runCallback(error);
        }
      }
      else {
        var error = new Error('Data probably too large');
        error.type = 'append_error';
        this._runCallback(error);
      }
    }
    else if (this._appendState == Constants.APPEND_STATE_WAITING_RESPONSE) {
      debug('append: wait for response');
      var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
      debug(r);
      
      if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
        // Wait for more data.
        debug('needs more data?');
      }
      else if (r.result == Constants.MAILIMAP_NO_ERROR) {
        var uids = r.getUIDPlusAppendResponseFromResponse();
        this._runCallback(null, uids);
      }
      else {
        var error = new Error('Append error');
        error.type = 'append_error';
        this._runCallback(error);
      }
    }
  }.bind(this));
}

IMAPBase.prototype._fetchTypeToString = function(fetchType) {
  if (typeof fetchType == 'number') {
    switch (fetchType) {
    case Constants.FetchTypeEnvelope:
      return "ENVELOPE";
    case Constants.FetchTypeFlags:
      return "FLAGS";
    case Constants.FetchTypeInternalDate:
      return "INTERNALDATE";
    case Constants.FetchTypeRFC822:
      return "RFC822";
    case Constants.FetchTypeRFC822Header:
      return "RFC822.HEADER";
    case Constants.FetchTypeRFC822Size:
      return "RFC822.SIZE";
    case Constants.FetchTypeRFC822Text:
      return "RFC822.TEXT";
    case Constants.FetchTypeBody:
      return "BODY";
    case Constants.FetchTypeBodyStructure:
      return "BODYSTRUCTURE";
    case Constants.FetchTypeUID:
      return "UID";
    case Constants.FetchTypeModSeq:
      return "MODSEQ";
    case Constants.FetchTypeGmailThreadID:
      return "X-GM-THRID";
    case Constants.FetchTypeGmailMessageID:
      return "X-GM-MSGID";
    case Constants.FetchTypeGmailLabels:
      return "X-GM-LABELS";
    }
  }
  else {
    switch (fetchType.type) {
    case Constants.FetchTypeBodySection:
      return "BODY[" + fetchType.section + "]";
    case Constants.FetchTypeBodyPeekSection:
      return "BODY.PEEK[" + fetchType.section + "]";
    default:
      return this._fetchTypeToString(fetchType.type);
    }
  }
}

IMAPBase.prototype._fetchAttToString = function(fetchAtt) {
  if (fetchAtt instanceof Array) {
    var fetchString = '';
    fetchAtt.forEach(function(item, index) {
      if (fetchString != '') {
        fetchString += ' ';
      }
      //debug('fetchatt: ' + item);
      fetchString += this._fetchTypeToString(item);
    }.bind(this));
    return fetchString;
  }
  else if (typeof fetchAtt == 'number') {
    switch (fetchAtt) {
    case Constants.FetchTypeAll:
      return "ALL";
    case Constants.FetchTypeFull:
      return "FULL";
    case Constants.FetchTypeFast:
      return "FAST";
    default:
      return this._fetchTypeToString(fetchAtt);
    }
  }
  else { // is object
    return this._fetchTypeToString(fetchAtt);
  }
};

IMAPBase.prototype._indexSetToString = function(imapset) {
  var imapSetString = '';
  imapset.forEachRange(function(left, right) {
    if (imapSetString != '') {
      imapSetString += ',';
    }
    if (left == 0) {
      imapSetString += '*';
    }
    else {
      imapSetString += left;
    }
    
    if (left != right) {
      if (right == 0) {
        imapSetString += ':*';
      }
      else {
        imapSetString += ':' + right;
      }
    }
  });
  return imapSetString;
}

IMAPBase.prototype._fetch = function(numbers, fetchAtt, options, callback) {
  if (this._queueIfNeeded(this._fetch, arguments)) {
    return;
  }
  
  if (this._state != IMAPBase.SELECTED) {
    var error = new Error('Not selected');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  if (options.byuid) {
    this._socket.write(this._currentTag + ' uid fetch ' + this._indexSetToString(numbers) + ' (' + this._fetchAttToString(fetchAtt) + ')\r\n', 'utf8');
  }
  else {
    this._socket.write(this._currentTag + ' fetch ' + this._indexSetToString(numbers) + ' (' + this._fetchAttToString(fetchAtt) + ')\r\n', 'utf8');
  }
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    //debug(data.toString());
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('fetch done: ' + this._currentCallback);
      var items = r.getFetchItemsFromResponse();
      //debug(items);
      this._runCallback(null, items);
    }
    else {
      var error = new Error('fetch error');
      error.type = 'fetch_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._capability = function(callback) {
  if (this._queueIfNeeded(this._capability, arguments)) {
    return;
  }
  
  if (this._state == IMAPBase.DISCONNECTED) {
    var error = new Error('Not connected');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' capability\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('capabilities done: ' + this._currentCallback);
      var capabilities = r.getCapabilitiesFromResponse();
      this._runCallback(null, capabilities);
    }
    else {
      var error = new Error('capabilities error');
      error.type = 'capability_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._check = function(callback) {
  if (this._queueIfNeeded(this._check, arguments)) {
    return;
  }
  
  if (this._state != IMAPBase.SELECTED) {
    var error = new Error('No folder selected');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' check\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('check done: ' + this._currentCallback);
      this._runCallback(null);
    }
    else {
      var error = new Error('check error');
      error.type = 'check_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._close = function(callback) {
  if (this._queueIfNeeded(this._close, arguments)) {
    return;
  }
  
  if (this._state != IMAPBase.SELECTED) {
    var error = new Error('No folder selected');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' close\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('close done: ' + this._currentCallback);
      this._runCallback(null);
    }
    else {
      var error = new Error('close error');
      error.type = 'close_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._expunge = function(callback) {
  if (this._queueIfNeeded(this._expunge, arguments)) {
    return;
  }
  
  if (this._state != IMAPBase.SELECTED) {
    var error = new Error('No folder selected');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' expunge\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('expunge done: ' + this._currentCallback);
      this._runCallback(null);
    }
    else {
      var error = new Error('expunge error');
      error.type = 'expunge_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._copy = function(uids, destFolder, options, callback) {
  if (this._queueIfNeeded(this._copy, arguments)) {
    return;
  }
  
  if (this._state != IMAPBase.SELECTED) {
    var error = new Error('No folder selected');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  if (options.byuid) {
    this._socket.write(this._currentTag + ' uid copy ' + this._indexSetToString(uids) + ' ' + this._toQuotedString(destFolder) + '\r\n', 'utf8');
  }
  else {
    this._socket.write(this._currentTag + ' copy ' + this._indexSetToString(uids) + ' ' + this._toQuotedString(destFolder) + '\r\n', 'utf8');
  }
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('copy done: ' + this._currentCallback);
      var copyResponse = getUIDPlusCopyResponseFromResponse(r);
      var uids  = new IMAPSet();
      uids.setRanges(copyResponse.sourceUids);
      copyResponse.sourceUids = uids;
      uids  = new IMAPSet();
      uids.setRanges(copyResponse.destUids);
      copyResponse.destUids = uids;
      this._runCallback(null, copyResponse);
    }
    else {
      var error = new Error('copy error');
      error.type = 'copy_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._create = function(folder, callback) {
  if (this._queueIfNeeded(this._create, arguments)) {
    return;
  }
  
  if ((this._state == IMAPBase.DISCONNECTED) || (this._state == IMAPBase.CONNECTED)) {
    var error = new Error('Not logged in');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' create ' + this._toQuotedString(folder) + '\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('create done: ' + this._currentCallback);
      this._runCallback(null);
    }
    else {
      var error = new Error('create error');
      error.type = 'create_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._delete = function(folder, callback) {
  if (this._queueIfNeeded(this._delete, arguments)) {
    return;
  }
  
  if ((this._state == IMAPBase.DISCONNECTED) || (this._state == IMAPBase.CONNECTED)) {
    var error = new Error('Not logged in');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' delete ' + this._toQuotedString(folder) + '\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('delete done: ' + this._currentCallback);
      this._runCallback(null);
    }
    else {
      var error = new Error('delete error');
      error.type = 'delete_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._rename = function(folder, otherName, callback) {
  if (this._queueIfNeeded(this._rename, arguments)) {
    return;
  }
  
  if ((this._state == IMAPBase.DISCONNECTED) || (this._state == IMAPBase.CONNECTED)) {
    var error = new Error('Not logged in');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' rename ' + this._toQuotedString(folder) + ' ' + this._toQuotedString(otherName) + '\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('rename done: ' + this._currentCallback);
      this._runCallback(null);
    }
    else {
      var error = new Error('rename error');
      error.type = 'rename_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._examine = function(folder, callback) {
  if (this._queueIfNeeded(this._examine, arguments)) {
    return;
  }
  
  if ((this._state == IMAPBase.CONNECTED) || (this._state == IMAPBase.DISCONNECTED)) {
    var error;
    if (this._state == IMAPBase.DISCONNECTED) {
      error = new Error('Not connected');
    }
    else {
      error = new Error('Not logged in');
    }
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' examine ' + this._toQuotedString(folder) + '\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('selected');
      this._state = IMAPBase.SELECTED;
      var info = r.getSelectResponseFromResponse();
      this._runCallback(null, info);
    }
    else {
      var error = new Error('examine error');
      error.type = 'select_error';
      this._runCallback(error);
    }
  }.bind(this));
};

// ALL
// ANSWERED
// BCC string
// DELETED
// DRAFT
// FLAGGED
// FROM string
// HEADER field-name string
// KEYWORD flag
// LARGER n
// NEW
// NOT search-key
// OLD
// ON date
// OR search-key1 search-key2
// RECENT
// SEEN
// SENTBEFORE date
// SENTON date
// SENTSINCE date
// SINCE date
// SMALLER n
// SUBJECT string
// TEXT string
// TO string
// UID sequence-set
// UNANSWERED
// UNDELETED
// UNDRAFT
// UNFLAGGED
// UNKEYWORD flag
// UNSEEN

IMAPBase.prototype._singleSearchKeyToString = function(searchKey) {
  switch (searchKey.type) {
    case 'sequence': {
      return this._indexSetToString(searchKey.value);
    }
    case 'all': {
      return 'ALL';
    }
    case 'answered': {
      return 'ANSWERED';
    }
    case 'bcc': {
      return 'BCC ' + this._toQuotedString(searchKey.value);
    }
    case 'deleted': {
      return 'DELETED';
    }
    case 'draft': {
      return 'DRAFT';
    }
    case 'flagged': {
      return 'FLAGGED';
    }
    case 'from': {
      return 'FROM ' + this._toQuotedString(searchKey.value);
    }
    case 'header': {
      return 'HEADER ' + this._toQuotedString(searchKey.header) + ' ' + this._toQuotedString(searchKey.value);
    }
    case 'keyword': {
      return 'KEYWORD ' + searchKey.value;
    }
    case 'larger': {
      return 'LARGER ' + searchKey.value;
    }
    case 'new': {
      return 'NEW';
    }
    case 'not': {
      return 'NOT ' + this._searchKeyToString(searchKey.value, true);
    }
    case 'old': {
      return 'OLD';
    }
    case 'on': {
      return 'ON ' + this._dateToString(searchKey.value)
    }
    case 'or': {
      return 'OR ' + this._searchKeyToString(searchKey.left, true) + ' ' + this._searchKeyToString(searchKey.right, true);
    }
    case 'recent': {
      return 'RECENT';
    }
    case 'seen': {
      return 'SEEN';
    }
    case 'sentbefore': {
      return 'SENTBEFORE ' + this._dateToString(searchKey.value)
    }
    case 'senton': {
      return 'SENTON ' + this._dateToString(searchKey.value)
    }
    case 'sentsince': {
      return 'SENTSINCE ' + this._dateToString(searchKey.value)
    }
    case 'since': {
      return 'SINCE ' + this._dateToString(searchKey.value)
    }
    case 'smaller': {
      return 'SMALLER ' + this._dateToString(searchKey.value)
    }
    case 'subject': {
      return 'SUBJECT ' + this._toQuotedString(searchKey.value);
    }
    case 'text': {
      return 'TEXT ' + this._toQuotedString(searchKey.value);
    }
    case 'to': {
      return 'TO ' + this._toQuotedString(searchKey.value);
    }
    case 'uid': {
      return 'UID ' + this._indexSetToString(searchKey.value);
    }
    case 'unanswered': {
      return 'UNANSWERED';
    }
    case 'undeleted': {
      return 'UNDELETED';
    }
    case 'undraft': {
      return 'UNDRAFT';
    }
    case 'unseen': {
      return 'UNSEEN';
    }
  }
};

var monthStrArray = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

IMAPBase.prototype._dateToString = function(date) {
  var monthStr = monthStrArray[date.getMonth()];
  return date.getDate() + '-' + monthStr + '-' + date.getFullYear();
};

IMAPBase.prototype._searchKeyToString = function(searchKey, needsParenthesis) {
  if (searchKey instanceof Array) {
    var result = '';
    var first = true;
    if (needsParenthesis) {
      result += '(';
    }
    searchKey.forEach(function(item) {
      if (first) {
        first = false;
      }
      else {
        result += ' ';
      }
      result += this._searchKeyToString(item);
    });
    if (needsParenthesis) {
      result += ')';
    }
  }
  else {
    return this._singleSearchKeyToString(searchKey);
  }
};

IMAPBase.prototype._search = function(searchKey, options, callback) {
  if (this._queueIfNeeded(this._search, arguments)) {
    return;
  }
  
  if (this._state != IMAPBase.SELECTED) {
    var error = new Error('Not logged in');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  var searchParam = '';
  if (options.charset != null) {
    searchParam += 'CHARSET ' + this._toQuotedString(options.charset);
  }
  if (searchParam.length != 0) {
    searchParam += ' ';
  }
  searchParam += this._searchKeyToString(searchKey, true);
  
  this._buffer = new Buffer(0);
  if (options.byuid) {
    this._socket.write(this._currentTag + ' uid search ' + searchParam + '\r\n', 'utf8');
  }
  else {
    this._socket.write(this._currentTag + ' search ' + searchParam + '\r\n', 'utf8');
  }
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    //debug(data.toString());
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      var items = r.getSearchResponseFromResponse();
      this._runCallback(null, items);
    }
    else {
      var error = new Error('search error');
      error.type = 'search_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._status = function(folder, callback) {
  if (this._queueIfNeeded(this._status, arguments)) {
    return;
  }
  
  if ((this._state == IMAPBase.CONNECTED) || (this._state == IMAPBase.DISCONNECTED)) {
    var error;
    if (this._state == IMAPBase.DISCONNECTED) {
      error = new Error('Not connected');
    }
    else {
      error = new Error('Not logged in');
    }
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' status ' + this._toQuotedString(folder) + ' (messages recent uidnext uidvalidity unseen highestmodseq)\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    debug(data.toString());
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      debug('status');
      var statusInfo = r.getStatusResponseFromResponse();
      this._runCallback(null, statusInfo);
    }
    else {
      var error = new Error('status error');
      error.type = 'status_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._flagsToString = function(flags) {
  var result = '';
  
  if ((flags & Constants.MessageFlagSeen) != 0) {
    result += ' \\Seen';
  }
  if ((flags & Constants.MessageFlagAnswered) != 0) {
    result += ' \\Answered';
  }
  if ((flags & Constants.MessageFlagFlagged) != 0) {
    result += ' \\Flagged';
  }
  if ((flags & Constants.MessageFlagDeleted) != 0) {
    result += ' \\Deleted';
  }
  if ((flags & Constants.MessageFlagDraft) != 0) {
    result += ' \\Draft';
  }
  if ((flags & Constants.MessageFlagMDNSent) != 0) {
    result += ' $MDNSent';
  }
  if ((flags & Constants.MessageFlagForwarded) != 0) {
    result += ' $Forwarded';
  }
  if ((flags & Constants.MessageFlagSubmitPending) != 0) {
    result += ' $SubmitPending';
  }
  if ((flags & Constants.MessageFlagSubmitted) != 0) {
    result += ' $Submitted';
  }
  
  return result.substr(1);
};

IMAPBase.prototype._labelsToString = function(labels) {
  var result = '';
  if (fetchAtt instanceof Array) {
    labels.forEach(function(item) {
      if (result.length != 0) {
        result += ' ';
      }
      result += this._toQuotedString(item);
    });
  }
  else {
  }
  result += this._toQuotedString(labels);
  return labels;
};

IMAPBase.prototype._store = function(uids, options, callback) {
  if (this._queueIfNeeded(this._store, arguments)) {
    return;
  }
  
  if (this._state != IMAPBase.SELECTED) {
    var error = new Error('Not logged in');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  var paramString = '';
  if (options.flags != null) {
    if (options.type == Constants.StoreAdd) {
      paramString = '+FLAGS.SILENT';
    }
    else if (options.type == Constants.StoreSet) {
      paramString = 'FLAGS.SILENT';
    }
    else if (options.type == Constants.StoreRemove) {
      paramString = '-FLAGS.SILENT';
    }
    paramString += ' (' + this._flagsToString(options.flags) + ')';
  }
  else if (options.gmailLabels != null) {
    if (options.type == Constants.StoreAdd) {
      paramString = '+X-GM-LABELS.SILENT';
    }
    else if (options.type == Constants.StoreSet) {
      paramString = 'X-GM-LABELS.SILENT';
    }
    else if (options.type == Constants.StoreRemove) {
      paramString = '-X-GM-LABELS.SILENT';
    }
    paramString += ' (' + this._labelsToString(options.labels) + ')';
  }
  if (options.byuid) {
    this._socket.write(this._currentTag + ' uid store ' + this._indexSetToString(numbers) + ' ' + paramString + '\r\n', 'utf8');
  }
  else {
    this._socket.write(this._currentTag + ' store ' + this._indexSetToString(numbers) + ' ' + paramString + '\r\n', 'utf8');
  }
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      this._runCallback(null, items);
    }
    else {
      var error = new Error('store error');
      error.type = 'store_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._subscribe = function(folder, callback) {
  if (this._queueIfNeeded(this._subscribe, arguments)) {
    return;
  }
  
  if ((this._state == IMAPBase.CONNECTED) || (this._state == IMAPBase.DISCONNECTED)) {
    var error;
    if (this._state == IMAPBase.DISCONNECTED) {
      error = new Error('Not connected');
    }
    else {
      error = new Error('Not logged in');
    }
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' subscribe ' + this._toQuotedString(folder) + '\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      this._runCallback(null);
    }
    else {
      var error = new Error('subscribe error');
      error.type = 'subscribe_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._unsubscribe = function(folder, callback) {
  if (this._queueIfNeeded(this._unsubscribe, arguments)) {
    return;
  }
  
  if ((this._state == IMAPBase.CONNECTED) || (this._state == IMAPBase.DISCONNECTED)) {
    var error;
    if (this._state == IMAPBase.DISCONNECTED) {
      error = new Error('Not connected');
    }
    else {
      error = new Error('Not logged in');
    }
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' unsubcribe ' + this._toQuotedString(folder) + '\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      this._runCallback(null);
    }
    else {
      var error = new Error('unsubscribe error');
      error.type = 'subscribe_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._starttls = function(callback) {
  if (this._queueIfNeeded(this._starttls, arguments)) {
    return;
  }
  
  if (this._state != IMAPBase.CONNECTED) {
    var error;
    if (this._state == IMAPBase.DISCONNECTED) {
      error = new Error('Not connected');
    }
    else  {
      error = new Error('Already logged in');
    }
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' starttls\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      this._stopListening();
      this._switchConnectionToSSL()
    }
    else {
      var error = new Error('STARTTLS not available');
      error.type = 'starttls_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._switchConnectionToSSL = function() {
  var securePair = starttls.startTls(this._socket, function() {
    this._originalSocket = this._socket;
    this._socket = securePair.cleartext;
    this._runCallback(null);
  }.bind(this)); 
};

Constants.IDLE_STATE_WAIT_NONE = -1;
Constants.IDLE_STATE_WAIT_CONT_REQ = 0;
Constants.IDLE_STATE_WAIT_RESPONSE = 1;
Constants.IDLE_STATE_GOT_DATA = 2;
Constants.IDLE_STATE_CANCELLED = 3;

IMAPBase.prototype._idle = function(callback) {
  if (this._queueIfNeeded(this._idle, arguments)) {
    return;
  }
  
  if (this._state != IMAPBase.SELECTED) {
    var error = new Error('Not logged in');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  if (this._idleState != Constants.IDLE_STATE_WAIT_NONE) {
    var error = new Error('Already idling');
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  this._socket.write(this._currentTag + ' idle\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  this._idleState = Constants.IDLE_STATE_WAIT_CONT_REQ;
  
  this._socket.on('data', function(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    if (this._idleState == Constants.IDLE_STATE_WAIT_CONT_REQ) {
      debug('try parse cont req');
      var r = etpan.responseParse(this._buffer, Constants.PARSER_CONT_REQ);
      if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
        // Wait for more data.
      }
      else if (r.result == Constants.MAILIMAP_NO_ERROR) {
        //this._runCallback(null, items);
        if (r.hasIdleData) {
          this._socket.write('done\r\n', 'utf8');
          this._idleState = Constants.IDLE_STATE_GOT_DATA;
        }
        else {
          this._idleState = Constants.IDLE_STATE_WAIT_RESPONSE;
        }
      }
      else {
        var error = new Error('idle error');
        error.type = 'idle_error';
        this._runCallback(error);
      }
    }
    else if (this._idleState == Constants.IDLE_STATE_WAIT_RESPONSE) {
      this._idleState = Constants.IDLE_STATE_GOT_DATA;
      this._socket.write('done\r\n', 'utf8');
      
      var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
      if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
        // Wait for more data.
      }
      else if (r.result == Constants.MAILIMAP_NO_ERROR) {
        this._idleState = Constants.IDLE_STATE_WAIT_NONE;
        this._runCallback(null);
      }
      else {
        var error = new Error('idle error');
        error.type = 'idle_error';
        this._runCallback(error);
      }
    }
    else if (this._idleState == Constants.IDLE_STATE_GOT_DATA) {
      var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
      if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
        // Wait for more data.
      }
      else if (r.result == Constants.MAILIMAP_NO_ERROR) {
        this._idleState = Constants.IDLE_STATE_WAIT_NONE;
        this._runCallback(null);
      }
      else {
        var error = new Error('idle error');
        error.type = 'idle_error';
        this._runCallback(error);
      }
    }
    else if (this._idleState == Constants.IDLE_STATE_CANCELLED) {
      debug('cancelled');
      var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
      if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
        // Wait for more data.
      }
      else if (r.result == Constants.MAILIMAP_NO_ERROR) {
        this._idleState = Constants.IDLE_STATE_WAIT_NONE;
        this._runCallback(null);
      }
      else {
        var error = new Error('idle error');
        error.type = 'idle_error';
        this._runCallback(error);
      }
    }
  }.bind(this));
};

IMAPBase.prototype._idleDone = function() {
  if (this._idleState == Constants.IDLE_STATE_WAIT_NONE) {
    // Was not idling
    return false;
  }
  
  if (this._idleState == Constants.IDLE_STATE_WAIT_RESPONSE) {
    this._idleState = Constants.IDLE_STATE_CANCELLED;
    this._socket.write('done\r\n', 'utf8');
  }
  
  return true;
};

IMAPBase.prototype._capabilitiesToString = function(capabilities) {
  var capString = '';
  capabilities.forEach(function(item, idx) {
    var capItemString = '';
    if (item == Constants.CapabilityCondstore) {
      capItemString = 'CONDSTORE';
    }
    else if (item == Constants.CapabilityQResync) {
      capItemString = 'QRESYNC';
    }
    if (capString.length == 0) {
      capString = capItemString;
    }
    else {
      capString += ' ' + capItemString;
    }
  });
  
  return capString;
};

IMAPBase.prototype._enable = function(capabilities, callback) {
  if (this._queueIfNeeded(this._enable, arguments)) {
    return;
  }
  
  if ((this._state == IMAPBase.CONNECTED) || (this._state == IMAPBase.DISCONNECTED)) {
    var error;
    if (this._state == IMAPBase.DISCONNECTED) {
      error = new Error('Not connected');
    }
    else {
      error = new Error('Not logged in');
    }
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  debug(capabilities);
  debug(this._currentTag + ' enable ' + this._capabilitiesToString(capabilities));
  this._currentTag ++;
  this._socket.write('02 enable ' + this._capabilitiesToString(capabilities) + '\r\n', 'utf8');
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    debug(data.toString());
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      this._runCallback(null);
    }
    else {
      var error = new Error('enable error');
      error.type = 'enable_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._clientInfoToString = function(clientInfo) {
  var allKeys = Object.keys(clientInfo);
  if (allKeys.length == 0) {
    return 'NIL';
  }
  
  var result = '';
  allKeys.forEach(function(item, idx) {
    if (result.length == 0) {
      result = '(';
    }
    else {
      result += ' ';
    }
    
    result += this._toQuotedString(item) + ' ' + this._toQuotedString(clientInfo[item]);
  }.bind(this));
  if (result.length != 0) {
    result += ')';
  }
  
  return result;
};

IMAPBase.prototype._id = function(clientInfo, callback) {
  if (this._queueIfNeeded(this._id, arguments)) {
    return;
  }
  
  if ((this._state == IMAPBase.CONNECTED) || (this._state == IMAPBase.DISCONNECTED)) {
    var error;
    if (this._state == IMAPBase.DISCONNECTED) {
      error = new Error('Not connected');
    }
    else {
      error = new Error('Not logged in');
    }
    error.type = 'state_error';
    callback(error);
    return;
  }
  
  this._buffer = new Buffer(0);
  debug(this._clientInfoToString(clientInfo));
  this._socket.write(this._currentTag + ' id ' + this._clientInfoToString(clientInfo) + '\r\n', 'utf8');
  this._currentTag ++;
  this._currentCallback = callback;
  
  this._socket.on('data', function(data) {
    debug(data.toString());
    this._buffer = Buffer.concat([this._buffer, data]);
    var r = etpan.responseParse(this._buffer, Constants.PARSER_ENABLE_RESPONSE);
    if (r.result == Constants.MAILIMAP_ERROR_NEEDS_MORE_DATA) {
      // Wait for more data.
    }
    else if (r.result == Constants.MAILIMAP_NO_ERROR) {
      var serverInfo = r.getIDResponseFromResponse();
      this._runCallback(null, serverInfo);
    }
    else {
      var error = new Error('id error');
      error.type = 'id_error';
      this._runCallback(error);
    }
  }.bind(this));
};

IMAPBase.prototype._toQuotedString = function(value) {
  value = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return '"' + value + '"';
};

exports.IMAPBase = IMAPBase;
