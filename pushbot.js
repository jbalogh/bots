var sys = require('sys'),
    irc_ = require('irc'),
    exec = require('child_process').exec,
    redis_ = require('redis'),
    format = require('./format').format;


var amo = '#remora',
    pushbot = new irc_.Client('irc.mozilla.org', 'pushbot',
                              {channels: [amo]}),
    redis = redis_.createClient(6379, 'mradm02'),
    logURL = 'http://mradm02:9999/log/',
    lastEvent,
    lastEventTime;


pushbot.on('message', function(from, to, message) {
    if (/pushbot\s*:\s*yo/.exec(message)) {
        if (lastEvent) {
            pushbot.say(to, from + ': ' + lastEventTime);
            handle(to, lastEvent);
        } else {
            pushbot.say(to, from + ': all quiet over here boss');
        }
    } else if (/pushbot\s*:\s*st(at|atus)?/.exec(message)) {
        logWatcher.stat();
    }
});

function handle(channel, msg) {
    if (msg.event == 'BEGIN') {
        pushbot.say(channel, format('holy hell, {who} is pushing zamboni v{zamboni} ' +
                                    'and vendor v{vendor}!', msg));
        logWatcher.start(msg.zamboni);
    } else if (msg.event == 'PUSH') {
        pushbot.say(channel, format('the push is now going to the webheads!! ' +
                                    '(v{zamboni}/v{vendor} :{who})', msg));
    } else if (msg.event == 'DONE') {
        pushbot.say(channel, format('{who} pushed zamboni v{zamboni} and ' +
                                    'vendor v{vendor}!!!', msg));
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
                pushbot.say(amo, 'Finished: ' + new_.slice(old.length).join(', '));
            }
        }
        oldStatus = newStatus;
    };

    return {
        start: function(filename) {
            var path = logURL + filename,
                cmd = format('curl -s {path} | ./captain.py', {path: path}),
                check = function() {
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
            interval = setInterval(check, 5 * 1000);
            check();
        },
        stop: function() {
            clearInterval(interval);
            oldStatus = newStatus = {};
        },
        stat: function() {
        console.log(oldStatus);
            if (oldStatus.queue) {
                keys = [];
                for (var key in oldStatus.queue) {
                    keys.push(key);
                }
                pushbot.say(amo, format('Waiting for {task} on {num} machines:',
                                        {task: oldStatus.task, num: keys.length}));
                pushbot.say(amo, keys.join(', '));
            } else {
                pushbot.say(amo, 'all clear');
            }
        }
    };
})();


redis.on('message', function(channel, message) {
    sys.puts(channel, message);
    var msg = JSON.parse(message);
    lastEvent = msg;
    lastEventTime = new Date;
    handle(amo, msg);
});
redis.subscribe('deploy.amo');
