This is a little family of robots that help out with addons.mozilla.org
development. They use node.js.

Dependencies
============

::

    npm install irc redis underscore nomnom request


pushbot.js
==========

pushbot subscribes to a redis channel and waits for chief to tell it about
pushes. Then it parses the push logs to tell us what's going on with the push in
real-time.

pushbot is configured with a separate javascript config file. Run it like this::

    node pushbot.js <config.js>

where config looks like this::

    options = [
        {
            /* IRC channel. */
            channel: '#amo',
            /* Bot name. */
            name: 'pushbot',
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
        }
    ]

Since pushbot takes an array of objects for configuration, you can watch
multiple pubsub channels in the same process. Just make sure you give each
pushbot a different IRC name and pubsub channel. Check out a real config for two
sites in pushbot-settings.js.

During a push, you can ask pushbot for more details::

    pushbot: st[at[us]]

Or you can ask about what failed::

    pushbot: f[ail[ed]]


amobot.js
=========

amobot subscribes to a redis channel and waits for freddo to tell it about
automatic deploys.addons-dev.

Run it like this::

    node amobot.js

You can ask amobot if -dev is up to date with the latest master::

    amobot: yo
