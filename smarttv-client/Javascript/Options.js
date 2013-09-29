var Options = {
	imeBox : null,
	inputElm : "widgetServerAddr",
	jqInputElm : "#widgetServerAddr",
	cursor : "_",
	cursorPos : 0,
	isCreated : false,

	selectedLine : 0,
	maxSelect : -1,
	state : 0,

	sEnter : 0,
	sSelect : 1
};

Options.init = function() {
	if (this.isCreated == true)
		return;

	this.isCreated = true;

	document.getElementById(Options.inputElm).value = Config.serverAddrDefault;
	Options.cursorPos = Config.serverAddrDefault.length;
	
	Options.createKeypad ();
	$("#optionsScreen").hide();

	document.getElementById(Options.inputElm).style.color="black";
};

Options.show = function() {
	Main.log("Options.show");
	$("#optionsScreen").show();
	this.selectedLine = 0;
	
	if (Config.firstLaunch == true)
		document.getElementById(Options.inputElm).value = Config.serverAddrDefault ;
	else
		document.getElementById(Options.inputElm).value = Config.serverAddr;

	Options.cursorPos = document.getElementById(Options.inputElm).value.length;

//	document.getElementById(Options.inputElm).focus();

	Options.drawServerList();

	Helpbar.init();
	Helpbar.show();
};

Options.hide = function() {
	$("#optionsScreen").hide();
//	document.getElementById("optionsScreen").style.display="none";
	Helpbar.hide();
//	Helpbar.hideSrv();
	
	Main.enableKeys();
};

Options.drawServerList = function () {
	//delete all childs below optionsList
	$("#optionsList").children().remove();
	
	for (var i = 0; i < Config.vdrServers.serverUrlList.length; i++) {
		var line = $("<div>", {id: ("optl-" + (i+1))}).text("Server "+ i + ":   " + Config.vdrServers.serverUrlList[i]);
		$("#optionsList").append(line);	
	}

	this.maxSelect = Config.vdrServers.serverUrlList.length;
	Main.log("Options.show - this.maxSelect= " + this.maxSelect);

	if (this.selectedLine > this.maxSelect)
		this.selectedLine = this.maxSelect;
	
	if (this.selectedLine == 0) {
		$(this.jqInputElm).focus();
		this.state = Options.sEnter;
	}
	else {
		this.state = Options.sSelect;
		$("#optionsViewAnchor").focus();
		var elm = document.getElementById("optl-"+this.selectedLine);
		Display.selectItem(elm);        			
	}

};

Options.createKeypad = function () {
	var sheet = $("<style>");
	sheet.attr({type : 'text/css',
		innerHTML : '\
		.ui-btn {width:70px; height: 48px; display:inline-block; font-size:20px;background:url("Images/keypad/kp-button.png");}\
		.ui-btn-pressed {width:70px; height: 48px; display:inline-block;font-size:20px;background:url("Images/keypad/kp-button-inv.png");}\
		.ui-keypad {left:650px; top:135px; width: 220px; text-align:center; border-width:1px; background: #1e5799; border-style:solid;\
		}'});
	$('body').append(sheet);

	var domNode = $('<div>', { id: "ime_keypad", class: "ui-keypad"});
	var row = $('<div>');
	$("<button>", {id : "kb-btn-1", text: "1", class: "ui-btn"}).appendTo(row);
	$("<button>", {id : "kb-btn-2", text: "2", class: "ui-btn"}).appendTo(row);
	$("<button>", {id : "kb-btn-3", text: "3", class: "ui-btn"}).appendTo(row);
	row.appendTo(domNode);

	row = $('<div>');
	$("<button>", {id : "kb-btn-4", text: "4", class: "ui-btn"}).appendTo(row);
	$("<button>", {id : "kb-btn-5", text: "5", class: "ui-btn"}).appendTo(row);
	$("<button>", {id : "kb-btn-6", text: "6", class: "ui-btn"}).appendTo(row);
	row.appendTo(domNode);

	row = $('<div>');
	$("<button>", {id : "kb-btn-7", text: "7", class: "ui-btn"}).appendTo(row);
	$("<button>", {id : "kb-btn-8", text: "8", class: "ui-btn"}).appendTo(row);
	$("<button>", {id : "kb-btn-9", text: "9", class: "ui-btn"}).appendTo(row);
	row.appendTo(domNode);

	row = $('<div>');
	$("<button>", {id : "kb-btn-dot", text: ".", class: "ui-btn"}).appendTo(row);
	$("<button>", {id : "kb-btn-0", text: "0", class: "ui-btn"}).appendTo(row);
	$("<button>", {id : "kb-btn-col", text: ":", class: "ui-btn"}).appendTo(row);
	row.appendTo(domNode);

	$("#optionsScreen").append(domNode);
};

