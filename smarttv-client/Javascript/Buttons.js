var Buttons = {
	created: false,
	btnSelected : 0,
	btnMax : 2,
	prButton : null
};

/*
 * First: do just the buttons for play / resume
 */
Buttons.init = function (){
	if (this.created == false) {
		Buttons.createStyleSheet ();
		Buttons.createPrcButtons();
		$("#prc-buttons").hide();		
		Buttons.createYnButtons();
		$("#yn-buttons").hide();		
		
		this.created = true;
		this.prButton = new ButtonHandler();
		this.prButton.hndlName = "prcButtons";
		this.prButton.enterCallback = Buttons.prcEnterCallback;
		this.prButton.btnMax = 2;
		this.prButton.elmName = "#pr-btn-";
		this.prButton.masterElm = "#prc-buttons";
		this.prButton.inputElm = "#prc-buttons-anchor";
		
		var elem = document.getElementById('prc-buttons-anchor');
		elem.setAttribute('onkeydown', 'Buttons.prButton.onInput();');

		this.ynButton = new ButtonHandler();
		this.ynButton.hndlName = "ynButtons";
		this.ynButton.enterCallback = Buttons.ynEnterCallback;
		this.ynButton.btnMax = 1;
		this.ynButton.elmName = "#yn-btn-";
		this.ynButton.masterElm = "#yn-buttons";
		this.ynButton.inputElm = "#yn-buttons-anchor";

		elem = document.getElementById('yn-buttons-anchor');
		elem.setAttribute('onkeydown', 'Buttons.ynButton.onInput();');
		//		$("#prc-buttons-anchor").attr("onkeydown", "Button.prButton.onInput();");   
		}
};

Buttons.ynEnterCallback = function () {
	Main.log("Buttons.ynEnterCallback btnSelected= " + Buttons.ynButton.btnSelected);
	switch(Buttons.ynButton.btnSelected){
		case 0:
			Main.logToServer("ynButtons: No -> Don't delete");
			break;
		case 1:
			Main.logToServer("ynButtons: Yes "+Player.resumePos);
			Server.deleteRecording(Player.guid);
			break;
		}
		Buttons.ynHide();
	};

Buttons.prcEnterCallback = function () {
	Main.log("Buttons.prcEnterCallback");
		
	switch(Buttons.prButton.btnSelected){
		case 0:
			Main.logToServer("prcButtons: Play from start");
			Display.hide();
			Display.showProgress();
			Player.playVideo(-1);
			Buttons.prcHide();
			break;
		case 1:
			Main.logToServer("prcButtons: Resume from "+Player.resumePos);
//				Player.playVideo(Player.resumePos);
			Display.hide();
			Display.showProgress();
			Spinner.show();
			Server.getResume(Player.guid);
			Buttons.prcHide();
			break;
		case 2:
				//delete
			Buttons.prcHide();
			Buttons.ynShow();
				
			break;
		}
};

Buttons.show = function () {
	Main.log("Buttons.show()");
	this.prButton.show();
	this.prButton.reset();
};

Buttons.hide = function () {
	this.prButton.hide();
//	$("#prc-buttons-anchor").blur();
	Main.enableKeys();
};

Buttons.prcShow = function () {
	Main.log("Buttons.show()");
	this.prButton.show();
	this.prButton.reset();
};

Buttons.prcHide = function () {
	this.prButton.hide();
//	$("#prc-buttons-anchor").blur();
	Main.enableKeys();
};

Buttons.ynShow = function () {
	Main.log("Buttons.ynShow()");
	this.ynButton.show();
	this.ynButton.reset();
};

Buttons.ynHide = function () {
	this.ynButton.hide();
	Main.enableKeys();
};

