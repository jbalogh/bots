var sys = require('sys'),
    irc_ = require('irc'),
    redis_ = require('redis')
    format = require('./format').format;


var amo = '#remora',
    pushbot = new irc_.Client('irc.mozilla.org', 'pushbot',
                              {channels: [amo, '#amo']}),
    redis = redis_.createClient(6379, 'mradm02'),
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
    }
});

function handle(channel, msg) {
    if (msg.event == 'BEGIN') {
        pushbot.say(channel, format('holy hell, {who} is pushing zamboni v{zamboni} ' +
                                    'and vendor v{vendor}!', msg));
    } else if (msg.event == 'PUSH') {
        pushbot.say(channel, format('the push is now going to the webheads!! ' +
                                    '(v{zamboni}/v{vendor} :{who})', msg));
    } else if (msg.event == 'DONE') {
        pushbot.say(channel, format('{who} pushed zamboni v{zamboni} and ' +
                                    'vendor v{vendor}!!!', msg));
    }
}


redis.on('message', function(channel, message) {
    sys.puts(channel, message);
    var msg = JSON.parse(message);
    lastEvent = msg;
    lastEventTime = new Date;
    handle(amo, msg);
});
redis.subscribe('deploy.amo');
