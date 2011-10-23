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

// IRC client
var client = new irc.Client('irc.freenode.net', 'aktest', {
	channels: []
});

// Socket.IO
io.sockets.on('connection', function(socket) {
	client.addListener('message', function(from, to, message) {
		console.log(from, message);
		socket.emit('message', {from: from, to: to, message: message});
	});

    socket.on('join', function(data) {
        client.join(data.name);
        console.log('Joined ' + data.name)
    })
});