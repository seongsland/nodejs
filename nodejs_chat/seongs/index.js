// setup
var port		= 12345;
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
		fs.readFile(__dirname + '/chat.html', function(error, data) {
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
	}
}).listen(port);

// socket io
var io 			= socketio.listen(server);
io.set("log level", logLevel);

io.sockets.on('connection', function (socket) {

	// 룸리스트
	socket.on('roomList', function () {
		socket.emit('roomList', roomList)
	});
	
	// 닉 등록
	socket.on('registNick', function (name) {
		socket.set('nick', name);
		socket.emit('registNick', name);
	});
	
	// 닉 변경
	socket.on('changeNick', function (name) {
		var room,nick;
		socket.get('room', function (err, roomf) {
			room	= roomf;
		});
		socket.get('nick', function (err, nickf) {
			nick	= nickf;
		});
		
		socket.set('nick', name);
		changeUser(room, socket.id, name);
		io.sockets.in(room).emit('changeNick', {before:nick, after:name});
	});
	
	// 입장
	socket.on('joinRoom', function (room) {
		var nick;
		socket.get('nick', function (err, nickf) {
			nick	= nickf;
		});
		
		socket.join(room);
		addUser(room, socket.id, nick);
		socket.set('room', room);
		io.sockets.in(room).emit('joinRoom', {nick:nick, roomInfo:roomList[room]});
	});
	
	// 생성
	socket.on('createRoom', function (roomName) {
		var nick;
		socket.get('nick', function (err, nickf) {
			nick	= nickf;
		});
		
		roomNumber++;
		var room	= "" + roomNumber;
		socket.join(room);
		roomList[room]	= {name:roomName, createDate:getNow(), state:1, userCount:0, owner:socket.id, userList:{}};
		addUser(room, socket.id, nick);
		socket.set('room', room);
		io.sockets.in(room).emit('createRoom', {nick:nick, roomInfo:roomList[room]});
	});
	
	// 대화
	socket.on('message', function (data) {
		var room,nick;
		socket.get('room', function (err, roomf) {
			room	= roomf;
		});
		
		socket.get('nick', function (err, nickf) {
			nick	= nickf;
		});
	  
		// message에 대한 분기처리
		var msg	= getMsgType(data);
		
		if(msg.type == 0) {
			// 평문 대화
			io.sockets.in(room).emit('message', {
				type : 0,
				nick : nick,
				msg : msg.msg
			});
		} else if(msg.type == 1) {
			// 혼잣말
			socket.emit('message', {
				type : 0,
				nick : nick,
				msg : msg.msg
			});
		} else if(msg.type == 2) {
			// 귓속말 처리
			var socketid	= getSocketId(room, msg.target);
			console.info("socketid:" + socketid);
			if(!socketid) {
				socket.emit('message', {
					type : 1,
					nick : msg.target,
					msg : msg.target + " 사용자를 찾을수 없습니다."
				});
			} else {
				if(msg.msg.trim() == "omok!") {
					var rand	= parseInt(Math.random()*100000);
					msg.msg		= "<input type='button' value='오목하기' onclick='omok(" + rand + ");'>";
				}
				
				io.sockets.sockets[socketid].emit('message', {
					type : 2,
					nick : nick,
					msg : msg.msg
				});
				
				socket.emit('message', {
					type : 2,
					nick : "(" + msg.target + ")",
					msg : msg.msg
				});
			}
		} else if(msg.type == 3) {
			// 방장권한
			socket.emit('message', {
				type : 1,
				nick : nick,
				msg : "준비중입니다."
			});
		} else if(msg.type == 4) {
			// 사용자 리스트
			var userList	= getUserList(room);
			socket.emit('message', {
				type : 1,
				nick : nick,
				msg : userList
			});
		} else if(msg.type == 5) {
			// 닉네임 변경
			socket.emit('reqChangeNick', msg.msg);
		} else if(msg.type == 5) {
			// help
			socket.emit('message', {
				type : 1,
				nick : nick,
				msg : msg.msg
			});
		} else {
			// 그외
			socket.emit('message', {
				type : 1,
				nick : nick,
				msg : msg.msg
			});
		}
	});
	
	// 방나가기
	socket.on('leave', function (nick) {
		var room,nick;
		socket.get('room', function (err, roomf) {
			room	= roomf;
		});
		
		socket.get('nick', function (err, nickf) {
			nick	= nickf;
		});
		
		if(room) {
			socket.broadcast.to(room).emit('leave', nick);
			socket.leave(room);
			removeUser(room, socket.id);
		}
	});
	
	// disconnect 처리
	socket.on('disconnect', function (nick) {
		var room;
		socket.get('room', function (err, roomf) {
			room	= roomf;
		});
		removeUser(room, socket.id);
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

function changeUser(room, socketid, nick) {
	try {
		if(roomList[room]) {
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

function getSize(obj) {
	var size	= 0;
	for(var v in obj) size++;
	return size;
}

function getNow() {
	var dates	= new Date();
	var day		= make2Length(dates.getMonth()+1) + "/" + make2Length(dates.getDate());
	var time	= make2Length(dates.getHours()) + ":" + make2Length(dates.getUTCMinutes())
	return day + " " + time;
}

function make2Length(val) {
	return (val<=9) ? "0" + val : val;
}

function getMsgType(msg) {
	var res		= {};
	var msgSplit	= msg.split(" ");
	if(msg.substring(0,1) != "/") {
		res.type	= 0;
		res.msg		= msg;
	} else if(msg.substring(0,4) == "/me ") {
		res.type	= 1;
		res.msg		= msg.substring(4);
	} else if(msg.substring(0,4) == "/to:") {
		res.type	= 2;
		res.target	= msgSplit[0].substring(4);
		res.msg		= getArrayAfter(msgSplit, 1);
	} else if(msg.substring(0,4) == "/ow:") {
		res.type	= 3;
		res.target	= msgSplit[0].substring(4);
		res.msg		= getArrayAfter(msgSplit, 1);
	} else if(msg.substring(0,5) == "/list") {
		res.type	= 4;
		res.msg		= "";
	} else if(msg.substring(0,5) == "/nick") {
		res.type	= 5;
		res.msg		= getArrayAfter(msgSplit, 1);
	} else if(msg.substring(0,5) == "/help") {
		res.type	= 6;
		res.msg		= "도움말 안내입니다. <br>"
					+ "혼잣말 - <span class='cmclick'>/me </span>내용<br>"
					+ "귓속말 - <span class='cmclick'>/to:</span>아이디 내용<br>"
					+ "오목 - <span class='cmclick'>/to:</span>아이디 omok!<br>"
					+ "접속자 리스트 - <span class='cmclick'>/list</span><br>"
					+ "닉네임 변경 - <span class='cmclick'>/nick </span>닉네임<br>";
	} else {
		res.type	= 9;
		res.msg		= "사용할 수 없는 명령어 입니다. (<span class='cmclick'>/help</span> 참조)";
	}
	return res;
}

function getArrayAfter(arr, idx) {
	var res	= "";
	for(var i=idx; i<arr.length; i++) {
		res	+= " " + arr[i];
	}
	return res.substring(0);
}

function getSocketId(room, nick) {
	console.info("nick:" + nick);
	var socketid;
	for(var user in roomList[room].userList) {
		console.info(roomList[room].userList[user] + "==" + nick + " : " + user);
		if(roomList[room].userList[user] == nick) {
			socketid	= user;
			break;
		}
	}
	return socketid;
}

function getUserList(room) {
	var userList	= "접속자 리스트 입니다.";
	for(var user in roomList[room].userList) {
		userList	+= "<br> - <span class='idclick'>" + roomList[room].userList[user] + "</span>";
	}
	return userList;
}
