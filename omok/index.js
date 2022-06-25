// setup
var port		= 12346;
var logLevel	= 2;

// lib load
var http 		= require('http');
var fs			= require('fs');
var socketio	= require('socket.io');

// global var
var roomInfo	= {};
var roomNumber	= -1;
var roomList	= {};

// http
var server 		= http.createServer(function(request, response) {
	var url	= request.url;
	if(url == "/") {
		fs.readFile(__dirname + '/index.html', function(error, data) {
			response.writeHead(200, {'Content-Type' : 'text/html'});
			response.end(data);
		});
	} else if(url == "/jquery") {
		fs.readFile(__dirname + '/jquery-1.5.1.min.js', function(error, data) {
			response.writeHead(200, {'Content-Type' : 'text/html'});
			response.end(data);
		});
	} else if(url == "/css") {
		fs.readFile(__dirname + '/style.css', function(error, data) {
			response.writeHead(200, {'Content-Type' : 'text/html'});
			response.end(data);
		});
	} else {
		fs.readFile(__dirname + '/game.html', function(error, data) {
			response.writeHead(200, {'Content-Type' : 'text/html'});
			response.end(data);
		});
	}
}).listen(port);

// socket io
var io 			= socketio.listen(server);
io.set("log level", logLevel);

io.sockets.on('connection', function (socket) {

	// 입장
	socket.on('joinRoom', function (room) {
		socket.join(room);
		if(roomList[room]) {
			roomList[room].userCount++;
			if(roomList[room].types == '●') {
				roomList[room].types	= '○';
			} else {
				roomList[room].types		= '●'			
			}
		} else {
			roomList[room]	= {userCount:1, types:'○'};
		}
		socket.set('room', room);
		socket.emit('setTypes', roomList[room].types);
		
		if(roomList[room].userCount == 2) {
			// 타입 변경
			if(Math.random() > 0.5) {
				roomList[room].types	= '○';
			}
			io.sockets.in(room).emit('startGame', roomList[room].types);
		}
		
		if(roomList[room].userCount > 2) {
			socket.emit('refresh', 'full');
		}
	});
	
	// 클릭
	socket.on('clicks', function (obj) {
		var room;
		socket.get('room', function (err, roomf) {
			room	= roomf;
		});
		io.sockets.in(room).emit('clicks', obj);
	});
	
	
	// 방나가기
	socket.on('leave', function () {
		var room;
		socket.get('room', function (err, roomf) {
			room	= roomf;
		});
		
		removeUser(room, socket.id);
		io.sockets.in(room).emit('gameend');
	});
	
});



// 공통 function
function addUser(room, socketid, nick) {
	try {
		if(roomList[room]) {
			roomList[room].userCount++;
			roomList[room].userList[socketid] = nick;
		}
	} catch(e) {
		console.info(e);
	}
}

function removeUser(room, socketid) {
	try {
		if(roomList[room]) {
			delete roomList[room].userList[socketid];
			roomList[room].userCount	= getSize(roomList[room].userList);
			if(roomList[room].userCount < 1) {
				delete roomList[room];
			}
		}
	} catch(e) {
		console.info(e);
	}
}