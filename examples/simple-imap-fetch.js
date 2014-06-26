
var IMAPSession = require('./lib/imap').IMAPSession;
var imap = new IMAPSession(993, 'imap.gmail.com', {
  secure: 'tls',
  auth: {
    username: 'yorkiefixer@gmail.com',
    password: 'xxxxxxxxx'
  }
});

imap.connect();
imap.on('error', function(err) {
  throw err;
});
imap.on('connect', function() {
  console.log('connected');
  imap.select('INBOX', function(inbox) {
    console.log(inbox);
  });
  imap.fetchMessagesByUID('*', '*', null, function(messages) {
    console.log(messages);
  });
});
