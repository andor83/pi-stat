
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var pi = require('./routes/pi');
var http = require('http');
var path = require('path');
var io_req = require('socket.io');
var sqlite3 = require('sqlite3');
var db_config = require(path.join(__dirname, 'db_config.js'));
var db = new sqlite3.Database(db_config.db_name);
var gpio = require('gpio');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser('abcde12345'));
app.use(express.session());
app.use(express.static(path.join(__dirname, 'public')));
app.use(config_mw);
app.use(app.router);


// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/pi/', pi.index);
app.get('/pi/debug', pi.debug);

var server = http.createServer(app);
var io = io_req.listen(server);

server.listen(app.get('port'), function(){
  console.log('Thermostat server listening on port ' + app.get('port'));
});


//config middleware injects app config from database into requests
function config_mw(req, res, next) {
	req.config = {};
	
	db.serialize(function() {
		db.all("SELECT * FROM config", function(err, rows) {
			for(x = 0; x < rows.length; x++) {
				if(err) throw err;

				req.config[rows[x].id] = {
					id: rows[x].id,
					value: rows[x].value,
					description: rows[x].description,
					label: rows[x].label
				};
			}
	
			next();
		});
		
	});
}

// set up server state
var server_state = {
	op_mode: "standby",
	system_status: "on",
	current_temp: 75,
	target_low: 68,
	target_high: 82
}


var gpio4 = gpio.export(4, {
	direction: 'out',
	interval: 200,
	ready: function() {
		setInterval(function() {
			check_temp();
		}.bind(), 1000);
	}
});



// handle incoming comm packets, rebroadcasting to other connected devices
io.sockets.on('connection', function(socket) {
	socket.on('change_values', function(data) {
		for(x=0; x < data.values.length; x++) {
			server_state[data.values[x].key] = data.values[x].value;
		}
		socket.broadcast.emit('change_values',data);
	});
	
	socket.on('get_server_state', function(data) {
		var ss_keys = Object.keys(server_state);
		
		var values_to_emit = [];
		
		for(x = 0; x < ss_keys.length; x++) {
			values_to_emit.push({ key: ss_keys[x], value: server_state[ss_keys[x]] });
		}
		
		socket.emit('change_values',{
			version: "1.0",
			status: "ok",
			values: values_to_emit
		});
	})
});

function check_temp() {
	if(server_state.current_temp > server_state.target_high && server_state.system_status == "on") {
		turn_on_ac();
	} else if(server_state.current_temp < server_state.target_low && server_state.system_status == "on") {
		turn_on_heat();
	} else {
		turn_off_all();
	}
}

function turn_on_heat() {
	//not implemented
	console.log("Heat not yet implemented");
}

function turn_on_ac() {
	if(server_state.op_mode != "cooling") {
		console.log("Attempting to turn on AC");
		gpio4.set(function() {
			server_state.op_mode = "cooling";
			console.log("AC ON");
			io.sockets.emit("change_op_mode",{
				version: "1.0",
				status: "ok",
				op_mode: "cooling"
			});
		});
	}
}

function turn_off_all() {
	if(server_state.op_mode != "standby") {
		console.log("Attempting to enter standby");
		gpio4.set(0,function() {
			server_state.op_mode = "standby";
			console.log("AC and Heat off",gpio4.value);
			io.sockets.emit("change_op_mode",{
				version: "1.0",
				status: "ok",
				op_mode: "standby"
			});
			
		}.bind(this));
	}
}

