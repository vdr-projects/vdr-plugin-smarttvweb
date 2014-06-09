var Timers = {
	timerList : [],
	scrollDur : 100,
	scrollFlip : 100,
	btnMode : 0
	// 0 nothing
	// 1: delete
	// 2: 
};

Timers.init = function() {
	/*
	div with scrolling property
	defualt: left ad right half
	Line has "RecOngoing" "Channel" "Start" "Stop" "Title"
	*/

	this.btnSelected = 0;
	this.scrolling = false;
	
	var elem = document.getElementById('timerScreen-anchor');
	elem.setAttribute('onkeydown', 'Timers.onInput();');

	$("#timerScreen").hide();	
};

Timers.show = function() {
	Main.log("Timers.show");
	$("#timerScreen").show();
	this.btnSelected = 0;

	Timers.focus();
	Timers.readTimers();
//	Timers.debug();
};

Timers.focus = function () {
	Main.log("Timers.focus");

	$("#timerScreen-anchor").focus();
};

Timers.debug = function () {
	for (var i = 0; i < 20; i++) {
		Timers.timerList.push( {title: "Timer One two three VZGTTTTTTGFDDD GHGZG"+i, isSingleEvent: true, printday:"", weekdays:0,
			day: 0, start:2015, stop:2013, starttime: 0, stoptime: 0, channelid: "", channelname : "Hello Channel", flags: 0,
			index: i, isrec: false, eventid: 0 });

	}
	Timers.createMenu();	
};

Timers.hide = function() {

	$("#timerScreen").hide();	
	Main.changeState(Main.eMAIN);
	Main.enableKeys();

	Timers.timerList = [];
	$("#timerTable").remove();

};

Timers.insertColon = function (t) {
// insert the collon before the last two digits
	var len = t.length;

	var o = t;
	if (len >= 2) {
		o = t.substr(0, (len-2)) + ":" + t.substr(len-2);
		switch (o.length) {
			case 3:
				o = "00" +o;
				break;
			case 4:
				o = "0" + o;
				break;
		};
	}
	return o;
};

Timers.readTimers = function () {
	var url = Config.serverUrl + "/timers.xml";
	$.ajax({
		url: url,
		type : "GET",
		success : function(data, status, XHR ) {
			Main.log ("Timers: Got response");
			$(data).find("timer").each(function () {
				var title = $(this).find('file').text();
				var isSingleEvent = ($(this).find('issingleevent').text() == "true") ? true : false;
				
				var printday = $(this).find('printday').text();
				var weekdays = parseInt($(this).find('weekdays').text());
				var day = parseInt($(this).find('day').text());
				var start = $(this).find('start').text();
				var stop = $(this).find('stop').text();
				var starttime = parseInt($(this).find('starttime').text());
				var stoptime = parseInt($(this).find('stoptime').text());
				var channelid = $(this).find('channelid').text();
				var channelname = $(this).find('channelname').text();				
				var flags = parseInt($(this).find('flags').text());
				var index = parseInt($(this).find('index').text());
				var isrec = ($(this).find('isrec').text() == "true") ? true: false;
				var eventid = parseInt($(this).find('eventid').text());
				
				Timers.timerList.push( {title: title, isSingleEvent: isSingleEvent, printday:printday, weekdays:weekdays,
					day: day, start: Timers.insertColon(start), stop: Timers.insertColon(stop), starttime: starttime, stoptime: stoptime, channelid: channelid, channelname : channelname,
					flags: flags, index: index, isrec: isrec, eventid: eventid });
			});
			
			Timers.createMenu();
		},
		error : function (jqXHR, status, error) {
			Main.logToServer ("Timers: Not found!!!");
		}
		});			
};

