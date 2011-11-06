var server = require('http').createServer(handler),
	io = require('socket.io').listen(server),
	fs = require('fs'),
	url = require('url'),
	irc = require('irc');

var HOST = 'localhost',
    PORT = 8337;

// HTTP handler
function handler(req, res) {
	path = url.parse(req.url).pathname;
	if (path === '/')  path = '/index.html'

	// Set content type
	var type = '';
	if (path.substr(-3) === '.js')
		type = 'text/javascript';
	else if (path.substr(-4) === '.css')
		type = 'text/css';
    else if (path.substr(-4) === '.png')
        type = 'image/png';
	else
		type = 'text/html';

 	fs.readFile(__dirname + path, function (err, data) {
	    if (err) {
	     	res.writeHead(500);
	     	return res.end('Error loading index.html');
	    }

        res.writeHead(200, {'Content-Type': type});
        res.end(data);
    });
}

server.listen(PORT, HOST);
console.log('Server running at http://' + HOST + ':' + PORT);


// Socket.IO
io.sockets.on('connection', function(socket) {

    // Events to signal TO the front-end
    var events = {
        'join': ['channel', 'nick'],
        'part': ['channel', 'nick'],
        'nick': ['oldNick', 'newNick', 'channels'],
        'names': ['channel', 'nicks'],
        'message': ['from', 'to', 'text'],
        'pm': ['nick', 'text'],
        'motd': ['motd'],
        'error': ['message']
    };

    socket.on('connect', function(data) {
        var client = new irc.Client(data.server, data.nick, {
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
                socket.emit(event, args);
            });
        };

        for (var event in events) { activateListener(event, events[event]); }
    });
});