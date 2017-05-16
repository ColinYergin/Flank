var players = {
	b: "Human",
	w: "Human"
};
var Agents = {
	Human(c) {UIoptions = enumMoves(c);drawUIOptions();},
	Random(c) {setTimeout(()=>RandomAgent(c),100);},
	Network(c) {}
};
var networkInfo = undefined;
var UIoptions = [];
var board = {
	height: 5,
	width: 5,
	turns: ["w", "b", "b", "w"],
	get turn() {return this.turns[this.turnind % this.turns.length];},
	get nextturn() {return this.turns[(this.turnind+1)%this.turns.length];},
	get prevturn() {return this.turns[(this.turnind+this.turns.length-1)%this.turns.length];},
	history: [],
	turnind: 0,
	inRange(x, y) {return x >= 0 && x < this.width && y >= 0 && y < this.height;},
	get: function(x, y) {return this[x+","+y];},
	set: function(x, y, c) {
		this[x+","+y] = c;
		var square = document.getElementById("s"+x+","+y);
		if(square.querySelector(".circle")) {
			square.removeChild(square.querySelector(".circle"));
		}
		if(c) {
			var piece = document.createElement("DIV");
			piece.className = c + " circle";
			square.appendChild(piece);
		}
	},
	triggerNextTurn: function() {
		Agents[players[this.turn]](this.turn);
	},
	doturn: function(action, trigger) {
		this.history.push(action);
		if(players[this.turn === "b"?"w":"b"] === "Network" && players[this.turn] === "Human") {
			SendMove(action, this.turn);
		}
		if(action.type === "move") {
			this.set(...action.from, undefined);
			this.set(...action.to, this.turn);
		} else if(action.type === "make") {
			this.set(...action.loc, this.turn);
		}
		this.turnind = this.turnind + 1;
		this.recordScore();
		if(trigger || trigger === undefined) this.triggerNextTurn();
	},
	get_state: function() {
		kv = [];
		this.each((e, x, y)=>kv.push([x+","+y, e]));
		kv.push(["turn", this.turn])
		return kv;
	},
	set_state: function(kv) {
		var x = this;
		kv.forEach(a=>x[a[0]]=a[1]);
		return this;
	},
	setup: function() {
		var mid = (this.width-1)/2;
		this.each((c,x,y)=> this.set(x,y,undefined));
		this.set(Math.round(mid-1), 0, "w");
		this.set(Math.round(mid+1), 0, "w");
		this.set(Math.round(mid-1), this.height-1, "b");
		this.set(Math.round(mid+1), this.height-1, "b");
		UIoptions = [];
		drawUIOptions();
		this.history = [];
		this.recordScore();
	},
	recordScore: function() {
		document.getElementById("wscore").innerHTML = this.score("w");
		document.getElementById("bscore").innerHTML = this.score("b");
	},
	score: function(c) {
		count = 0;
		this.each((e,x,y)=>count += e===c?1:0);
		return count;
	},
	each: function(cb) {
		for(var y = 0; y < board.height; ++y) {
			for(var x = 0; x < board.width; ++x) {
				cb(this.get(x, y), x, y);
			}
		}
	},
	get str() {
		var str = this.turn + this.nextturn;
		for (var y = board.height - 1; y >= 0; y--) {
			for (var x = board.width - 1; x >= 0; x--) {
				str += this.get(x, y);
			}
		}
		return str;
	},
};

window.onload = () => {
	var boarddiv = document.getElementById("board");
	var tbl = document.createElement("TABLE");
	tbl.id = "boardTable";
	tbl.className = "eventbl";
	boarddiv.appendChild(tbl);
	for(var y = 0; y < board.height * 2; ++y) {
		var row = document.createElement("TR");
		row.id = "br"+y;
		row.className = "boardRow";
		tbl.appendChild(row);
		for(var x = 0; x < board.width * 2; ++x) {
			var square = document.createElement("TD");
			square.className = "bcell"+(x%2?" lbord ":"")+(y%2?" ubord":"");
			square.id = "bs"+x+","+y;
			row.appendChild(square);
		}
	}
	var tbl2 = document.createElement("TABLE");
	tbl2.id = "piecesTable";
	tbl2.className = "eventbl";
	boarddiv.appendChild(tbl2);
	for(var y = 0; y < board.height; ++y) {
		var row = document.createElement("TR");
		row.id = "r"+y;
		row.className = "pieceRow";
		tbl2.appendChild(row);
		for(var x = 0; x < board.width; ++x) {
			var square = document.createElement("TD");
			square.className = "pieceCell";
			square.id = "s"+x+","+y;
			row.appendChild(square);
			square.addEventListener("click", clickHandler(x,y));
		}
	}
	board.setup();
	Agents[players[board.turn]](board.turn);
};

