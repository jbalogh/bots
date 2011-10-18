This is a little family of robots that help out with addons.mozilla.org
development. They use node.js.

Dependencies
============

::

    npm install underscore nomnom request


pushbot.js
==========

pushbot subscribes to a redis channel and waits for chief to tell it about
pushes. Then it parses the push logs to tell us what's going on with the push in
real-time.

To run it for prod, just do::

    node pushbot.js

To run pushbot for addons-stage start it with these options::

    node pushbot.js --name=stagebot --pubsub=deploy.addons-stage
        --logs=/addons-stage-chief/logs/ --quiet --channel='#stagebot'

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
