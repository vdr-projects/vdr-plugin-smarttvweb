var Options = {
	imeBox : null,
	inputElm : "widgetServerAddr",
	jqInputElm : "#widgetServerAddr",
	cursor : "_",
	cursorPos : 0,
	isCreated : false	

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
//	document.getElementById("optionsScreen").style.display="block";
	$("#optionsScreen").show();
	
	if (Config.firstLaunch == true)
		document.getElementById(Options.inputElm).value = Config.serverAddrDefault ;
	else
		document.getElementById(Options.inputElm).value = Config.serverAddr;

	Options.cursorPos = document.getElementById(Options.inputElm).value.length;

	$(this.jqInputElm).focus();
//	document.getElementById(Options.inputElm).focus();

	Helpbar.init();
	Helpbar.show();
};

Options.hide = function() {
	$("#optionsScreen").hide();
//	document.getElementById("optionsScreen").style.display="none";
	Helpbar.hide();
	Main.enableKeys();
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
//		document.getElementById(Options.inputElm).value = char + Options.cursor;
	}
	else {
		if (Options.cursorPos == txt.length) {
			res = txt + char;			
		}
		else {
			res = txt.slice(0, Options.cursorPos) + char + txt.slice(Options.cursorPos);	
//			document.getElementById(Options.inputElm).value = txt.slice(0, Options.cursorPos) + char + txt.slice(Options.cursorPos);			
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
//	document.getElementById(Options.inputElm).value = "" +Options.cursor;
};

Options.deleteChar = function() {
	var txt = document.getElementById(Options.inputElm).value;
//	alert("Options.cursorPos= " +Options.cursorPos);
//	alert("txt.length= " +txt.length);
	document.getElementById(Options.inputElm).value = txt.slice(0, (Options.cursorPos-1))  + txt.slice(Options.cursorPos);
	Options.cursorPos = Options.cursorPos -1;
	Options.setCursor(Options.cursorPos);
};


Options.moveCursorLeft = function() {
	if (Options.cursorPos == 0)
		return;
	Options.cursorPos = Options.cursorPos -1;
	Options.setCursor(Options.cursorPos);
//	document.getElementById(Options.inputElm).setSelectionRange(Options.cursorPos, Options.cursorPos);
	/*
	if (Options.cursorPos == 0)
		return;
	var txt = document.getElementById(Options.inputElm).value;
	var tgt = txt.slice(0, (Options.cursorPos-1)) + Options.cursor +txt.slice((Options.cursorPos-1), Options.cursorPos) + txt.slice(Options.cursorPos+1);
	
	document.getElementById(Options.inputElm).value = tgt;
	Options.cursorPos = Options.cursorPos -1;
	*/
};

Options.moveCursorRight = function() {
	if (Options.cursorPos == document.getElementById(Options.inputElm).value.length)
		return;
	Options.cursorPos = Options.cursorPos +1;
//	document.getElementById(Options.inputElm).setSelectionRange(Options.cursorPos, Options.cursorPos);
	Options.setCursor(Options.cursorPos);


	/*
	var txt = document.getElementById(Options.inputElm).value;
	if (Options.cursorPos == txt.length-1)
		return;
	
	var tgt = txt.slice(0, Options.cursorPos) +txt.slice((Options.cursorPos+1), (Options.cursorPos+2)) + Options.cursor + txt.slice(Options.cursorPos+2);
	
	document.getElementById(Options.inputElm).value = tgt;
	Options.cursorPos = Options.cursorPos +1;
	*/
};


Options.onInput = function () {
    var keyCode = event.keyCode;

    switch(keyCode) {
        case tvKey.KEY_1:
        	Main.log("KEY_1 pressed");
        	Options.insertChar("1");

        	$("#kb-btn-1").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-1").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);
        	
        	break;
        case tvKey.KEY_2:
        	Main.log("KEY_2 pressed");
        	Options.insertChar("2");
        	$("#kb-btn-2").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-2").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);
        	
        	break;
        case tvKey.KEY_3:
        	Main.log("KEY_3 pressed");
        	Options.insertChar("3");

        	$("#kb-btn-3").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-3").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);
        	break;
        case tvKey.KEY_4:
        	Main.log("KEY_4 pressed");
        	Options.insertChar("4");

        	document.getElementById("kb-btn-4").click();

        	$("#kb-btn-4").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-4").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_5:
        	Main.log("KEY_5 pressed");
        	Options.insertChar("5");

        	$("#kb-btn-5").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-5").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_6:
        	Main.log("KEY_6 pressed");
        	Options.insertChar("6");

        	$("#kb-btn-6").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-6").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_7:
        	Main.log("KEY_7 pressed");
        	Options.insertChar("7");

        	$("#kb-btn-7").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-7").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_8:
        	Main.log("KEY_8 pressed");
        	Options.insertChar("8");
        	$("#kb-btn-8").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-8").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_9:
        	Main.log("KEY_9 pressed");
        	Options.insertChar("9");

        	$("#kb-btn-9").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-9").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_0:
        	Main.log("KEY_0 pressed");
        	Options.insertChar("0");
        	$("#kb-btn-0").removeClass('ui-btn').addClass('ui-btn-pressed');
        	setTimeout(function() {
        		$("#kb-btn-0").removeClass('ui-btn-pressed').addClass('ui-btn');
        	}, 80);

        	break;
        case tvKey.KEY_LEFT:
        	Options.moveCursorLeft();
        	break;
        case tvKey.KEY_RIGHT:
        	Options.moveCursorRight();
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
        	Options.deleteAll();
        	break;

        case tvKey.KEY_GREEN:
        	// Clear Char
        	Main.log("Green pressed");
        	Options.deleteChar();
        	break;

        case tvKey.KEY_TTX_MIX:
        case tvKey.KEY_YELLOW:
        	// Dot
        	Main.log("Yellow pressed");

        	Options.insertChar(".");
        	break;

        case tvKey.KEY_PRECH:
        case tvKey.KEY_BLUE:
        	Main.log("Blue pressed");
        	// Colon
        	Options.insertChar(":");
        	break;
    }
	widgetAPI.blockNavigation(event);

};