function DrawJoined() {
	if(networkInfo && networkInfo.joined) {
		document.getElementById("joined").innerHTML = "Opponent has joined game";
	} else {
		document.getElementById("joined").innerHTML = "Waiting for Opponent";
	}
	if(networkInfo && networkInfo.offerDraw && networkInfo.offerDraw !== networkInfo.mycolor) {
		document.getElementById("drawOffer").innerHTML = "Opponent has offered a draw";
		document.getElementById("offer_draw").innerHTML = "Declare Draw";
	} else {
		document.getElementById("drawOffer").innerHTML = "";
		document.getElementById("offer_draw").innerHTML = "Offer Draw";
	}
}

function drawUIOptions() {
	document.querySelectorAll(".optind").forEach(o=>o.parentNode.removeChild(o));
	UIoptions.forEach(m => {
		var square = document.getElementById("s"+m.ui[0][0]+","+m.ui[0][1]);
		if(!square.querySelector(".optind")) {
			var optind = document.createElement("DIV");
			optind.className = "optind";
			square.appendChild(optind);
		}
	})
}

function recordError(e) {
	document.getElementById("lasterror").innerHTML = e;
}

function clickHandler(x, y) {
	return e => {
		if(players[board.turn] === "Human") {
			var newopts = UIoptions.filter(m => m.ui[0].join() === [x,y].join());
			if(newopts.length > 0) {
				newopts.forEach(m => m.ui.shift());
				UIoptions = newopts;
				if(UIoptions.length === 1 && UIoptions[0].ui.length === 0) {
					UIoptions = [];
					board.doturn(newopts[0]);
				}
			} else if(newopts.length === 0) {
				UIoptions = enumMoves(board.turn);
			}
			drawUIOptions();
		}
	}
}

function RandomAgent(c) {
	var moves = enumMoves(c);
	if(moves.length === 0) {
		console.log("No moves");
	} else {
		board.doturn(moves[Math.floor(Math.random()*moves.length)]);
	}
}

function enumMoves(c) {
	var moves = [];
	for(var x = 0; x < board.width; ++x) {
		for(var y = 0; y < board.height; ++y) {
			if(board.inRange(x, y) && !board.get(x, y)) {
				adj = [[-1,0],[1,0],[0,-1],[0,1]].map(c=>[c[0]+x,c[1]+y]);
				adj.forEach(coords => {
					if(board.get(...coords) === c) {
						moves.push({
							type:"move",
							from: coords,
							to: [x, y],
							ui: [coords, [x, y]],
						});
					}
				});
			}
			if((board.get(x+1,y) === c && board.get(x-1,y) === c && board.get(x,y) !== c) || 
			   (board.get(x,y+1) === c && board.get(x,y-1) === c && board.get(x,y) !== c)) {
				moves.push({
					type:"make",
					loc:[x,y],
					ui:[[x,y]],
					takes: board.get(x,y),
				});
			}
		}
	}
	return moves;
}

function SetupObject(res) {
	if(res.setup === "new") {
		var colors = {white:"w", black:"b"};
		var othercolor = {white:"b", black:"w"};
		players[colors[res.player]] = "Human";
		players[othercolor[res.player]] = "Network";
		board.setup();
		networkInfo = {
			key: res.key,
			mycolor: colors[res.player],
			color: res.player,
			name: res.name,
			joined: res.joined,
		}
		res.moves.forEach(m => board.doturn(m));
		console.log(networkInfo);
		DrawJoined();
		board.turnind = 0;
		board.triggerNextTurn();
		StartListening();
		Array.from(document.getElementsByClassName("gamecontrol")).forEach(x=>x.hidden = true);
		document.getElementById("GameInfo").hidden = false;
		document.getElementById("winner").innerHTML = "";
		document.getElementById("lasterror").innerHTML = "";
		document.getElementById("game_info_name").innerHTML = res.name;
		document.getElementById("game_info_color").innerHTML = networkInfo.color;
	}
}

function FinishGame(winner) {
	document.getElementById("winner").innerHTML = "Winner: " + (winner==="w"?"White":winner==="b"?"Black":"Tie");
	document.getElementById("GameInfo").hidden = true;
	UIoptions = [];
	Array.from(document.getElementsByClassName("gamecontrol")).forEach(x=>x.hidden = false);
}

