var sys = require('sys'),
    irc_ = require('irc'),
    redis_ = require('redis'),
    request = require('request'),
    format = require('./format').format;


var amo = '#amo',
    amobots = '#amo-bots',
    NICK = 'amobot'
    irc = new irc_.Client('irc.mozilla.org', NICK,
                          {channels: [amo, amobots]
                           port: 6697,
                           secure: true}),
    redis = redis_.createClient(6381, '10.8.83.29'),
    repo = 'https://github.com/mozilla/zamboni',
    revURL = 'https://addons-dev.allizom.org/media/git-rev.txt',
    branchesURL = 'https://github.com/api/v2/json/repos/show/mozilla/zamboni/branches';

var channels = {
    'zamboni': [irc, amobots, amo],
    'zamboni-lib': [irc, amobots, amo],
};


var updater = {
    'master': 'https://addons-dev.allizom.org/media/updater.output.txt',
}

var checkRev = function(cb) {
    request(branchesURL, function(err, response, body) {
        var ghRev = JSON.parse(body).branches.master;
        request(revURL, function(err, response, body) {
            sys.puts(body, ghRev);
            cb(body, ghRev);
        });
    });
}


irc.on('message', function(from, to, message) {
    if (message == NICK + ': yo') {
        checkRev(function(amo, github) {
            if (github.indexOf(amo) === 0) {
                irc.say(to, format('{0}: -dev is at {1}/commits/{2} (up to date)',
                                   from, repo, amo));
            } else {
                irc.say(to, format('{0}: we are behind master! {1}/compare/{2}...{3}',
                                   from, repo, amo, github.substring(0, 8)));
            }
        });
    }
});
irc.on('error', function(msg) {
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
    }
});
redis.psubscribe('update.*');
