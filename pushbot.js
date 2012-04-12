var fs = require('fs'),
    sys = require('sys'),
    vm = require('vm'),
    irc_ = require('irc'),
    exec = require('child_process').exec,
    redis_ = require('redis'),
    _ = require('underscore'),
    request = require('request'),
    parselog = require('./captain').parselog,
    format = require('./format').format;

if (process.argv.length < 3) {
    console.log('Usage: node pushbot.js <config file>');
    process.exit();
} else {
    vm.runInThisContext(fs.readFileSync(process.argv[2]));
}

_.each(options, botFactory);

/* Like os.path.join. */
function join(/* args */) {
    return _.reduce(_.tail(arguments), function(a, b) {
        a = a[a.length - 1] == '/' ? a : a + '/';
        b = b[0] == '/' ? b.substring(1) : b;
        return a + b;
    }, _.head(arguments));
}


function botFactory(options) {
    var channel = options.channel,
        me = options.name,
        pushbot = new irc_.Client('irc.mozilla.org', me, {channels: [channel]}),
        redis = null,
        logURL = options.logs,
        revisionURL = options.revision,
        compareURL = join(options.github, 'compare/{0}...{1}');

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

    (function startRedis() {
        if (redis) {
            redis.end();
        }
        var r = options.redis.split(':')
        redis = redis_.createClient(Number(r[1]), r[0]);
        // Hook up to chief through pub/sub.
        redis.on('message', function(pubsubChannel, message) {
            sys.puts(pubsubChannel, message);
            try {
                chiefSays(JSON.parse(message));
            } catch (e) {
                console.log('oops ' + e)
            }
        });
        redis.subscribe(options.pubsub);
        // Reset this every 5 minutes because we appear to lose the connection
        // all the time.
        setTimeout(startRedis, 1000 * 5 * 60);
    })();

    // Handle events chief publishes through redis.
    // It should go BEGIN => PUSH => DONE but a FAIL can interrupt.
    function chiefSays(msg) {
        msg = _.extend(msg, options);
        var s = atob(secret).split(';'), r = Math.random() * s.length, m = s[Math.floor(r)];
        if (msg.event == 'BEGIN') {
            pushbot.say(channel, format(m + ', {who} is pushing {site} {ref} ', msg));
            // If we push origin/master the logfile is name origin.master.
            logWatcher.start(msg.ref.replace('/', '.'));
            request(revisionURL, function(err, response, body) {
                pushbot.say(channel, format(compareURL, body, msg.ref));
            });
        } else if (msg.event == 'PUSH') {
            pushbot.say(channel, format('the push is now going to the webheads!! ' +
                                        '({ref} {who})', msg));
        } else if (msg.event == 'DONE') {
            pushbot.say(channel, format('{who} pushed {site} {ref}', msg));
            logWatcher.stop();
        } else if (msg.event == 'FAIL') {
            pushbot.say(channel, format('something terrible happened. check the logs ' +
                                        '({ref} {who})', msg));
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
            //console.log('updating');
            // Compare the lists of completed tasks.
            if (newStatus.completed && oldStatus.completed) {
                var old = oldStatus.completed, new_ = newStatus.completed;
                // Figure out if we completed any new tasks.
                if (new_.length > old.length) {
                    var finished = new_.slice(old.length);
                    var f = _.map(finished, function(x) { return format('{0} ({1}s)', x[0], x[1]);})
                    pushbot.say(channel, 'Finished: ' + f.join(', '));
                    // deploy_app means everything is out on the webheads.
                    if (!_.isEmpty(options.notify) && _.contains(_.map(finished, _.first), 'deploy_app')) {
                        pushbot.say(channel, format('{0}: check it', options.notify.join(': ')));
                    }

                }
            }
            // Figure out if we have any new failed tasks.
            if (newStatus.failed && oldStatus.failed) {
                var old = oldStatus.failed, new_ = newStatus.failed;
                if (new_.length > old.length) {
                    var failed = new_.slice(old.length);
                    var f = _.map(failed, function(x) { return format('{0} ({1})', x[1], x[2]);})
                    pushbot.say(channel, 'Failed: ' + f.join(', '));
                }
            }
            oldStatus = newStatus;
        };

        var self = {
            start: function(filename) {
                var path = filename.indexOf('http') === 0 ? filename : join(logURL, filename);
                pushbot.say(channel, 'watching ' + path);
                // Pull the logs and parse with captain.py every 5 seconds
                // to pick up new completed tasks.
                var check = function() {
                    request(path, function(err, response, body) {
                        update(parselog(body));
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
                    pushbot.say(channel, format('Waiting for {task} on {num} machines since {since}:',
                                                {since: oldStatus.task[0], task: oldStatus.task[1], num: keys.length}));
                    pushbot.say(channel, keys.join(', '));
                } else {
                    pushbot.say(channel, 'all clear');
                }
            },
            failed: function() {
                if (oldStatus.failed) {
                    var f = _.map(oldStatus.failed, function(x) { return format('{0} ({1} at {2})', x[1], x[2], x[0]);})
                    pushbot.say(channel, 'Failed: ' + f.join(', '));
                }
            }
        };
        return self;
    })();
}

var secret = atob('YUc5c2VTQm9aV3hzTzI1dklIZGhlVHRuZFdWemN5QjNhR0YwTzJ4cGMzUmxiaUIxY0R0b1pYa2dibTkzTzJGc2NtbG5hSFE3YjJnZ1oyOWtPM0JoYm1saklUdHpkMlZsZER0SklHMXBjM01nYW1KaGJHOW5hQ3hpZFhRZ1lXNTVkMkY1TzNkb2IyRTdiMmdnWTI5dmJEdHZhQ0J1YVdObE8zZGxiR3dnZEdobGJqdHNiMjlyTzJOb1pXTnJJR2wwSUc5MWREdDNiMjkw');

function atob(s) {
    return (new Buffer(s, 'base64')).toString('ascii');
}

// Try not to die.
process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
});