Options.setCursor = function (pos) {
	document.getElementById(Options.inputElm).setSelectionRange(pos, pos);
};

Options.insertChar = function(char) {
	var txt = document.getElementById(Options.inputElm).value;
	var res = "";
	if (Options.cursorPos == 0) {
		res = char;
	}
	else {
		if (Options.cursorPos == txt.length) {
			res = txt + char;			
		}
		else {
			res = txt.slice(0, Options.cursorPos) + char + txt.slice(Options.cursorPos);	
		}
	}
	document.getElementById(Options.inputElm).value = res;
	Options.cursorPos = Options.cursorPos +1;
	Options.setCursor(Options.cursorPos);

};

Options.deleteAll = function () {
	document.getElementById(Options.inputElm).value = '';
	Options.cursorPos = 0;
	Options.setCursor(Options.cursorPos);
};

Options.deleteChar = function() {
	var txt = document.getElementById(Options.inputElm).value;
	document.getElementById(Options.inputElm).value = txt.slice(0, (Options.cursorPos-1))  + txt.slice(Options.cursorPos);
	Options.cursorPos = Options.cursorPos -1;
	Options.setCursor(Options.cursorPos);
};


Options.moveCursorLeft = function() {
	if (Options.cursorPos == 0)
		return;
	Options.cursorPos = Options.cursorPos -1;
	Options.setCursor(Options.cursorPos);
};

Options.moveCursorRight = function() {
	if (Options.cursorPos == document.getElementById(Options.inputElm).value.length)
		return;
	Options.cursorPos = Options.cursorPos +1;
	Options.setCursor(Options.cursorPos);


};


