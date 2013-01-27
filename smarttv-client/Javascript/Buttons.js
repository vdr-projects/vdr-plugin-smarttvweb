var Buttons = {
	created: false,
	btnSelected : 0,
	btnMax : 1
};

/*
 * First: do just the buttons for play / resume
 */
Buttons.init = function (){
	if (this.created == false) {
		Buttons.createButtons();
		$("#pr-popup").hide();		
		this.created = true;
	}
};

Buttons.show = function () {
	Main.log("Buttons.show()");
	$("#pr-popup").show();
	$("#pr-popup-anchor").focus();
	
	Buttons.reset ();
};


Buttons.hide = function () {
	$("#pr-popup").hide();
	$("#pr-popup-anchor").blur();
	Main.enableKeys();
};

Buttons.createButtons= function () {	
	var p_width = $("body").outerWidth();
	var p_height = $("body").outerHeight();
	
	var sheet = $("<style>");
	sheet.attr({type : 'text/css',
		innerHTML : '\
		#pr-popup { display:table; width:40%; height: 30%; position: absolute; text-align:center; border-width:1px;\
		            background:rgba(0,0,139, 0.8);border-style:solid;border-width:1px;border-radius:15px;\
			       -webkit-box-shadow:3px 3px 7px 4px rgba(0,0,0, 0.5);}\
		.pr-btn { display:inline-block; \
			margin-left: 10px; \
			padding: 10px 10px 10px 10px;\
			border-radius:10px; \
			font-size:16px;\
			border-style:solid;\
			border-width:1px;\
			background: transparent;}\
		.pr-btn-pressed {display:inline-block; \
			margin-left: 10px; \
			padding: 10px 10px 10px 10px;\
			border-radius:10px; \
			font-size:16px;\
			border-style:solid;\
			border-width:1px;\
			background: "white";\
			background: "-webkit-linear-gradient(top, rgba(246,248,249,1) 0%,rgba(229,235,238,1) 50%,rgba(215,222,227,1) 51%,rgba(245,247,249,1) 100%)";\
			}\
			.pr-helpbar {display:inline-block;}\
		}'});
	$('body').append(sheet);

//	var domNode = $("<div>", {id: "pr-popup", "onkeydown":"Buttons.onInput();"});
		
	var row = $('<div>');
	row.css({"height":"80%", "display":"table-row", "vertical-align":"middle"});
	var cell = $("<div>");
	cell.css({"display":"table-cell", "vertical-align":"middle"});
	cell.appendTo(row);
	$("<button>", {id : "pr-btn-0", text: "Play", class: "pr-btn"}).appendTo(cell);
	$("<button>", {id : "pr-btn-1", text: "Resume", class: "pr-btn"}).appendTo(cell);
	$("#pr-popup").append(row);

	$("#pr-popup").css({"left": ((p_width - $("#pr-popup").outerWidth()) /2) +"px", "top": ((p_height - $("#pr-popup").outerHeight()) /2) +"px"});

	row = $('<div>', {style: "display:table-row; vertical-align:bottom; text-align:center"});		
//	row.css({"display":"table-row", "vertical-align":"bottom"});
	$("#pr-popup").append(row);
	var elm = $("<div>", {class: "pr-helpbar"});
	elm.css({"display":"table-cell", "vertical-align":"bottom"});
	elm.appendTo(row);
	Buttons.addHelpItem(elm, "Images/helpbar/help_lr.png", "Select");
	Buttons.addHelpItem(elm, "Images/helpbar/help_enter.png", "OK");
	Buttons.addHelpItem(elm, "Images/helpbar/help_back.png", "Cancel");

	
	//	row.appendTo(domNode);
//	$('body').append(domNode);

	// Center
//	domNode.css({"left": ((p_width - domNode.outerWidth()) /2) +"px", "top": ((p_height - domNode.outerHeight()) /2) +"px"});


};

Buttons.addHelpItem = function(elm, url, msg) {
//	var hb_elm = $("<td>");
	
	var hb_elm = $("<div>");
	hb_elm.css({"display":"inline-block", "padding-right":"10px"});
	elm.append(hb_elm);
	
	hb_elm.append($("<img>", { src: url, style: "display:inline-block"}));
	hb_elm.append($("<div>", { text: msg, style: "display:inline-block; padding-bottom:10px"}));

	};

Buttons.reset = function () {
	for (var i =0; i <= Buttons.btnMax; i++) {
		$("#pr-btn-" + i).removeClass('pr-btn-pressed').addClass('pr-btn'); 
	}
	$("#pr-btn-0").removeClass('pr-btn').addClass('pr-btn-pressed'); 
};

Buttons.selectBtnLeft = function () {
	var btnname = "#pr-btn-"+Buttons.btnSelected;
	Main.log("BtnLeft: Old: " +Buttons.btnSelected + " btn= "+btnname);
	$(btnname).removeClass('pr-btn-pressed').addClass('pr-btn'); 
	if (Buttons.btnSelected == 0)
		Buttons.btnSelected = Buttons.btnMax;
	else
		Buttons.btnSelected--;
	$("#pr-btn-" + Buttons.btnSelected).removeClass('pr-btn').addClass('pr-btn-pressed'); 
	Main.log("BtnLeft: New: " +Buttons.btnSelected);
};

Buttons.selectBtnRight = function () {
	$("#pr-btn-" + Buttons.btnSelected).removeClass('pr-btn-pressed').addClass('pr-btn'); 
	if (Buttons.btnSelected == Buttons.btnMax)
		Buttons.btnSelected = 0;
	else
		Buttons.btnSelected++;
	$("#pr-btn-" + Buttons.btnSelected).removeClass('pr-btn').addClass('pr-btn-pressed'); 
};

Buttons.onInput = function () {
    var keyCode = event.keyCode;
//	alert("Buttons Input= " + keyCode);
    switch(keyCode) {
		case tvKey.KEY_LEFT:
			Main.log("Select Left");
			Buttons.selectBtnLeft();
			break;
		case tvKey.KEY_RIGHT:
			Main.log("Select Right");
			Buttons.selectBtnRight();
		break;
		case tvKey.KEY_ENTER:
			Main.log("Enter");
    		Display.hide();
        	Display.showProgress();
			switch(Buttons.btnSelected){
			case 0:
				Main.logToServer("Buttons: Play from start");
				Player.playVideo(-1);
				break;
			case 1:
				Main.logToServer("Buttons: Resume from "+Player.resumePos);
//				Player.playVideo(Player.resumePos);
				Spinner.show();
				Server.getResume(Player.guid);
				break;
			}
			Buttons.hide();
		break;
		case tvKey.KEY_RETURN:
			Buttons.hide();
			break;

	}
	widgetAPI.blockNavigation(event);
	};