var thermo_controller = new thermo(options);

$(document).ready(function() {
	
	AmCharts.ready(function() {
		thermo_controller.init();
	});
	
});

function thermo(options) {
	// set modules
	this.modules = {
		'home': {
			element: $('div#home.module').data('ctrl',this),
			menu_item_element: false
		},
		'scheduling': {
			element: $('div#scheduling.module').data('ctrl',this),
			menu_item_element: false
		},
		'history': {
			element: $('div#history.module').data('ctrl',this),
			menu_item_element: false
		},
		'weather': {
			element: $('div#weather.module').data('ctrl',this),
			menu_item_element: false
		}
	}
	
	// set options
	this.options = $.extend({},options);
	
	// set up socket comm
	this.socket = io.connect(this.options.server_address.value);
	
	this.client_state = {
		current_temp: 72.5,
		target_low: 68,
		target_high: 82,
		op_mode: "standby"
	}
	
	this.init = function(options) {	
		// add footer menu
		this.footer_menu_tr_element = $("table#menu tbody tr");
		$.each(this.modules, function(key, value) {
			tmp = $("<td class='menu_button'>").html(key).attr('menu_key',key).attr('id',key+'_menu_button').data('ctrl',value.element.data('ctrl')).on('click',function(e) {
				ctrl = $(this).data('ctrl');
				ctrl.switch_module( $(this).attr('menu_key') );
			});
			value.element.data('ctrl').footer_menu_tr_element.append(tmp);
			value.menu_item_element = tmp;
		});
	
		// set up temp gauge
		this.temp_gauge = {
			chart: new AmCharts.AmAngularGauge(),
			axis: new AmCharts.GaugeAxis(),
			arrow: new AmCharts.GaugeArrow(),
			band_low: new AmCharts.GaugeBand(),
			band_high: new AmCharts.GaugeBand(),
			band_mid: new AmCharts.GaugeBand()
		};
		
		this.temp_gauge.arrow.value = this.client_state.current_temp;
		this.temp_gauge.chart.addArrow(this.temp_gauge.arrow);
		this.temp_gauge.chart.fontFamily = "Arial";
		this.temp_gauge.chart.color = this.options.thermostat_guage_color.value;
		this.temp_gauge.chart.fontSize = 9;
		this.temp_gauge.chart.addAxis(this.temp_gauge.axis);
		this.temp_gauge.axis.axisColor = this.options.thermostat_guage_color.value;
		this.temp_gauge.axis.labelFrequency = 1;
		this.temp_gauge.axis.minorTickInterval = 2.5;
		this.temp_gauge.axis.valueInterval = 10;
		

		this.temp_gauge.chart.write("temp_chart");
		this.refresh_gauge_axis();
		
		// set up slider controls
		this.temp_slider = $( "#temp_controls" ).data('ctrl',this).slider({
	    	range: true,
		    min: 40,
		    max: 100,
		    values: [ this.client_state.target_low, this.client_state.target_high ],
		    animate: "fast",
		    height: 80,
		    slide: function( event, ui ) {
		    	var ctrl = $(this).data('ctrl');
		    	ctrl.set_low_trigger(ui.values[0],false);
		    	ctrl.set_high_trigger(ui.values[1],false);
		    	ctrl.refresh_gauge_axis();
		    },
		    stop: function( event, ui ) {
			    var ctrl = $(this).data('ctrl');
		    	ctrl.set_low_trigger(ui.values[0],false);
		    	ctrl.set_high_trigger(ui.values[1],false);
		    	ctrl.refresh_gauge_axis();
		    	ctrl.socket.emit('change_values', {
		    		version: "1.0",
		    		status: "ok",
		    		values: [
		    			{
		    				key:'target_low',
		    				value: ctrl.client_state.target_low
		    			},
		    			{
		    				key:'target_high',
		    				value: ctrl.client_state.target_high
		    			}
		    		]
		    	});
		    }
	    });
	    $("#temp_controls .ui-slider-handle").css({ height: "28px", width: "32px" }).each(function(index,value) {
	    	if(index==1) 
	    		$(this).html('H');
	    	else
	    		$(this).html('L');
	    });
	    
	    // on/off switch
	    $("#on_off_switch").buttonset();
	    
	    // op mode
	    this.change_op_mode('standby');
	    
	    
	    
	    // set up socket handlers
	    this.socket.on('change_values', function(data) {
	    	for(x=0; x < data.values.length; x++) {
				this.client_state[data.values[x].key] = data.values[x].value;
			}

			// update interface
			this.temp_slider.slider("values", [this.client_state.target_low, this.client_state.target_high]);
			this.temp_gauge.arrow.setValue(this.client_state.current_temp);
			this.refresh_gauge_axis();
			this.change_op_mode(this.client_state.op_mode);
	    }.bind(this));
	    
	    this.socket.on('change_op_mode',function(data) {
	    	console.log(data);
	    	this.change_op_mode(data.op_mode);
	    }.bind(this));
	    
	    // ask for fresh state
	    this.socket.emit('get_server_state',{version: "1.0", status: "ok"});
	    
	    		
		// show home module
		this.switch_module('home');
		
		
		// ss timers
		this.ss_update_timer = setInterval(function() {
			this.update_ss();
		}.bind(this), 500);
		this.ss_trigger_timer = setTimeout(function() {
			this.ss_activate();
		}.bind(this),10000);//this.options.screensaver_timeout.value*1000);
		$("*").bind('click', function() {
			this.ss_deactivate();
		}.bind(this));
		$("#op_mode").on('click',function(e) {
			e.preventDefault();
			e.stopPropagation();
			this.ss_activate();
		}.bind(this));
		this.tick_tock = 0;
		
	};
	
	this.update_ss = function() {
		if(this.ss_active) {
			if(Math.random() > 0.7) this.activate_nyan();
			var d = new Date();
			var dots = " ";
			if(this.tick_tock == 0) {
				this.tick_tock = 1;
				dots = ":";
			} else {
				this.tick_tock = 0;
				dots = " ";
			}
			$("#clock_and_temp").html((d.getMonth()+1) + "/" + d.getDate() + "/" + d.getFullYear() + "<br/>" + (d.getHours() == 0 ? "12" : d.getHours()) + "<span style='display: inline-block; width: 12px; top: -4px'>" + dots + "</span>" + (d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes()) + "<br/>" + this.client_state.current_temp + "&deg;F");
		}
	};
	
	this.ss_activate = function() {
		this.ss_active = true;
		$("#screen_saver").addClass("active");	
	};
	
	this.ss_deactivate = function() {
		this.ss_active = false;
		$("#screen_saver").removeClass("active");
		window.clearTimeout(this.ss_trigger_timer);
		this.ss_trigger_timer = setTimeout(function() {
			this.ss_activate();
		}.bind(this),this.options.screensaver_timeout.value*1000);
	};
	
	this.activate_nyan = function() {
		console.log("look at nyan gooooo");
		var t = Math.round(Math.random() * 240);
		
		$("#screen_saver").append($("<div class='nyan'>").css({top: t+"px", left: "-100px"}).animate({left:"320px"}, 2000, function() {
			$(this).remove();
		}));
	}
	
	
	this.set_current_temp = function(temp) {
		// set temp and update interface
		this.client_state.current_temp = temp;
		this.temp_gauge.arrow.setValue(this.client_state.current_temp);
	};
	
	this.set_low_trigger = function(temp, refresh) {
		// set temp and update interface
		this.client_state.target_low = temp;
		if("undefined" == typeof refresh || refresh) this.refresh_gauge_axis();
	};
	
	this.set_high_trigger = function(temp, refresh) {
		// set temp and update interface
		this.client_state.target_high = temp;
		if("undefined" == typeof refresh || refresh) this.refresh_gauge_axis();
	};
	
	this.refresh_gauge_axis = function() {
	    this.temp_gauge.band_low.startValue = 0;
	    this.temp_gauge.band_low.endValue = this.client_state.target_low;
	    this.temp_gauge.band_low.color = "#9999FF";
	    this.temp_gauge.band_low.innerRadius = 75;
	    this.temp_gauge.band_mid.startValue = this.client_state.target_low;
	    this.temp_gauge.band_mid.endValue = this.client_state.target_high;
	    this.temp_gauge.band_mid.color = "#33FF33";
	    this.temp_gauge.band_mid.innerRadius = 0;
	    this.temp_gauge.band_high.startValue = this.client_state.target_high;
	    this.temp_gauge.band_high.endValue = 120;
	    this.temp_gauge.band_high.color = "#FF6666";
	    this.temp_gauge.band_high.innerRadius = 75;
	    
	    this.temp_gauge.axis.bands = [this.temp_gauge.band_low, this.temp_gauge.band_mid, this.temp_gauge.band_high];
	    this.temp_gauge.axis.startValue = 0;
		this.temp_gauge.axis.endValue = 120;
		this.temp_gauge.axis.bottomTextYOffset = -20;
	    this.temp_gauge.axis.setBottomText(this.client_state.current_temp + " F");
	    
	    this.temp_gauge.chart.validateNow();
	};
	
	this.switch_module = function(module_key) {
		// makes sure that corrent transitions are applied based on the order the modules are defined
		var before = true;
		var found = false;
		$.each(this.modules, function(key, value) {
			if(before) {
				value.element.removeClass('right');
				value.element.addClass('left');
			} else {
				value.element.removeClass('left');
				value.element.addClass('right');
			}
			value.menu_item_element.removeClass('active');
			
			value.element.removeClass('active');
			if(key == module_key) {
				found = value.element;
				value.element.addClass('active');
				value.menu_item_element.addClass('active');
				before = false;
			}
		});
		
		return found;
	};
	
	this.change_op_mode = function(op_mode) {
		this.client_state.op_mode = op_mode;
		var state_map = {
			"heating": "charizard.gif",
			"cooling": "vanillite.gif",
			"standby": "snorlax.gif"
		}
		
		$("#op_mode").fadeTo(500,0,function() {
			$(this).html('').append($("<img src='/images/" + state_map[op_mode] + "' />")).fadeTo(500,1);
		})
		
	};
}