Timers.createMenu= function () {	
	var p_width = $("body").outerWidth();
	var p_height = $("body").outerHeight();

	var table = $("<div>", {id : "timerTable", style :"overflow-y: scroll;margin-top:3px;margin-bottom:3px; padding-right:3px; height:100%;"});
	$("#timerView").append(table);
	
	$("#timerScreen").show();
	var cur_date = 0;
	for (var i = 0; i < Timers.timerList.length; i++) {
		Main.log("Timers: " + Timers.timerList[i].title);
		
		if (Timers.timerList[i].isSingleEvent == false) {
			cur_date = 0; 
			table.append( $("<div>", { text : ((Timers.timerList[i].day != 0) ? (Timers.getPrintDate(Timers.timerList[i].day) + " - ") : "") +Timers.getWeekdays(Timers.timerList[i].weekdays), class : "style_menuItem style_headline", style : "text-align:left;overflow-x: hidden;white-space : nowrap;"}));			

		}else if (cur_date != Timers.timerList[i].day) {
			cur_date = Timers.timerList[i].day; 
			table.append( $("<div>", { text : Timers.getPrintDate(Timers.timerList[i].day) , class : "style_menuItem style_headline", style : "text-align:left;overflow-x: hidden;white-space : nowrap;"}));			
		}
		table.append(Timers.createEntry(i, $("#timerTable").width()));
	}

	this.btnSelected = 0;
	$("#tmr-0").removeClass('style_menuItem').addClass('style_menuItemSelected'); 
	

};

Timers.getPrintDate = function (day) {
	var d = new MyDate (day * 1000);
	return d.getDate() + "." + (d.getMonth() +1) + "." + d.getFullYear();	 
};

Timers.getWeekdays = function (wd) {
	var map = wd.toString(2);
	var res = "";

	if (map.length <= 7) {
		var suf = "0000000".slice(0, (7-map.length));
		map = suf + map;
	}
	else {
		// take the last 7 digits
		map = map.slice ((7-map.length));
	}

	res += ((map[6] == "1") ? "M" : "-");
	res += ((map[5] == "1") ? "T" : "-");
	res += ((map[4] == "1") ? "W" : "-");
	res += ((map[3] == "1") ? "T" : "-");
	res += ((map[2] == "1") ? "F" : "-");
	res += ((map[1] == "1") ? "S" : "-");
	res += ((map[0] == "1") ? "S" : "-");

	return res;	 
};

Timers.createEntry= function (i, w) {
	Main.log("width= " +w);
	
	var row = $("<div>", {id: "tmr-"+i, class : "style_menuItem", style : "text-align:left;overflow-x: hidden;white-space : nowrap;"}); //, style : "text-overflow: ellipsis;white-space : nowrap;" 

//	row.append($("<div>", {class : ((Timers.timerList[i].isrec ==true) ? "style_timerRec" : ""), style : "display: inline-block;"}));
	
	
	row.append($("<div>", {class : ((Timers.timerList[i].isrec ==true) ? "style_timerRec" : ((Timers.timerList[i].flags & 1) != 0) ? "style_timerAct" : "style_timerNone"), style : "display: inline-block; color : inherit;"})); 

	if (	Timers.timerList[i].isSingleEvent == true) {
	}
	else {
	}
	row.append($("<div>", {text : Timers.timerList[i].channelname, style : "padding-left:5px;width:12%; display: inline-block; color : inherit; ", class : "style_overflow"}));
	row.append($("<div>", {text : Timers.timerList[i].start, style : "padding-left:5px; width:9%; display: inline-block; color : inherit; ", class : "style_overflow"}));
	row.append($("<div>", {text : Timers.timerList[i].stop, style : "padding-left:5px; width:9%; display: inline-block; color : inherit; ", class : "style_overflow"}));	
	row.append($("<div>", {text : Timers.timerList[i].title, style : "padding-left:5px; width:68%;display: inline-block; color : inherit; ", class : "style_overflow"}));
	return row;
};

Timers.resetBtns = function () {
	this.btnSelected = 0;
	for (var i =0; i <= Timers.timerList.length; i++) {
		$("#tmr-" + i).removeClass('style_menuItemSelected').addClass('style_menuItem'); 
	}
	$("#tmr-0").removeClass('style_menuItem').addClass('style_menuItemSelected'); 
};

Timers.resetView = function () {
	Timers.timerList = [];
	$("#timerTable").remove();
	
	Timers.readTimers();
	

};

Timers.timerCallback = function () {
// delete the current timer
	Main.log("****** Delete Timer: " + Timers.timerList[this.btnSelected].title);
	
//	var obj = new execRestCmd(RestCmds.CMD_DelTimer, Timers.timerList[this.btnSelected].index);
	Server.delTimer(Timers.timerList[this.btnSelected].index);

};


