var Helpbar = {
	isInited : false	
};

Helpbar.init = function () {
	if (this.isInited == false)	{
	    this.helpbarOlHandler = new OverlayHandler("HelpbarHndl");
		this.helpbarOlHandler.init(Helpbar.showHelpbarOverlay, Helpbar.hideHelpbarOverlay);
		this.helpbarOlHandler.olDelay = 5000;
	
		Helpbar.createHelpbar();	
		Helpbar.hide();
		Helpbar.hideOptSrv();
	}
};

Helpbar.show = function () {
	$("#helpbar").show();
};

Helpbar.hide = function () {
	$("#helpbar").hide();
};

Helpbar.showOptSrv = function () {
	$("#helpbarOptSrv").show();
};

Helpbar.hideOptSrv = function () {
	$("#helpbarOptSrv").hide();
};

Helpbar.createHelpbar = function() {
	this.isInited = true;
	var sheet = $("<style>");
	sheet.attr({type : 'text/css',
		innerHTML : '\
		.hb-bg {left:0px; top:480px; width:960px; height:40px; position: absolute; z-index:40; font-size:18px; background: darkblue;background: -webkit-linear-gradient(top, #1e5799 0%,#7db9e8 50%,#1e5799 100%);}\
		}'});
	$('body').append(sheet);

	$("<table>", {id:"helpbar", class: "hb-bg"}).appendTo ($("body"));
	var row = $("<tr>", {id: "hb-row", align:"center", valign:"middle"});
	row.appendTo("#helpbar");

	Helpbar.addItem("Images/helpbar/help_joy.png", "Move Cursor", row);
	Helpbar.addItem("Images/helpbar/help_back.png", "Cancel", row);
	
	Helpbar.addItem("Images/helpbar/help_enter.png", "Done", row);
	Helpbar.addItem("Images/helpbar/help_red.png", "Clear all", row);
	Helpbar.addItem("Images/helpbar/help_green.png", "Clear Char", row);
	Helpbar.addItem("Images/helpbar/help_yellow.png", "Dot (.)", row);
	Helpbar.addItem("Images/helpbar/help_blue.png", "Colon (:)", row);

	//--------------------------------------------
	
	$("<table>", {id:"helpbarOptSrv", class: "hb-bg"}).appendTo ($("body"));
	row = $("<tr>", {id: "hb-row-opt-srv", align:"center", valign:"middle"});
	row.appendTo("#helpbarOptSrv");

	Helpbar.addItem("Images/helpbar/help_ud.png", "Move Cursor", row);
	Helpbar.addItem("Images/helpbar/help_back.png", "Cancel", row);	
	Helpbar.addItem("Images/helpbar/help_yellow.png", "Delete", row);
};

Helpbar.addItem = function(url, msg, row) {
	var hb_elm = $("<td>");

	//hb_elm.appendTo("#hb-row");
	hb_elm.appendTo(row);
	
	var tab = $("<table>");
	tab.appendTo(hb_elm);
	var row = $("<tr>");
	row.appendTo(tab);
	
	$("<td>").append($("<img>", { src: url})).appendTo(row);
	$("<td>").append($("<p>", { text: msg})).appendTo(row);
};

//--------------------------------------------------------

Helpbar.showHelpbar = function () {
	Main.log ("Helpbar.showHelpbar");
	this.helpbarOlHandler.show();
};