Buttons.createStyleSheet = function () {
	var sheet = $("<style>");
	sheet.attr({type : 'text/css',
		innerHTML : '\
		#prc-buttons { width:40%; height: 30%; position: absolute; text-align:center; border-width:1px;\
		            background:rgba(0,0,139, 0.8);border-style:solid;border-width:1px;border-radius:15px;\
			       -webkit-box-shadow:3px 3px 7px 4px rgba(0,0,0, 0.5);z-index:15;}\
		#yn-buttons { width:40%; height: 30%; position: absolute; text-align:center; border-width:1px;\
		            background:rgba(0,0,139, 0.8);border-style:solid;border-width:1px;border-radius:15px;\
			       -webkit-box-shadow:3px 3px 7px 4px rgba(0,0,0, 0.5);z-index:15;}\
		.pr-btn { margin-left: 10px; \
			padding: 10px 10px 10px 10px;\
			border-radius:10px; \
			font-size:16px;\
			border-style:solid;\
			border-width:1px;\
			background: transparent;}\
		.pr-btn-pressed {margin-left: 10px; \
			padding: 10px 10px 10px 10px;\
			border-radius:10px; \
			font-size:16px;\
			border-style:solid;\
			border-width:1px;\
			background-color: "white";\
			background-color: "-webkit-linear-gradient(top, rgba(246,248,249,1) 0%,rgba(229,235,238,1) 50%,rgba(215,222,227,1) 51%,rgba(245,247,249,1) 100%)";\
			}\
			.pr-helpbar {display:inline-block;}\
		}'});

	$('body').append(sheet);
};

Buttons.createPrcButtons= function () {	
	var p_width = $("body").outerWidth();
	var p_height = $("body").outerHeight();
	

	var table = $("<table>", {style:"height:100%;width:100%;"});
	$("#prc-buttons").append(table);

	var tbody = $("<tbody>", {style:"height:100%;width:100%;"});
	table.append(tbody);

	
	var row = $("<tr>", {style: "width:100%; align:center"});
	
	var cell = $("<td>");
	cell.css("align","right");
	$("<button>", {id : "pr-btn-0", text: "Play", class: "pr-btn"}).appendTo(cell);
	row.append(cell);
	cell = $("<td>",  {style :"height:80%"});
	$("<button>", {id : "pr-btn-1", text: "Resume", class: "pr-btn"}).appendTo(cell);
	row.append(cell);
	cell = $("<td>",  {style :"height:80%"});
	$("<button>", {id : "pr-btn-2", text: "Delete", class: "pr-btn"}).appendTo(cell);
	row.append(cell);

	tbody.append(row);
		
	$("#prc-buttons").css({"left": ((p_width - $("#prc-buttons").outerWidth()) /2) +"px", "top": ((p_height - $("#prc-buttons").outerHeight()) /2) +"px"	});

	row = $("<tr>", {style: "width:100%; align:center"});
	tbody.append(row);

	cell = $("<td>");
	row.append(cell); // Helpbar row
	Buttons.addHelpItem(cell, "Images/helpbar/help_lr.png", "Select");

	cell = $("<td>");
	row.append(cell);
	Buttons.addHelpItem(cell, "Images/helpbar/help_enter.png", "OK");

	cell = $("<td>");
	row.append(cell);
	Buttons.addHelpItem(cell, "Images/helpbar/help_back.png", "Cancel");
			
};

Buttons.createYnButtons= function () {	
	var p_width = $("body").outerWidth();
	var p_height = $("body").outerHeight();
	

	var table = $("<table>", {style:"height:100%;width:100%;"});
	$("#yn-buttons").append(table);

	var tbody = $("<tbody>", {style:"height:100%;width:100%;"});
	table.append(tbody);

	var row = $("<tr>", {style: "width:100%; align:center"});
	
	var cell = $("<td>",  {style :"height:80%; width:50%"});
	cell.css("align","right");
	$("<button>", {id : "yn-btn-1", text: "Yes", class: "pr-btn"}).appendTo(cell);
	row.append(cell);
	cell = $("<td>",  {style :"height:80%; width:50%"});
	$("<button>", {id : "yn-btn-0", text: "No", class: "pr-btn"}).appendTo(cell);
	row.append(cell);

	tbody.append(row);
		
	$("#yn-buttons").css({"left": ((p_width - $("#yn-buttons").outerWidth()) /2) +"px", "top": ((p_height - $("#yn-buttons").outerHeight()) /2) +"px"	});

	row = $("<tr>", {style: "width:100%; align:center"});
	tbody.append(row);

	cell = $("<td>");
	row.append(cell); // Helpbar row
	Buttons.addHelpItem(cell, "Images/helpbar/help_lr.png", "Select");

	cell = $("<td>");
	row.append(cell);
	Buttons.addHelpItem(cell, "Images/helpbar/help_enter.png", "OK");

	cell = $("<td>");
	row.append(cell);
	Buttons.addHelpItem(cell, "Images/helpbar/help_back.png", "Cancel");			
};


