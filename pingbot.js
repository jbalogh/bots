var sys = require('sys'),
    irc_ = require('irc');


var pingbot = new irc_.Client('irc.mozilla.org', 'pingbot',
                              {channels: ['#sumodev', '#amo']});

pingbot.on('message', function(from, to, message) {
    if (/pingbot\s*:\s*woo\s*$/.exec(message)) {
        pingbot.say(to, from + ': aww yeah');
    } else if (/pingbot\s*:\s*ping\s*$/.exec(message)) {
        pingbot.say(to, from + ': PONG');
    } else if (/pingbot\s*:\s*botsnack\s*$/.exec(message)) {
        pingbot.say(to, 'OM NOM NOM');
    } else if (/^\w+\s*:\s*can I ask you a question.\s*$/i.exec(message)) {
        pingbot.say(to, from + ': please just ask your question.');
    } else if (/^\w+\s*.\s*ping\s*$/i.exec(message)) {
        pingbot.say(to, from + ': please just ask your question.');
    } else if (/pingbot\s*:/.exec(message)) {
        pingbot.say('jbalogh', '(' + to + ') ' + from + ' :: ' + message);
    }
});

pingbot.on('pm', function(from, message) {
    var match;
    sys.puts(from + ': ' + message);
    if (from == 'jbalogh') {
        if (match = /^say:? ([#\w]+) (.*)$/.exec(message)) {
            sys.puts(match[1] + ' => ' + match[2]);
            pingbot.say(match[1], match[2]);
        }
    } else {
        pingbot.say('jbalogh', '(' + from + ') :: ' + message);
    }
});

pingbot.on('error', function(msg) {
    sys.puts('ERROR: ' + msg);
    sys.puts(JSON.stringify(msg));
});

pingbot.on('raw', function(msg) {
    if (msg.command == 'INVITE') {
        pingbot.say(msg.nick, 'joining ' + msg.args[1]);
        pingbot.say('jbalogh', 'joining ' + msg.args[1]);
        pingbot.join(msg.args[1]);
    }
});
