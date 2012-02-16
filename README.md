Web-IRC
=======

Note
----

I have stopped development on Web-IRC in favor of [Subway](https://github.com/thedjpetersen/subway),
a joint effort with another githubber. If you are interested in a web-based IRC client, look there.

https://github.com/thedjpetersen/subway

-----


### A web IRC client

The goal for this project is to become the best in-browser IRC client available,
and bring the best ideas from modern web applications to IRC. It was inspired by a [request for improvements to qwebirc](https://github.com/paulirish/lazyweb-requests/issues/31)
by Paul Irish.

Web-IRC is based on [node.js](http://nodejs.org/) and 
Martyn Smith's [node-irc](https://github.com/martynsmith/node-irc) on the backend,
and [Backbone.js](http://documentcloud.github.com/backbone/) and
[jQuery](http://jquery.com/) on the frontend.


Status
------

The app is still in its early stages. Potential contributors should find plenty to do.

Here's what works:

- Choose nick/network/channel(s) to use at login
- Join channels
- Send messages to channels
- Switch between channel tabs, see chat output
- Leave channels
- Private messages
- Channel topics

Here's (a partial list of) what doesn't work yet:

- Status messages
- Listing channels

Design/UI/UX help also **desperately needed**.

Installation
------------

1. Assuming you already have node.js & npm, run:

    $ npm install -g web-irc

2. Launch the web server

    $ web-irc

3. Point your browser at `http://localhost:8337/`

Development
-----------

Replace step 1 above with this:

    $ git clone https://github.com/akavlie/web-irc
    $ cd web-irc
    $ npm link

this should install dependencies, and link the git checkout to your global
node_modules directory.

Rationale
---------

Web-based IRC clients are quite popular, particularly as an in-page embed for 
various open source projects and live shows. The ubiquitous choice at this time
is the aforementioned [qwebirc](http://qwebirc.org/).

Here are some popular sites that use (or link to) a web IRC client:

- [jQuery](http://docs.jquery.com/Discussion)
- [freenode](http://webchat.freenode.net/)
- [TWiT](http://twit.tv/)


License
-------

MIT licensed. See `LICENSE`.
