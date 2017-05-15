var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');

var server = express();
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

function makeWord() {
	var vowels = "aeiou";
	var consonants = "bcdfghjklmnpqrstvwxyz";
	var pick = str=>str.charAt(Math.floor(Math.random() * str.length));
	return pick(consonants) + pick(vowels) + pick(consonants) + pick(vowels) + pick(consonants);
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
			name: req.body.name,
			joined: game.joined,
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
		game.joined = true;
		res.json({
			setup: "new",
			player:game.creator==="white"?"black":"white",
			key:   game.creator==="white"?game.bkey:game.wkey,
			moves: game.moves,
			name: autogame,
			joined: game.joined,
		});
		alertListeners(game);
		autogame = undefined;
	} else {
		var color = validColors.random();
		var gameobj = buildGame(color);
		autogame = makeWord();
		while(activeGames[autogame]) autogame = makeWord();
		activeGames[autogame] = gameobj;
		res.json({
			setup: "new",
			player:color,
			key:   color==="white"?gameobj.wkey:gameobj.bkey,
			moves: [],
			name: autogame,
			joined: gameobj.joined,
		});
	}
});

function validateGameReq(req, res) {
	var game = activeGames[req.body.name];
	if(!game) {
		res.json({error:"No game with that name exists"});
	} else if((req.body.color==="white"?game.wkey:game.bkey) !== req.body.key) {
		res.json({error:"Incorrect key"});
	}
	return game;
}

function isValidMove(game, move) {
	return true;
}

function getTurn(game) {
	var order = ["w", "b", "b", "w"];
	return order[game.moves.length % order.length]
}

function alertListeners(game) {
	game.listeners.forEach(l => {
		l.json({moves:game.moves, joined:game.joined});
	});
	game.listeners = [];
}

server.put('/Listen', function(req, res) {
	console.log(req.body);
	var game = validateGameReq(req, res);
	if(!game) return;
	if(req.body.movenum < game.moves.length) {
		res.json({moves:game.moves, joined:game.joined});
	} else {
		game.listeners.push(res);
		console.log("added listener");
	}
});

server.put('/Move', function(req, res) {
	console.log(req.body);
	var game = validateGameReq(req, res);
	if(!game) return;
	if(isValidMove(game, req.body.move)) {
		game.moves.push(req.body.move);
		alertListeners(game);
		res.json({success: true});
	} else {
		res.json({error:"Invalid move"});
	}
});

server.listen(port, function() {
	console.log('server listening on port ' + port);
});