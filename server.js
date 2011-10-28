var server = require('http').createServer(handler),
	io = require('socket.io').listen(server),
	fs = require('fs'),
	url = require('url'),
	irc = require('irc');

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

server.listen(8337);

// Socket.IO
io.sockets.on('connection', function(socket) {
	// IRC client
	var client = new irc.Client('irc.freenode.net', 'aktest', {
		channels: []
	});

	// Channel & private messages
	client.addListener('message', function(from, to, message) {
		console.log(from, message);
		socket.emit('message', {from: from, to: to, text: message});
	});

	client.addListener('motd', function(motd) {
		socket.emit('motd', motd);
	});

    // List of nicks for a channel, sent after joining
    client.addListener('names', function(channel, nicks) {
        socket.emit('names', {channel: channel, nicks: nicks});
    });

    socket.on('join', function(name) {
        client.join(name);
        console.log('Joined ' + name);
    });

    socket.on('part', function(name) {
        console.log('Parting ' + name);
        client.part(name);
    });

    socket.on('say', function(data) {
        console.log('SAY: ' + data.target + '=>' + data.message);
        client.say(data.target, data.message);
    });

    socket.on('command', function(text) {
        client.send(text);
    });

    socket.on('disconnect', function() {
    	// Disconnect user
    	console.log('User disconnected');
        client.disconnect();
    })
});