var sys = require('sys'),
    irc_ = require('irc'),
    redis_ = require('redis'),
    check = require('./check');


var amo = '#amo',
    amobots = '#amo-bots',
    NICK = 'gk0bes'
    irc = new irc_.Client('irc.mozilla.org', NICK,
                          {channels: [amo, amobots]}),
    jp = new irc_.Client('irc.mozilla.org', 'zalooon',
                          {channels: ['#flightdeck']}),
    redis = redis_.createClient(6379, 'mradm02'),
    repo = 'https://github.com/jbalogh/zamboni';

var channels = {
    zamboni: [irc, amobots, amo],
    'zamboni-lib': [irc, amobots, amo],
    flightdeck: [jp, '#flightdeck', '#flightdeck'],
};


var updater = {
    'master': 'https://addons.allizom.org/media/updater.output.txt',
    'next': 'https://addons-next.allizom.org/media/updater.output.txt'
}


irc.on('message', function(from, to, message) {
    if (message == NICK + ': yo') {
        check.checkRev(function(amo, github) {
            irc.say(to, from + ': preview is at ' + repo + '/commits/' + amo);
            if (github.indexOf(amo) != 0) {
                irc.say(to, from + ': we are behind master! ' + repo + '/compare/' + amo + '...' + github.substring(0, 8));
            }
        });
    } else if (message == NICK + ': woo') {
        irc.say(to, from + ': awww yeah');
    } else if (message == NICK + ': meeting?') {
        irc.say(to, from + ': hell no');
    }
});
irc.on('error', function(msg) {
    sys.puts('ERROR: ' + msg);
    sys.puts(JSON.stringify(msg));
});
jp.on('error', function(msg) {
    sys.puts('ERROR: ' + msg);
    sys.puts(JSON.stringify(msg));
});

redis.on('pmessage', function(pattern, channel, message) {
    sys.puts(pattern, channel);
    var msg = JSON.parse(message);
    if (/\.locked$/.exec(channel)) {
        return;
    }
    if (msg instanceof Array) {
        var commits = msg[3].commits,
            commit = commits[commits.length - 1],
            branch = msg[3].ref.split('/').pop(),
            repo = msg[3].repository.name.toLowerCase();
        if (!(repo in channels)) {
            return sys.puts('unknown channel: ' + repo);
        }
        var ch = channels[repo],
            bot = ch[0],
            good = ch[1],
            bad = ch[2];

        sys.puts('returncode', msg[0]);
        if (!(branch in updater)) {
            return sys.puts('ignoring ' + branch);
        } else if (msg[0] === 0) {
            if (commit) {
                bot.say(good, 'Pushed ' + msg[3].compare + ' by ' + commit.author.username);
            } else {
                sys.puts('wtf');
                sys.puts(commits);
            }
        } else {
            var up = updater[msg[3].ref.split('/').pop()];
            bot.say(bad, 'Push failed: ' + updater[branch])
        }
    } else {
        var commits = msg.commits,
            commit = commits[commits.length - 1];
        // irc.say(amo, 'Pushing ' + msg.compare +  ' by ' + commit.author.username);
    }
});
redis.psubscribe('update.*');
