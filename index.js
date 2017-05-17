var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var enableWs = require('express-ws');

var server = express();
enableWs(server);
var port = (process.env.PORT || 8080);

var activeGames = {};
var autogame = undefined;
var validColors = {
	white:  ()=>"white",
	black:  ()=>"black",
	random: ()=>Math.random()>.5?"white":"black",
};
function makeKeyPair() {
	var alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	var s1 = "a";
	var s2 = "b";
	for(var i = 0; i < 16; ++i) {
		s1 = s1 + alphabet.charAt(Math.floor(Math.random()*alphabet.length));
		s2 = s2 + alphabet.charAt(Math.floor(Math.random()*alphabet.length));
	}
	return [s1, s2];
}

server.use(bodyParser.urlencoded({extended: false}));
server.use(bodyParser.json());
server.use(express.static(path.join(__dirname, '/static')))

server.get('/', function(req, res) {
	console.log(req.url);
	res.sendFile('index.html', {root: __dirname});
});

function buildGame(creatorcolor) {
	var keys = makeKeyPair();
	return {
		moves:[],
		wkey: keys[0],
		bkey: keys[1],
		joined: false,
		creator: creatorcolor,
		listeners: [],
	};
}

function makeGameId() {
	if(this.counter === undefined) this.counter = 0;
	return "id" + (this.counter++);
}

server.put('/NewGame', function(req, res) {
	console.log(req.body);
	if(activeGames[req.name]) {
		res.json({error:"Please choose a different game name"});
	} else if(validColors[req.body.color] === undefined) {
		res.json({error:"Invalid color"});
	} else {
		var color = validColors[req.body.color]();
		var gameobj = buildGame(color);
		activeGames[req.body.name] = gameobj;
		res.json({
			setup: "new",
			player:color,
			key:   color==="white"?gameobj.wkey:gameobj.bkey,
			moves: [],
			name: req.body.name,
		});
	}
});

server.put('/JoinGame', function(req, res) {
	console.log(req.body);
	var game = activeGames[req.body.name];
	if(game && !game.joined) {
		if(req.body.name === autogame) autogame = undefined;
		game.joined = true;
		res.json({
			setup: "new",
			player:game.creator==="white"?"black":"white",
			key:   game.creator==="white"?game.bkey:game.wkey,
			moves: game.moves,
			name: req.body.name
		});
		alertListeners(game);
	} else if(game) {
		res.json({error:"This game has already been joined"});
	} else {
		res.json({error:"No game with that name exists"});
	}
});

server.put('/AutoMatch', function(req, res) {
	console.log(req.body);
	if(autogame) {
		var game = activeGames[autogame];
		res.json({
			setup: "new",
			player:game.creator==="white"?"black":"white",
			key:   game.creator==="white"?game.bkey:game.wkey,
			moves: game.moves,
			name: autogame,
		});
		alertListeners(game);
		autogame = undefined;
	} else {
		var color = validColors.random();
		var gameobj = buildGame(color);
		autogame = makeGameId();
		while(activeGames[autogame]) autogame = makeGameId();
		activeGames[autogame] = gameobj;
		res.json({
			setup: "new",
			player:color,
			key:   color==="white"?gameobj.wkey:gameobj.bkey,
			moves: [],
			name: autogame,
		});
	}
});

function validateGameReq(reqbdy, res) {
	var game = activeGames[reqbdy.name];
	if(!game) {
		res.json({error:"No game with that name exists"});
	} else if((reqbdy.color==="white"?game.wkey:game.bkey) !== reqbdy.key) {
		res.json({error:"Incorrect key"});
	}
	return game;
}

function isValidMove(game, move, turn) {
	return getTurn(game) === turn;
}

function getTurn(game) {
	var order = ["w", "b", "b", "w"];
	return order[game.moves.length % order.length]
}

function removeClosed(game) {
	var prelen = game.listeners.length;
	for(var i = 0; i < game.listeners.length; ++i) {
		if(game.listeners[i].readyState === 3) {
			game.winner = game.listeners[i].color==="white"?"b":"w";
		}
	}
	game.listeners = game.listeners.filter(ws => ws.readyState !== 3);
	alertListeners(game);
}

function alertws(game, ws) {
	if(ws.readyState === 1)
		ws.send(JSON.stringify({
			moves:game.moves,
			joined:game.listeners.length - 1,
			winner: game.winner,
			offerDraw: game.offerDraw
		}));
}

function alertListeners(game) {
	game.listeners.forEach(l => {
		alertws(game, l);
	});
}

server.ws('/listen', function(ws, params) {
	ws.on('message', msg => {
		var req = JSON.parse(msg);
		var res = {json(a){ws.send(JSON.stringify(a)); ws.close()}};
		var game = validateGameReq(req, res);
		if(game) {
			if(req.movenum < game.moves.length) {
				alertws(game, ws);
			}
			game.listeners.push(ws);
			ws.game = game;
			ws.color = req.color;
		}
		alertListeners(game);
	});
	ws.on('close', () => {
		setTimeout(() => removeClosed(ws.game), 0);
		console.log("websocket closed");
	})
});

server.put('/Move', function(req, res) {
	console.log(req.body);
	var game = validateGameReq(req.body, res);
	if(!game) return;
	if(req.body.movenum !== game.moves.length) {
		res.json({success: true});
	} else if(isValidMove(game, req.body.move, req.body.turn)) {
		game.moves.push(req.body.move);
		game.offerDraw = undefined;
		alertListeners(game);
		res.json({success: true});
	} else {
		res.json({error:"Invalid move"});
	}
});

server.put('/Resign', function(req, res) {
	console.log(req.body);
	var game = validateGameReq(req.body, res);
	if(!game) return;
	game.winner = req.body.color ==="white"?"b":"w";
	alertListeners(game);
	res.json({success: true});
});

server.put('/OfferDraw', function(req, res) {
	console.log(req.body);
	var game = validateGameReq(req.body, res);
	if(!game) return;
	var color = req.body.color ==="white"?"w":"b";
	if(game.offerDraw && game.offerDraw !== color) {
		game.winner = "Tie";
	} else if(!game.offerDraw) {
		game.offerDraw = color;
	}
	alertListeners(game);
	res.json({success: true});
});

server.listen(port, function() {
	console.log('server listening on port ' + port);
});