Timers.selectBtnUp = function () {
	var btnname = "#tmr-"+this.btnSelected;
	Main.log( "Timers-BtnUp: Old: " +this.btnSelected + " btn= "+btnname);
	$(btnname).removeClass('style_menuItemSelected').addClass('style_menuItem'); 
	if (this.btnSelected == 0) {
		this.btnSelected = (Timers.timerList.length-1);
		$("#timerTable").animate ({scrollTop: $("#tmr-" + this.btnSelected).position().top}, this.scrollFlip);
		}
	else {
		this.btnSelected--;
		var pos = $("#tmr-" + this.btnSelected).position().top;
		Main.log("pos= " + pos + " ovlBodyHeight= " + $("#timerTable").height() + " scrollTop= " + $("#timerTable").scrollTop());
		if (pos < 0) {
			$("#timerTable").animate ({scrollTop: $("#timerTable").scrollTop() + pos}, this.scrollDur);
			Main.log("New scrollTop= " +$("#timerTable").scrollTop() +" new pos= " + $("#tmr-" + this.btnSelected).position().top);
		}
		
	}
	$("#tmr-" + this.btnSelected).removeClass('style_menuItem').addClass('style_menuItemSelected'); 
	Main.log("Timers-BtnUp: New: " +this.btnSelected);
};

Timers.selectBtnDown = function () {
	var btnname = "#tmr-"+this.btnSelected;
	$("#tmr-" + this.btnSelected).removeClass('style_menuItemSelected').addClass('style_menuItem'); 
	Main.log( "Timers-BtnDown: Old: " +this.btnSelected + " btn= "+btnname);
	if (this.btnSelected == (Timers.timerList.length-1)) {
		this.btnSelected = 0;
		$("#timerTable").animate ({scrollTop: 0}, this.scrollFlip);
	}
	else {
		this.btnSelected++;
		var pos = $("#tmr-" + this.btnSelected).position().top;
		var height = $("#tmr-" + this.btnSelected).outerHeight() +10;
		Main.log("pos= " + pos + " height= " + height + " ovlBodyHeight= " + $("#timerTable").height() + " scrollTop= " + $("#timerTable").scrollTop());
		if ((pos + height) > $("#timerTable").height()) {
			$("#timerTable").animate ({scrollTop: $("#timerTable").scrollTop() + (pos + height) - $("#timerTable").height()}, this.scrollDur); 
			Main.log("New scrollTop= " +$("#timerTable").scrollTop() +" new pos= " + $("#tmr-" + this.btnSelected).position().top);
		}
				
	}
	Main.log( "Timers-BtnDown: New: " +this.btnSelected );

	$("#tmr-" + this.btnSelected).removeClass('style_menuItem').addClass('style_menuItemSelected'); 	
};

Timers.onInput = function () {
    var keyCode = event.keyCode;
	Main.log(" Timers key= " + keyCode);
    switch(keyCode) {
		case tvKey.KEY_UP:
			Main.log("Timers-Select Up");
			this.selectBtnUp();
			break;
		case tvKey.KEY_DOWN:
			Main.log("Timers-Select Down");
			this.selectBtnDown();
		break;
		case tvKey.KEY_ENTER:
			Buttons.ynShow();

		break;
		case tvKey.KEY_YELLOW:

			Timers.timerCallback = function () {
			// delete the current timer
				Main.log("Timers.timerCallback: " + Timers.timerList[this.btnSelected].title);
				Server.delTimer(Timers.timerList[this.btnSelected].index);
			};

			Buttons.ynShow();

		break;
		case tvKey.KEY_RED:
			if ((Timers.timerList[this.btnSelected].flags & 1) != 0) {
				// Timer is currently active
				Buttons.ynHeadlineText ("Deactivate Timer ?");
				Timers.timerCallback = function () {
						Main.log("Timers.timerCallback Deactivate Timer: " + Timers.timerList[this.btnSelected].title);						
						Server.actTimer(Timers.timerList[this.btnSelected].index, false);
					};
				
			}
			else {
				// Timer is currently deactive
				Buttons.ynHeadlineText ("Activate Timer ?");
				Timers.timerCallback = function () {
					Main.log("Timers.timerCallback Activate Timer: " + Timers.timerList[this.btnSelected].title);						
					Server.actTimer(Timers.timerList[this.btnSelected].index,  true);
				};
			}

			Buttons.ynShow();
//			Timers.hide();

		break;
    	case tvKey.KEY_TOOLS:
    		Helpbar.showHelpbar();
    	break;
		
		case tvKey.KEY_RETURN:
		case tvKey.KEY_EXIT:
			Timers.hide();
			
			if (this.returnCallback  != null)
				this.returnCallback(); 	    	
			break;

	}
	try {
		widgetAPI.blockNavigation(event);
	}
	catch (e) {
	};
};


