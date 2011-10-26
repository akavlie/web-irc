Web-IRC
=======

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

- Join (hardcoded) network, see MOTD
- Join (sample list of) channels
- Switch between channel tabs, see chat output
- Leave channels

Here's (a partial list of) what doesn't work yet:

- Saying anything
- Status messages
- Private messages
- / commands in input field
- Choose network & nick to use at login
- Channel topics & member lists
- Listing channels (node-irc support needed for this)

Design/UI/UX help also **desperately needed**.


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