Options.onInput = function () {
    var keyCode = event.keyCode;

    if (Config.verboseStart == true)
    	Display.showPopup("");
    Main.log("Options.onInput Key= " + keyCode);
    switch(keyCode) {
        case tvKey.KEY_1:
        	Main.log("KEY_1 pressed");
        	if (Options.state != Options.sEnter )
        		return;
        	Options.insertChar("1");

        	$("#kb-btn-1").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-1").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);
        	
        	break;
        case tvKey.KEY_2:
        	Main.log("KEY_2 pressed");
        	if (Options.state != Options.sEnter )
        		return;
        	Options.insertChar("2");
        	$("#kb-btn-2").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-2").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);
        	
        	break;
        case tvKey.KEY_3:
        	Main.log("KEY_3 pressed");
        	if (Options.state != Options.sEnter )
        		return;
        	Options.insertChar("3");

        	$("#kb-btn-3").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-3").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);
        	break;
        case tvKey.KEY_4:
        	Main.log("KEY_4 pressed");
        	if (Options.state != Options.sEnter )
        		return;
        	Options.insertChar("4");

        	document.getElementById("kb-btn-4").click();

        	$("#kb-btn-4").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-4").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_5:
        	Main.log("KEY_5 pressed");
        	if (Options.state != Options.sEnter )
        		return;
        	Options.insertChar("5");

        	$("#kb-btn-5").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-5").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_6:
        	Main.log("KEY_6 pressed");
        	if (Options.state != Options.sEnter )
        		return;
        	Options.insertChar("6");

        	$("#kb-btn-6").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-6").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_7:
        	Main.log("KEY_7 pressed");
        	if (Options.state != Options.sEnter )
        		return;
        	Options.insertChar("7");

        	$("#kb-btn-7").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-7").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_8:
        	Main.log("KEY_8 pressed");
        	if (Options.state != Options.sEnter )
        		return;
        	Options.insertChar("8");
        	$("#kb-btn-8").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-8").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_9:
        	Main.log("KEY_9 pressed");
        	if (Options.state != Options.sEnter )
        		return;
        	Options.insertChar("9");

        	$("#kb-btn-9").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-9").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_0:
        	Main.log("KEY_0 pressed");

        	if (Options.state != Options.sEnter )
        		return;

        	Options.insertChar("0");
        	$("#kb-btn-0").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-0").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_LEFT:
        	if (Options.state != Options.sEnter )
        		return;

        	Options.moveCursorLeft();
        	break;
        case tvKey.KEY_RIGHT:
        	if (Options.state != Options.sEnter )
        		return;
        	Options.moveCursorRight();
        	break;

        case tvKey.KEY_UP:
        	if (this.selectedLine != 0) {
        		var elm = document.getElementById("optl-"+this.selectedLine);
        		Display.unselectItem(elm);        			
        	}
        	this.selectedLine --;
        	if (this.selectedLine < 0) {
        		this.selectedLine = this.maxSelect;
            	$("#optionsViewAnchor").focus();        		
        		Options.state = Options.sSelect;
        		Helpbar.showOptSrv();
        		Helpbar.hide();
        		$("#ime_keypad").hide();
        		
        	}
        	if (this.selectedLine == 0) {
        		$(this.jqInputElm).focus();
        		Options.state = Options.sEnter;        		
        		Helpbar.show();
        		Helpbar.hideOptSrv();
        		$("#ime_keypad").show();
        	}
        	Main.log("Up: this.selectedLine= " + this.selectedLine);

        	if (Options.state == Options.sSelect) {
        		var elm = document.getElementById("optl-"+this.selectedLine);
        		Display.selectItem(elm);        			
        	}

        	break;
        case tvKey.KEY_DOWN:
        	if (this.selectedLine != 0) {
        		var elm = document.getElementById("optl-"+this.selectedLine);
        		Display.unselectItem(elm);        			
        	}
        	this.selectedLine ++ ;
        	if (this.selectedLine > this.maxSelect) {
        		this.selectedLine = 0;
        		$(this.jqInputElm).focus();
        		Options.state = Options.sEnter;
        		Helpbar.show();
        		Helpbar.hideOptSrv();
        		$("#ime_keypad").show();
        	}
        	if (this.selectedLine == 1) {
        		$("#optionsViewAnchor").focus();
        		Options.state = Options.sSelect;
        		Helpbar.showOptSrv();
        		Helpbar.hide();
        		$("#ime_keypad").hide();
        	}
        	Main.log("Down: this.selectedLine= " + this.selectedLine);
        	if (Options.state == Options.sSelect) {
        		var elm = document.getElementById("optl-"+this.selectedLine);
        		Display.selectItem(elm);        			
        	}

        	break;
        case tvKey.KEY_RETURN:
        	Main.log("Return pressed");
        	Options.hide();
        	Main.changeState(0);
    		widgetAPI.blockNavigation(event);

        	break;
        case tvKey.KEY_ENTER:
        	// Done
//        	Options.cursorPos = Options.cursorPos +1;
//        	Options.deleteChar(); //
        	Main.logToServer("Options.onInput: Enter Pressed - Val= " + document.getElementById(Options.inputElm).value);
            if (Config.verboseStart == true)
            	Display.showPopup("Options.onInput: Enter Pressed - Val= " + document.getElementById(Options.inputElm).value);
        	if (Options.state == Options.sSelect) {
        		Buttons.ynShow();
        		return;
        	}
 			
        	Main.log("Enter pressed -> Done Val= ("+ document.getElementById(Options.inputElm).value+")");
        	
        	Config.updateContext(document.getElementById(Options.inputElm).value); 
        	if (Config.firstLaunch == true) 
        		Main.state = 1;        		

        	Main.enableKeys();
        	Options.hide();
        	Main.changeState(0);      	
        	Config.fetchConfig();

        	break;
        case tvKey.KEY_RED:
        	// Clear All
        	Main.log("Red pressed");
        	if (Options.state != Options.sEnter )
        		return;
        	Options.deleteAll();
        	break;

        case tvKey.KEY_GREEN:
        	// Clear Char
        	Main.log("Green pressed");
        	if (Options.state != Options.sEnter )
        		return;
        	Options.deleteChar();
        	break;

        case tvKey.KEY_TTX_MIX:
        case tvKey.KEY_YELLOW:
        	// Dot
        	Main.log("Yellow pressed");
        	if (Options.state == Options.sSelect) {
        		Buttons.ynShow();
        		return;
        	}

        	if (Options.state == Options.sEnter ) {
            	Options.insertChar(".");        		
        	}

        	break;

        case tvKey.KEY_PRECH:
        case tvKey.KEY_BLUE:
        	Main.log("Blue pressed");
        	if (Options.state != Options.sEnter )
        		return;
        	// Colon
        	Options.insertChar(":");
        	break;
    }
	widgetAPI.blockNavigation(event);

};




