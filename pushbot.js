var sys = require('sys'),
    irc_ = require('irc'),
    exec = require('child_process').exec,
    redis_ = require('redis'),
    _ = require('underscore'),
    nomnom = require('nomnom'),
    request = require('request'),
    format = require('./format').format;


var options = nomnom.opts({
    channel: {
        default: '#remora',
        help: 'irc channel'
    },
    name: {
        default: 'pushbot',
        help: 'bot name'
    },
    pubsub: {
        default: 'deploy.addons',
        help: 'redis pubsub channel'
    },
    logs: {
        default: '/addons-chief/logs/',
        help: 'relative path to the chief logs'
    },
    quiet: {
        flag: true,
        default: false,
        help: "don't tell krupa to check it"
    }
}).parseArgs();
console.log(options);

var amo = options.channel,
    me = options.name,
    pushbot = new irc_.Client('irc.mozilla.org', me, {channels: [amo]}),
    redis = redis_.createClient(6382, '10.8.83.29'),
    logURL = 'http://addonsadm.private.phx1.mozilla.com' + options.logs,
    revisionURL = 'https://addons.mozilla.org/media/git-rev.txt',
    compareURL = 'https://github.com/mozilla/zamboni/compare/{0}...{1}';


// Pull out messages that look like "<pushbot>: ..." and act on the ... part.
pushbot.on('message', function(from, to, message) {
    var msg;
    if (msg = RegExp('^' + me + '\\s*:\\s*(.*?)\\s*$').exec(message)) {
        msg = msg[1]
        if (/^st(at|atus)?$/.exec(msg)) {
            logWatcher.stat();
        } else if (/f(ail|ailed)?$/.exec(msg)) {
            logWatcher.failed();
        } else if (/watch (\S+)$/.exec(msg)) {
            var path = /watch (\S+)$/.exec(msg)[1]
            logWatcher.start(path);
        } else if (msg == 'stop') {
            logWatcher.stop();
        }
    }
});

// Hook up to chief through pub/sub.
redis.on('message', function(channel, message) {
    sys.puts(channel, message);
    try {
        chiefSays(amo, JSON.parse(message));
    } catch (e) {
        console.log('oops ' + e)
    }
});
redis.subscribe(options.pubsub);

// Handle events chief publishes through redis.
// It should go BEGIN => PUSH => DONE but a FAIL can interrupt.
function chiefSays(channel, msg) {
    if (msg.event == 'BEGIN') {
        pushbot.say(channel, format('hang on, {who} is pushing zamboni {zamboni} ', msg));
        // If we push origin/master the logfile is name origin.master.
        logWatcher.start(msg.zamboni.replace('/', '.'));
        request(revisionURL, function(err, response, body) {
            pushbot.say(channel, format(compareURL, body, msg.zamboni));
        });
    } else if (msg.event == 'PUSH') {
        pushbot.say(channel, format('the push is now going to the webheads!! ' +
                                    '({zamboni} {who})', msg));
    } else if (msg.event == 'DONE') {
        pushbot.say(channel, format('{who} pushed zamboni {zamboni} and ', msg));
        logWatcher.stop();
    } else if (msg.event == 'FAIL') {
        pushbot.say(channel, format('something terrible happened. check the logs ' +
                                    '({zamboni} {who})'));
        logWatcher.stop();
    }
}

// All the logic for watching logs from chief and spewing messages about them.
var logWatcher = (function(){
    var oldStatus = {},
        newStatus = {},
        interval,
        timeToDie;

    var update = function(next) {
        newStatus = next;
        console.log('updating');
        // Compare the lists of completed tasks.
        if (newStatus.completed && oldStatus.completed) {
            var old = oldStatus.completed, new_ = newStatus.completed;
            // Figure out if we completed any new tasks.
            if (new_.length > old.length) {
                var finished = new_.slice(old.length);
                var f = _.map(finished, function(x) { return format('{0} ({1}s)', x[0], x[1]);})
                pushbot.say(amo, 'Finished: ' + f.join(', '));
                // deploy_app means everything is out on the webheads.
                if (!options.quiet && _.contains(_.map(finished, _.first), 'deploy_app')) {
                    pushbot.say(amo, 'krupa: check it');
                }

            }
        }
        // Figure out if we have any new failed tasks.
        if (newStatus.failed && oldStatus.failed) {
            var old = oldStatus.failed, new_ = newStatus.failed;
            if (new_.length > old.length) {
                var failed = new_.slice(old.length);
                var f = _.map(failed, function(x) { return format('{0} ({1})', x[1], x[2]);})
                pushbot.say(amo, 'Failed: ' + f.join(', '));
            }
        }
        oldStatus = newStatus;
    };

    var self = {
        start: function(filename) {
            var path = filename.indexOf('http://') === 0 ? filename : logURL + filename,
                cmd = format('curl -s {path} | ./captain.py', {path: path});
            pushbot.say('watching ' + path);

            // Pull the logs and parse with captain.py every 5 seconds
            // to pick up new completed tasks.
            var check = function() {
                exec(cmd, function(error, stdout, stderr) {
                    if (error) { return console.log(error); }
                    try {
                        console.log(stdout);
                        update(JSON.parse(stdout));
                    } catch (e) {
                        console.log(e);
                    }

                    // We wait until captain.py goes by once more before stoping
                    // the loop.
                    if (timeToDie) {
                        clearInterval(interval);
                        oldStatus = newStatus = {};
                    }
                });
            };
            timeToDie = false;
            interval = setInterval(check, 5 * 1000);
            check();
        },
        stop: function() {
            timeToDie = true;
        },
        stat: function() {
            if (oldStatus.queue) {
                var keys = _.keys(oldStatus.queue);
                pushbot.say(amo, format('Waiting for {task} on {num} machines since {since}:',
                                        {since: oldStatus.task[0], task: oldStatus.task[1], num: keys.length}));
                pushbot.say(amo, keys.join(', '));
            } else {
                pushbot.say(amo, 'all clear');
            }
        },
        failed: function() {
            if (oldStatus.failed) {
                var f = _.map(oldStatus.failed, function(x) { return format('{0} ({1} at {2})', x[1], x[2], x[0]);})
                pushbot.say(amo, 'Failed: ' + f.join(', '));
            }
        }
    };
    return self;
})();


// Try not to die.
process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});