function StartListening() {
	var ws = new WebSocket("ws" + String(document.location).substr(4) + "listen/");
	ws.onmessage = msg => {
		var res = JSON.parse(msg.data);
		for(var i = board.turnind; i < res.moves.length; ++i) {
			board.doturn(res.moves[i], i+1===res.moves.length);
		}
		networkInfo.joined = res.joined;
		networkInfo.offerDraw = res.offerDraw;
		DrawJoined();
		if(res.winner) {
			FinishGame(res.winner);
		}
	};
	ws.onclose = () => recordError("Lost connection to server");
	ws.onerror = () => recordError("Error while waiting for moves");
	ws.onopen = () => 
		ws.send(JSON.stringify({
			color: networkInfo.color,
			name: networkInfo.name,
			key: networkInfo.key,
			movenum: board.turnind,
		}));
}

function SendMove(move, turn) {
	var xhr = new XMLHttpRequest();
	xhr.open('PUT', 'Move');
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.timeout = 1000;
	xhr.onreadystatechange = function() {
		if(xhr.readyState === XMLHttpRequest.DONE) {
			if(xhr.status === 200) {
				var res = JSON.parse(xhr.responseText);
				if(res.error) {
					recordError(res.error);
				} else {
					console.log("sent move");
				}
			} else {
				recordError("Couldn't send move, retrying");
				setTimeout(() => SendMove(move), 500);
			}
		}
	};
	xhr.ontimeout = function() {
		recordError("Couldn't send move, retrying");
		setTimeout(() => SendMove(move), 0);
	};
	xhr.send(JSON.stringify({
		color: networkInfo.color,
		name: networkInfo.name,
		key: networkInfo.key,
		move: move,
		turn: turn,
		movenum: board.turnind,
	}));
}

function NewGameFormSubmit() {
	var color = document.querySelector('input[name=color]:checked').value;
	var name = document.getElementById("GameName").value;
	var xhr = new XMLHttpRequest();
	xhr.open('PUT', 'NewGame');
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.onreadystatechange = function() {
		if(xhr.readyState === XMLHttpRequest.DONE) {
			if(xhr.status === 200) {
				var res = JSON.parse(xhr.responseText);
				if(res.error) recordError(res.error);
				else SetupObject(res);
			} else {
				recordError("Couldn't start game");
			}
		}
	};
	xhr.send(JSON.stringify({color:color, name:name}));
}

function JoinGameFormSubmit() {
	var color = document.querySelector('input[name=color]:checked').value;
	var name = document.getElementById("GameName").value;
	var xhr = new XMLHttpRequest();
	xhr.open('PUT', 'JoinGame');
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.onreadystatechange = function() {
		if(xhr.readyState === XMLHttpRequest.DONE) {
			if(xhr.status === 200) {
				var res = JSON.parse(xhr.responseText);
				if(res.error) recordError(res.error);
				else SetupObject(res);
			} else {
				recordError("Couldn't join game");
			}
		}
	};
	xhr.send(JSON.stringify({color:color, name:name}));
}

function AutoMatchFormSubmit() {
	var xhr = new XMLHttpRequest();
	xhr.open('PUT', 'AutoMatch');
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.onreadystatechange = function() {
		if(xhr.readyState === XMLHttpRequest.DONE) {
			if(xhr.status === 200) {
				var res = JSON.parse(xhr.responseText);
				if(res.error) recordError(res.error);
				else SetupObject(res);
			} else {
				recordError("Couldn't auto match");
			}
		}
	};
	xhr.send(JSON.stringify({}));
}

function ResignFormSubmit() {
	var xhr = new XMLHttpRequest();
	xhr.open('PUT', 'Resign');
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.onreadystatechange = function() {
		if(xhr.readyState === XMLHttpRequest.DONE) {
			if(xhr.status === 200) {
				var res = JSON.parse(xhr.responseText);
				if(res.error) recordError(res.error);
			} else {
				recordError("Couldn't resign, retrying");
				setTimeout(ResignFormSubmit, 500);
			}
		}
	};
	xhr.send(JSON.stringify({
		color: networkInfo.color,
		name: networkInfo.name,
		key: networkInfo.key
	}));
}

function DrawFormSubmit() {
	var xhr = new XMLHttpRequest();
	xhr.open('PUT', 'OfferDraw');
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.onreadystatechange = function() {
		if(xhr.readyState === XMLHttpRequest.DONE) {
			if(xhr.status === 200) {
				var res = JSON.parse(xhr.responseText);
				if(res.error) recordError(res.error);
			} else {
				recordError("Couldn't offer draw, retrying");
				setTimeout(DrawFormSubmit, 500);
			}
		}
	};
	xhr.send(JSON.stringify({
		color: networkInfo.color,
		name: networkInfo.name,
		key: networkInfo.key
	}));
}