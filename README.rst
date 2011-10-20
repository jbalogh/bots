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

Here's all of pushbot's options::

    options:
       --channel    irc channel
       --name       bot name
       --pubsub     redis pubsub channel
       --logs       http path to the chief log directory
       --notify     who should be notified about the deploy?
       --revision   http path showing the current revision of the site
       --github     path to the github repo
       --site       name of the site getting pushed

Since all the defaults are for addons.mozilla.org, just do::

    node pushbot.js --notify=krupa --notify=clouserw

To run pushbot for addons-stage start it with these options::

    node pushbot.js --channel='#woo'
                    --name=stagebot
                    --pubsub=deploy.addons-stage
                    --logs='http://addonsadm.private.phx1.mozilla.com/chief/addons.stage/logs/'
                    --notify=jbalogh
                    --revision='https://addons-stage.allizom.org/media/git-rev.txt'
                    --github='https://github.com/mozilla/zamboni'
                    --site='addons-stage'

That's a lot of options! Put it in a script.

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
