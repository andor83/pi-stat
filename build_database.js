var sqlite3 = require('sqlite3');
var config = require('./db_config.js');


var config_items = [
	{
		$id: "server_address",
		$value: "http://raspberrypi.local",
		$label: "Server Address",
		$description: "The server's web adddress, used for websocket communication",
		$gui_edit: 1
	},
	{
		$id: "unit_name",
		$value: "Pi-Stat",
		$label: "Unit Name",
		$description: "The name of the unit, displayed in the title bar",
		$gui_edit: 1
	},
	{
		$id: "screensaver_timeout",
		$value: "300",
		$label: "Screen Saver Timeout",
		$description: "The time of inactivity in seconds before the screensaver is loaded",
		$gui_edit: 1
	},
	{
		$id: "software_version",
		$value: "0.1",
		$label: "Software Version",
		$description: "The version of the currently running software",
		$gui_edit: 0
	},
	{
		$id: "thermostat_guage_color",
		$value: "#3C3C3C",
		$label: "Thermostat Guage Color",
		$description: "The color of the thermostate guage on the Home module",
		$gui_edit: 1
	},
];



// load/create db
var db = new sqlite3.Database(config.db_name);

try {
	// serialize commands
	db.serialize(function() {
		// drop config db if exists
		db.run('DROP TABLE IF EXISTS config');
		
		// create config database anew
		db.run('CREATE TABLE config (id TEXT, label TEXT, value TEXT, description TEXT, gui_edit INTEGER)');
		
		// insert config data into database
		var stmt = db.prepare("INSERT INTO config (id, value, label, description, gui_edit) VALUES ($id, $value, $label, $description, $gui_edit)");
		for(x = 0; x < config_items.length; x++) {
			stmt.run(config_items[x]);
		}
		stmt.finalize();
	});
} catch(err) {
	console.log("THERE WAS AN ERROR RUNNING THIS SCRIPT:",ERR);
}

db.close();