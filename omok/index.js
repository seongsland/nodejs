// setup
var port		= 12346;

// lib load
var http 		= require('http');
var fs			= require('fs');
var socketio	= require('socket.io')(http);

// global var
var roomList	= {};
var lastRoom    = "";

// http
var server 		= http.createServer(function(request, response) {
	var url	= request.url;
	if(url == "/jquery") {
		fs.readFile(__dirname + '/jquery-1.5.1.min.js', function(error, data) {
			response.writeHead(200, {'Content-Type' : 'text/html'});
			response.end(data);
		});
	} else if(url == "/css") {
		fs.readFile(__dirname + '/style.css', function(error, data) {
			response.writeHead(200, {'Content-Type' : 'text/html'});
			response.end(data);
		});
	} else if(url == "/r") {
		fs.readFile(__dirname + '/r.html', function(error, data) {
			response.writeHead(200, {'Content-Type' : 'text/html'});
			response.end(data);
		});
	} else {
        fs.readFile(__dirname + '/index.html', function(error, data) {
			response.writeHead(200, {'Content-Type' : 'text/html'});
			response.end(data);
		});
    }
}).listen(port);

// socket io
var io 			= socketio.listen(server);

io.sockets.on('connection', function (socket) {

	// 입장
	socket.on('joinRoom', function (room) {
        if(!room) {
            if(!lastRoom) {
                room    = "1";
            } else {
                room    = lastRoom;
            }
        }
        lastRoom    = room;
        
		socket.join(room);
		if(roomList[room]) {
            if(roomList[room].userCount > 1) {
                roomList[room].types = '구경꾼';
            } else {
                roomList[room].types = '●'
            }
		} else {
			roomList[room]	= {userCount:0, types:'○', history:[]};
		}
        roomList[room].userCount++;
        
		socket.room     = room;
        socket.types    = roomList[room].types;
		socket.emit('setTypes', roomList[room].types);
		
		if(roomList[room].userCount == 2) {
			// 타입 변경
			if(Math.random() > 0.5) {
				roomList[room].types	= '○';
			}
			io.to(room).emit('startGame', roomList[room].types);
		}
        
        if(roomList[room].types == "구경꾼") {
            for(var history of roomList[room].history) {
                socket.emit('clicks', history);
            }
        }
	});
	
	// 클릭
	socket.on('clicks', function (obj) {
		var room    = socket.room;
        var types   = socket.types;
        if(types == "○" || types == "●") {
            roomList[room].history.push(obj);
		    io.to(room).emit('clicks', obj);
        }
	});
	
	
	// 방나가기
	socket.on('leave', function () {
		var room    = socket.room;
		
		removeUser(room, socket.id);
		io.to(room).emit('gameend');
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