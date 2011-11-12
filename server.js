var express = require('express'),
    app = express.createServer(),
	io = require('socket.io').listen(app),
	irc = require('irc');

app.configure(function() {
    app.use(express.static(__dirname + '/'));
});

app.configure('development', function() {
    app.listen(8337);
});

app.configure('production', function() {
    app.listen(12445);
});

console.log('Express server started on port %s', app.address().port);


// Socket.IO
io.sockets.on('connection', function(socket) {

    // Events to signal TO the front-end
    var events = {
        'join': ['channel', 'nick'],
        'part': ['channel', 'nick'],
        'topic': ['channel', 'topic', 'nick'],
        'nick': ['oldNick', 'newNick', 'channels'],
        'names': ['channel', 'nicks'],
        'message': ['from', 'to', 'text'],
        'pm': ['nick', 'text'],
        'motd': ['motd'],
        'error': ['message']
    };

    socket.on('connect', function(data) {
        var client = new irc.Client(data.server, data.nick, {
            showErrors: true,
            channels: data.channels
        });

        // Socket events sent FROM the front-end
        socket.on('join', function(name) { client.join(name); });
        socket.on('part', function(name) { client.part(name); });
        socket.on('say', function(data) { client.say(data.target, data.message); });
        socket.on('command', function(text) { console.log(text); client.send(text); });
        socket.on('disconnect', function() { client.disconnect(); });


        // Add a listener on client for the given event & argument names
        var activateListener = function(event, argNames) {
            client.addListener(event, function() {
                console.log('Event ' + event + ' sent');
                // Associate specified names with callback arguments
                // to avoid getting tripped up on the other side
                var callbackArgs = arguments;
                args = {};
                argNames.forEach(function(arg, index) {
                    args[arg] = callbackArgs[index];
                });
                console.log(args);
                socket.emit('irc:' + event, args);
            });
        };

        for (var event in events) { activateListener(event, events[event]); }
        console.log('Starting IRC client; wiring up socket events.')
    });
});