var options = [
    {
        /* IRC channel. */
        channel: '#remora',
        /* Bot name. */
        name: 'pushbot',
        /* Redis host:port */
        redis: 'localhost:6379',
        /* Redis pubsub channel name. */
        pubsub: 'deploy.addons',
        /* URL to the chief log directory. */
        logs: 'http://addonsadm.private.phx1.mozilla.com/chief/addons/logs/',
        /* List of nicks to notify after the deploy. */
        notify: ['krupa'],
        /* URL that shows the current revision of the site. */
        revision: 'https://addons.mozilla.org/media/git-rev.txt',
        /* URL to the github repo. */
        github: 'https://github.com/mozilla/zamboni/',
        /* Name of the site. */
        site: 'zamboni'
    },
    {
        channel: '#remora',
        name: 'stagebot',
        redis: 'localhost:6379',
        pubsub: 'deploy.addons-stage',
        logs: 'http://addonsadm.private.phx1.mozilla.com/chief/addons.stage/logs/',
        revision: 'https://addons-stage.allizom.org/media/git-rev.txt',
        github: 'https://github.com/mozilla/zamboni/',
        site: 'addons-stage'
    }
];