Buttons.addHelpItem = function(elm, url, msg) {
	
	var hb_elm = $("<div>");
	hb_elm.css({"display":"inline-block", "padding-right":"10px"});
	elm.append(hb_elm);
	
	hb_elm.append($("<img>", { src: url, style: "display:inline-block"}));
	hb_elm.append($("<div>", { text: msg, style: "display:inline-block; padding-bottom:10px"}));

	};



/*
Principle:
The HTML DOM tree is created outside
The element name is formed in such a way that the btnSelected is appended.

How to handle keyboard input?

How to do the onEnter Callback?
*/	

function ButtonHandler() {
	this.hndlName ="";
	this.btnSelected = 0;
	this.btnMax = 2;
	this.elmName = "#pr-btn-";
	this.masterElm = "#prc-buttons";
	this.inputElm = "#prc-buttons-anchor";
	this.enterCallback = null;
	this.returnCallback = null;
};

ButtonHandler.prototype.show = function () {
	Main.log(this.hndlName + ".show(): masterElm= " +this.masterElm + " inputElm= " + this.inputElm);
	$(this.masterElm).show();
	$(this.inputElm).focus();
	this.reset ();
};

ButtonHandler.prototype.hide = function () {
	Main.log(this.hndlName + ".hide(): masterElm= " +this.masterElm + " inputElm= " + this.inputElm);
	$(this.masterElm).hide();
	$(this.inputElm).blur();
	Main.enableKeys();
};

	
ButtonHandler.prototype.reset = function () {
	this.btnSelected = 0;
	for (var i =0; i <= this.btnMax; i++) {
		$(this.elmName + i).removeClass('pr-btn-pressed').addClass('pr-btn'); 
	}
	$(this.elmName+"0").removeClass('pr-btn').addClass('pr-btn-pressed'); 
};


ButtonHandler.prototype.selectBtnLeft = function () {
	var btnname = this.elmName+this.btnSelected;
	Main.log(this.hndlName + "-BtnLeft: Old: " +this.btnSelected + " btn= "+btnname);
	$(btnname).removeClass('pr-btn-pressed').addClass('pr-btn'); 
	if (this.btnSelected == 0)
		this.btnSelected = this.btnMax;
	else
		this.btnSelected--;
	$(this.elmName + this.btnSelected).removeClass('pr-btn').addClass('pr-btn-pressed'); 
	Main.log(this.hndlName+"-BtnLeft: New: " +this.btnSelected);
};

ButtonHandler.prototype.selectBtnRight = function () {
	$(this.elmName + this.btnSelected).removeClass('pr-btn-pressed').addClass('pr-btn'); 
	if (this.btnSelected == this.btnMax)
		this.btnSelected = 0;
	else
		this.btnSelected++;
	$(this.elmName + this.btnSelected).removeClass('pr-btn').addClass('pr-btn-pressed'); 
};

ButtonHandler.prototype.onInput = function () {
    var keyCode = event.keyCode;
    switch(keyCode) {
		case tvKey.KEY_LEFT:
			Main.log(this.hndlName+"-Select Left");
			this.selectBtnLeft();
			break;
		case tvKey.KEY_RIGHT:
			Main.log(this.hndlName+"-Select Right");
			this.selectBtnRight();
		break;
		case tvKey.KEY_ENTER:
			if (this.enterCallback  != null)
				this.enterCallback(); 	    	
			else
				Main.log(this.hndlName+"-Enter: enterCallback is NULL");

		break;
		case tvKey.KEY_RETURN:
		case tvKey.KEY_EXIT:
			Buttons.hide();
			if (this.returnCallback  != null)
				this.returnCallback(); 	    	
			break;

	}
	widgetAPI.blockNavigation(event);
	};
	