Helpbar.showHelpbarOverlay = function() {

	$("<div>", {id:"helpbarOverlay", class: "style_hbOverlay"}).appendTo ($("body"));
	$("#helpbarOverlay").append($("<div>", {text: "RC Keys", style : "padding-left : 5px; padding-right: 5px;"}));

	
	switch (Main.state) {
	case Main.eMAIN:
		$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_lr.png", "Page Up / Down"));
		$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_enter.png", "Tune in / Select Group"));
		$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_back.png", "Exit"));

	break;
	case Main.eLIVE:
		$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_0_9.png", "Direct Channel Access"));

		$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_ud.png", "Change Channel"));
//			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_ff_rw.png", "Trickplay (if supported)"));
		$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_enter.png", "Show Progress"));


			
		if(Player.getState() == Player.STOPPED) {
	    	// Menu Key
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_enter.png", "Tune in / Select Group"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_back.png", "Group Up / Exit"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_lr.png", "Page Up / Down"));
			
	    }
	    else {
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_rec.png", "Start Recording"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_pause.png", "Pause (Experimental)"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_green.png", "3D"));
//			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_yellow.png", "Next Subtitle"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_blue.png", "Next Audio Track"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_size.png", "Change Picture Size"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_info.png", "Recording Info"));
	    };

	break;
	case Main.eREC:
		if(Player.getState() == Player.STOPPED) {
	    	// Menu Key
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_ud.png", "Cursor up / down"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_lr.png", "Page Up / Down"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_enter.png", "Start Playback / Select Folder"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_back.png", "Folder Up / Exit"));

			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_red.png", "Recording Commands Menu"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_blue.png", "Change Sorting [by date, ...]"));
	    }
	    else {
			// while playing
				var num_key_text = "";
				switch (Config.playKeyBehavior) {
				case 1:
					num_key_text = "<Num> * 1min";
					break;
				default:
					num_key_text = "<Num>/10 * RecDuration";
					break;
				}
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_0_9.png", num_key_text)); // depends on config
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_lr.png", "Skip"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_ud.png", "Change Skip Duration"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_ff_rw.png", "Trickplay (if supported)"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_enter.png", "Show Progress"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_pause.png", "Pause / Play"));

			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_size.png", "Change Picture Size"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_info.png", "Recording Info"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_green.png", "3D"));
//			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_yellow.png", "Next Subtitle"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_blue.png", "Next Audio Track"));
	    };

	break;
	case Main.eMED:
		if(Player.getState() == Player.STOPPED) {
			if (ImgViewer.isActive == true) {
				$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_lr.png", "Next / Prev Image"));
				$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_yellow.png", "Delete Image"));
			}
			else {
			// Menu Key
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_ud.png", "Cursor up / down"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_lr.png", "Page Up / Down"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_enter.png", "Start Playback / Select Folder"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_back.png", "Folder Up / Exit"));

			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_red.png", "Recording Commands Menu"));
//			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_blue.png", "Change Sorting [by date, ...]"));
			} // else
		}
	    else {
			// while playing
				var num_key_text = "";
				switch (Config.playKeyBehavior) {
				case 1:
					num_key_text = "<Num> * 1min";
					break;
				default:
					num_key_text = "<Num>/10 * RecDuration";
					break;
				}
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_0_9.png", num_key_text)); // depends on config
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_lr.png", "Skip"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_ud.png", "Change Skip Duration"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_ff_rw.png", "Trickplay (if supported)"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_enter.png", "Show Progress"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_pause.png", "Pause / Play"));

			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_size.png", "Change Picture Size"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_info.png", "Recording Info"));

			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_green.png", "3D"));
//			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_yellow.png", "Next Subtitle"));
			$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_blue.png", "Next Audio Track"));
	    };

	break;
	case Main.eTMR:
		$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_red.png", "Toggle Activation"));
		$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_yellow.png", "Delete Timer"));
	break;
	case Main.eURLS:
		$("#helpbarOverlay").append(Helpbar.createRow("Images/helpbar/help_yellow.png", "Delete Entry"));
	break;
	case Main.eSRVR:
	break;
	case Main.eOPT:
	break;
	default:
	break;
	}
	
	var p_width = $("body").outerWidth();
	var p_height = $("body").outerHeight();


	Helpbar.maxWidth = 0;
	// I also need to find the max of the r_elms
	$("#helpbarOverlay").find('img').each(function () {
		if ($(this).outerWidth() > Helpbar.maxWidth)
			Helpbar.maxWidth = $(this).outerWidth();
		});
	Helpbar.maxRElmWidth = 0;
	$("#helpbarOverlay").find('.style_hbOverlayRElm').each(function () {
		if ($(this).outerWidth() > Helpbar.maxRElmWidth)
			Helpbar.maxRElmWidth = $(this).outerWidth();
		});

	$(".style_hbOverlayLElm").css ('width', Helpbar.maxWidth+10+"px");
	$(".style_hbOverlayRow").css ('width', Helpbar.maxRElmWidth+Helpbar.maxWidth+40+"px");

	$("#helpbarOverlay").css({"left": ((p_width - $("#helpbarOverlay").outerWidth()) -40) +"px", 
		"top": ((p_height - $("#helpbarOverlay").outerHeight()) /2) +"px"});

};

Helpbar.createRow = function (url, msg) {
	var row = $("<div>", {class : "style_hbOverlayRow"});
	
	var l_elm = $("<div>", {style : "display: inline-block;", class : "style_hbOverlayLElm"});
	var r_elm = $("<div>", {style : "display: inline-block;", class : "style_hbOverlayRElm"});

	l_elm.append($("<img>", { src: url}));
	r_elm.append($("<div>", { text: msg}));

	row.append(l_elm);
	row.append(r_elm);
	
	return row;
};

Helpbar.hideHelpbarOverlay = function() {
	$("#helpbarOverlay").remove();
};
