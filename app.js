var express = require('express');
var http = require('http');
var socketIo = require('socket.io');

var app = express();
var httpServer = http.Server(app);		//server for HTTP requests
var ioServer = socketIo(httpServer);	//server for socket requests
var allSockets = {};

app.use(express.static(__dirname + '/public'));		//setting a middleware, which serves static requests automatically

function httpServerConnected(){
	console.log('Http Server started');
}

function ioServerConnected(socket){
	console.log('A new socket connection');

	socket.on('user-joined', userJoined);
	socket.on('disconnect', userLeft);	
	socket.on('message', messageReceived);	
}

function userJoined(user){
	console.log(user + ' joined.');

	allSockets[user] = this;
	var allUsers = Object.keys(allSockets);
	ioServer.emit('user-joined', allUsers);		//trigger info to all users
}

function userLeft(){
	var user = null;
	var allKeys = Object.keys(allSockets);

	for(i = 0; i < allKeys.length; i++){
		if(allSockets[allKeys[i]] === this){
			user = allKeys[i];
		}
	}

	console.log(user + ' left.');
	delete allSockets[user];

    this.broadcast.emit('user-left', user);		//trigger info to all users except the one who disconnected
}

function messageReceived(data){		//handles all type of messages incuding chat, control info etc though json 
									//JSON keys: to, from, content, type[control, release, msg]
	console.log(data);

	if(data.to === 'public'){
		this.broadcast.emit('message', data);		
	}
	else{
		allSockets[data.to].emit('message', data);
	}	
}

httpServer.listen(3000, httpServerConnected);	//httpServerConnected called when httpserver established on port 3000
ioServer.on('connection', ioServerConnected);	//ioServerConnected called when socket server established for each new request

