exports.index = function(req, res){
  res.render('pi_index', { 
  	title: req.config.unit_name.value + " - " + req.config.software_version.value,
  	config: req.config
  	
  });
};

exports.debug = function(req, res){
	console.log(req.config);
  res.render('debug', { title: 'DEBUG OUTPUT TO CONSOLE' });
};