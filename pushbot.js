var sys = require('sys'),
    irc_ = require('irc'),
    exec = require('child_process').exec,
    redis_ = require('redis'),
    _ = require('underscore'),
    nomnom = require('nomnom'),
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
    pushbot = new irc_.Client('irc.mozilla.org', me,
                              {channels: [amo]}),
    redis = redis_.createClient(6382, '10.8.83.29'),
    logURL = 'http://addonsadm.private.phx1.mozilla.com' + options.logs,
    lastEvent,
    lastEventTime;


pushbot.on('message', function(from, to, message) {
    var msg;
    if (msg = RegExp('^' + me + '\\s*:\\s*(.*?)\\s*$').exec(message)) {
        msg = msg[1]
        if (msg == 'yo') {
            pushbot.say(to, from + ': ' + 'hey there');
        } else if (/^st(at|atus)?$/.exec(msg)) {
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

function handle(channel, msg) {
    if (msg.event == 'BEGIN') {
        pushbot.say(channel, format('listen up, {who} is pushing zamboni {zamboni} ' +
                                    'and vendor {vendor}!', msg));
        logWatcher.start(msg.zamboni);
    } else if (msg.event == 'PUSH') {
        pushbot.say(channel, format('the push is now going to the webheads!! ' +
                                    '({zamboni}/{vendor} {who})', msg));
    } else if (msg.event == 'DONE') {
        pushbot.say(channel, format('{who} pushed zamboni {zamboni} and ' +
                                    'vendor {vendor}!!!', msg));
        logWatcher.stop();
    } else if (msg.event == 'FAIL') {
        pushbot.say(channel, format('something terrible happened. check the logs ' +
                                    '({zamboni}/{vendor} {who})'));
        logWatcher.stop();
    }
}

var logWatcher = (function(){
    var oldStatus = {},
        newStatus = {},
        interval;

    var update = function(next) {
        newStatus = next;
        console.log('updating');
        if (newStatus.completed && oldStatus.completed) {
            var old = oldStatus.completed, new_ = newStatus.completed;
            if (new_.length > old.length) {
                var finished = new_.slice(old.length);
                var f = _.map(finished, function(x) { return format('{0} ({1}s)', x[0], x[1]);})
                pushbot.say(amo, 'Finished: ' + f.join(', '));
                if (!options.quiet && _.contains(_.map(finished, _.first), 'deploy_app')) {
                    pushbot.say(amo, 'krupa: check it');
                }

            }
        }
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

            self.check = function() {
                console.log(cmd);
                exec(cmd, function(error, stdout, stderr) {
                    if (error) { return console.log(error); }
                    try {
                        console.log(stdout);
                        update(JSON.parse(stdout));
                    } catch (e) {
                        console.log(e);
                    }
                });
            };
            interval = setInterval(self.check, 5 * 1000);
            self.check();
        },
        stop: function() {
            clearInterval(interval);
            self.check();
            oldStatus = newStatus = {};
            delete self.check;
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


redis.on('message', function(channel, message) {
    sys.puts(channel, message);
    var msg = JSON.parse(message);
    lastEvent = msg;
    lastEventTime = new Date;
    handle(amo, msg);
});
redis.subscribe(options.pubsub);
