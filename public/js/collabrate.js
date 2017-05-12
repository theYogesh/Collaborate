$(document).ready(function(){
	// declare variables
	var $userTemplate, editors, socket, currentUser;

	// assign variables
	$userTemplate = $('#userTemplate');
	editors = {};

	// functions
	function socketConnected(){
		currentUser = window.prompt("Your name please?");
		$('title').html(currentUser);

		socket.emit('user-joined', currentUser);
	}

	function userJoined(allUsers){					//this function prepares new window for newly connected user
		for(i = 0; i < allUsers.length; i++){
			var otherUser = allUsers[i];

			if($('div[user=' + otherUser + ']').length == 0 && otherUser !== currentUser){		//dont create window if user already exists or received user is current user
				var $div = $('<div />');
				$div.html($userTemplate.html());
				$div.attr('user', otherUser);
				$div.find('span[purpose=user-name]').html(otherUser);
				$div.find('div[purpose=editor]').attr('id', otherUser + "Editor");

				$('body').append($div);		

				editors[otherUser] = ace.edit(otherUser + "Editor");			//ACE editor plugin for online IDE capabilities 
			    editors[otherUser].setTheme("ace/theme/monokai");
			    editors[otherUser].getSession().setMode("ace/mode/javascript");	
			    editors[otherUser].setReadOnly(true);
			    editors[otherUser].getSession().on('change', sendEditorMessage);
			}
		}
	}
	
	function userLeft(otherUser){		
		$('div[user=' + otherUser + ']').remove();
		delete editors[otherUser];	//deleting editor object for left user to prevent memory leak
	}
	
	function showUser(){
		$(this).addClass('big');
	}

	function dismissUser(){
		$(this).closest('div[user]').removeClass('big');
		return false;			//false is to prevent event bubbling
	}
	
	function sendChatMessage(){		//function to trigger chat message on enter key
		if(window.event.which === 13){
			var otherUser = $('div.big span[purpose=user-name]').html();

			var message = $(this).val();
			$(this).val('');

			var $li = $('<li />').html(message + ": " + currentUser).addClass('right');
			$('div.big ul[purpose=chat]').append($li);

			socket.emit('message', {
				to: otherUser,
				from: currentUser,
				message: message,
				messageType: 'chat'
			});
		}
	}
	
	function messageReceived(data){
		switch(data.messageType){
			case "chat":
				chatMessageReceived(data);
				break;
			case "control":
				controlMessageReceived(data);
				break;
			case "release":
				releaseMessageReceived(data);
				break;
			case "editor":
				editorMessageReceived(data);
				break;
			default:
				break;
		}
	}

	function chatMessageReceived(data){
		var $parentDiv, $li;

		if(data.to === 'public'){
			$parentDiv = $('div[user=public]');
		}
		else{
			$parentDiv = $('div[user=' + data.from + ']');
		}

		$li = $('<li />').html(data.message + ": " + data.from).addClass('left');
		$parentDiv.find('ul[purpose=chat]').append($li);
		$parentDiv.find('span[purpose=activity]').html("Chat");	
	}
	
	function sendControlMessage(){
		var otherUser = $('div.big span[purpose=user-name]').html();

		$('div.big span[purpose=controlled-by]').html(currentUser);
		editors[otherUser].setReadOnly(false);
		$('div.big [action=control]').attr('disabled', 'disabled');
		$('div.big [action=release]').removeAttr('disabled');

		socket.emit('message', {
			to: otherUser,
			from: currentUser,
			messageType: 'control'
		});				

		return false;
	}
	
	function controlMessageReceived(data){
		var $parentDiv, otherUser;

		if(data.to === 'public'){
			$parentDiv = $('div[user=public]');
			otherUser = 'public';
		}
		else{
			$parentDiv = $('div[user=' + data.from + ']');
			otherUser = data.from;
		}

		$parentDiv.find('span[purpose=controlled-by]').html(data.from);	
		editors[otherUser].setReadOnly(true);
		$parentDiv.find('[action=control]').attr('disabled', 'disabled');
		$parentDiv.find('span[purpose=activity]').html("Control");	
	}

	function sendReleaseMessage(){
		var otherUser = $('div.big span[purpose=user-name]').html();		

		$('div.big span[purpose=controlled-by]').html('');
		editors[otherUser].setReadOnly(true);
		$('div.big [action=control]').removeAttr('disabled');
		$('div.big [action=release]').attr('disabled', 'disabled');

		socket.emit('message', {
			to: otherUser,
			from: currentUser,
			messageType: 'release'
		});				

		return false;
	}

	function releaseMessageReceived(data){
		var $parentDiv, otherUser;

		if(data.to === 'public'){
			$parentDiv = $('div[user=public]');
			otherUser = 'public';
		}
		else{
			$parentDiv = $('div[user=' + data.from + ']');
			otherUser = data.from;
		}

		$parentDiv.find('span[purpose=controlled-by]').html('');	
		editors[otherUser].setReadOnly(true);
		$parentDiv.find('[action=control]').removeAttr('disabled');
		$parentDiv.find('span[purpose=activity]').html("Release");	
	}
	
	function sendEditorMessage(e){
		var otherUser = $('div.big span[purpose=user-name]').html();		

		if (editors[otherUser].curOp && editors[otherUser].curOp.command.name){
			var message = editors[otherUser].getValue();

			socket.emit('message', {
				to: otherUser,
				from: currentUser,
				message: message,
				messageType: 'editor'
			});
		}
	}

	function editorMessageReceived(data){
		var otherUser;

		if(data.to === 'public'){
			otherUser = 'public';
		}
		else{
			otherUser = data.from;
		}
	
		editors[otherUser].setValue(data.message);
		$parentDiv.find('span[purpose=activity]').html("Editor");	
	}
	
	// init
	function Init(){
		socket = io();		//io() fires 'connection' event on server and returns the corresponding socket for that user

		socket.on("connect", socketConnected);		//Client-'connect', Server-'connection','disconnect' are built in events												//'connect' is handshake event to confirm the connection
		socket.on('user-joined', userJoined);		//Receiver event which will be fired from server
		socket.on('user-left', userLeft);			//
		socket.on('message', messageReceived);		//

		$(document).on("keypress", "textarea[purpose=chat]", sendChatMessage);		//sender event, it trigger server events
		$(document).on("click", "a[action=control]:not([disabled])", sendControlMessage);
		$(document).on("click", "a[action=release]:not([disabled])", sendReleaseMessage);

		$(document).on("click", "div[user]", showUser);
		$(document).on("click", "span[action=dismiss]", dismissUser);	

		userJoined(["public"]);
	}

	// init called
	Init();
});



