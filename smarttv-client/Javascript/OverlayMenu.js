var OverlayMenu = {
	menu : [],
	scrollDur : 300,
	scrollFlip : 100,
	returnCallback : null
};

OverlayMenu.init = function () {
	// initiate the overlay menu
	OverlayMenu.createStyleSheet();

	this.elmName = "#olm-";
	this.masterElm = "#overlayMenu";
	this.inputElm = "#overlayMenu-anchor";
	this.btnSelected = 0;
	this.scrolling = false;
	
	var elem = document.getElementById('overlayMenu-anchor');
	elem.setAttribute('onkeydown', 'OverlayMenu.onInput();');

	$("#overlayMenu").hide();
};


OverlayMenu.show = function() {
	Main.log("***** OverlayMenu.show *****");
	this.scrolling = false;
	OverlayMenu.createMenu();
//	this.menuHandler.show();
	
	Main.log("OverlayMenu.show(): masterElm= " +this.masterElm + " inputElm= " + this.inputElm);
	$(this.masterElm).show();
	OverlayMenu.tuneMenu();

	$(this.inputElm).focus();
	this.reset ();
};

OverlayMenu.hide = function() {
	Main.log("OverlayMenu.hide(): masterElm= " +this.masterElm + " inputElm= " + this.inputElm);
	
	$(this.masterElm).hide();
	$(this.inputElm).blur();
	$("#ovlTable").remove();
	Main.enableKeys();
	
};

OverlayMenu.createStyleSheet = function () {
	var sheet = $("<style>");
	sheet.attr({type : 'text/css',
		innerHTML : '\
		#overlayMenu { width:40%; position: absolute; text-align:center; border-width:1px;\
		            background:rgba(0,0,139, 0.8);border-style:solid;border-width:1px;border-radius:15px;\
			       -webkit-box-shadow:3px 3px 7px 4px rgba(0,0,0, 0.5);z-index:50;}\
		.ovl-itm { margin-left: 10px; \
			padding: 10px 10px 10px 10px;\
			border-radius:10px; \
			font-size:16px;\
			border-style:solid;\
			border-width:1px;\
			background: transparent;}\
		.ovlmn-itm-selected {margin-left: 10px; \
			padding: 10px 10px 10px 10px;\
			border-radius:10px; \
			font-size:16px;\
			border-style:solid;\
			border-width:1px;\
			background-color: "white";\
			background-color: "-webkit-linear-gradient(top, rgba(246,248,249,1) 0%,rgba(229,235,238,1) 50%,rgba(215,222,227,1) 51%,rgba(245,247,249,1) 100%)";\
			}\
		}'});

	$('body').append(sheet);
};
/*
OverlayMenu.createMenu= function () {	
	var p_width = $("body").outerWidth();
	var p_height = $("body").outerHeight();
	

	var table = $("<table>", {style:"height:100%;width:100%;", id:"ovlTable"});
	$("#overlayMenu").append(table);

	var tbody = $("<tbody>", {style:"height:100%;width:100%;"});
	table.append(tbody);

	for (var i = 0; i < OverlayMenu.menu.length; i++) {
		var row = OverlayMenu.createEntry(OverlayMenu.menu[i].title, i);
		tbody.append(row);
	}

	var row = OverlayMenu.createHelpbarRow();
	tbody.append(row);

	$("#overlayMenu").css({"left": ((p_width - $("#overlayMenu").outerWidth()) /2) +"px", "top": ((p_height - $("#overlayMenu").outerHeight()) /2) +"px"	});
};



OverlayMenu.createEntry = function(name, id) {
	var row = $("<tr>", {style: "width:100%; align:center"});
	
	var cell = $("<td>", {style: "width:100%; align:center"});
//	cell.css("align","center");
	Main.log("OverlayMenu.createEntry: " +"olm-"+id);
	$("<button>", {id : "olm-"+id, text: name, class: "ovl-itm"}).appendTo(cell);
//	$("<button>", {id : this.elmName +id, text: name, class: "ovl-itm"}).appendTo(cell);
	
	
	row.append(cell);

	return row;
};
*/

OverlayMenu.tuneMenu = function () {
	var p_width = $("body").outerWidth();
	var p_height = $("body").outerHeight();

	var tgt = p_height * 0.6;
	
	if ($("#overlayMenu").outerHeight() > tgt) {
		this.scrolling = true;
		var tgt_height_delta = ($("#overlayMenu").outerHeight() -tgt);
		Main.log("tgt_height_delta= " + tgt_height_delta);
		var tgt_height = $("#ovlBody").height() - tgt_height_delta;
		Main.log("tgt_height= " + tgt_height);
	
		$("#ovlBody").css({"height":tgt_height+"px"});	
	}
	$("#overlayMenu").css({"left": ((p_width - $("#overlayMenu").outerWidth()) /2) +"px", 
		"top": ((p_height - $("#overlayMenu").outerHeight()) /2) +"px"});

	Main.log("ovlOuterHeight=" + $("#overlayMenu").outerHeight() );
	Main.log("ovlBodyOuterHeight=" + $("#ovlBody").outerHeight() );
		
};

OverlayMenu.createMenu= function () {	
	var p_width = $("body").outerWidth();
	var p_height = $("body").outerHeight();

	var table = $("<div>", {style:"height:100%;width:100%;", id:"ovlTable"});
	$("#overlayMenu").append(table);
//	var table = $("overlayMenu");
	
	var tbody = $("<div>", {style:"width:100%;overflow-y: scroll;margin-top:3px;", id:"ovlBody"});
	for (var i = 0; i < OverlayMenu.menu.length; i++) {
		var row = OverlayMenu.createEntry(OverlayMenu.menu[i].title, i);
		tbody.append(row);
	}

	table.append(tbody);
	
	var row = OverlayMenu.createHelpbarRow();
	table.append(row);

	$("#overlayMenu").css({"left": ((p_width - $("#overlayMenu").outerWidth()) /2) +"px", 
		"top": ((p_height - $("#overlayMenu").outerHeight()) /2) +"px"});

};


OverlayMenu.createEntry = function(name, id) {	
	var cell = $("<div>", {style: "width:100%; align:center;"});
	Main.log("OverlayMenu.createEntry: " +"olm-"+id);
	$("<button>", {id : "olm-"+id, text: name, class: "ovl-itm"}).appendTo(cell);
	return cell;
};

OverlayMenu.createHelpbarRow = function() {
//	var res  = $("<tr>", {style: "width:100%; align:center"});
//	var outer_cell = $("<td>", {style: "width:100%; align:center"});
	var outer_cell = $("<div>", {style: "width:100%; align:center"});
	var h_table = $("<table>", {style:"height:100%;width:100%;"});

	var tbody = $("<tbody>", {style:"height:100%;width:100%;"});
	h_table.append(tbody);
	var row = $("<tr>", {style: "width:100%; align:center"});
	tbody.append(row);

	var cell = OverlayMenu.createHelpItem("Images/helpbar/help_ud.png", "Select");
	row.append(cell);
	cell = OverlayMenu.createHelpItem("Images/helpbar/help_enter.png", "OK");
	row.append(cell);

	cell = OverlayMenu.createHelpItem("Images/helpbar/help_back.png", "Cancel");
	row.append(cell);

	outer_cell.append(h_table);
	return outer_cell;
//	res.append(outer_cell);
//	return res;
};

OverlayMenu.createHelpItem = function(url, msg) {
	
	var cell = $("<td>", {style: "align:center"});
//	cell.css("align","center");

	var hb_elm = $("<div>");
	hb_elm.css({"display":"inline-block", "padding-right":"10px"});
	cell.append(hb_elm);
	
	hb_elm.append($("<img>", { src: url, style: "display:inline-block"}));
	hb_elm.append($("<div>", { text: msg, style: "display:inline-block; padding-bottom:10px"}));

	return cell;
};


OverlayMenu.reset = function () {
	this.returnCallback = null;
	this.btnSelected = 0;
	for (var i =0; i <= OverlayMenu.menu.length; i++) {
		$(this.elmName + i).removeClass('ovlmn-itm-selected').addClass('ovl-itm'); 
	}
	$(this.elmName+"0").removeClass('ovl-itm').addClass('ovlmn-itm-selected'); 
};


OverlayMenu.selectBtnUp = function () {
	var btnname = this.elmName+this.btnSelected;
	Main.log(this.hndlName + "-BtnLeft: Old: " +this.btnSelected + " btn= "+btnname);
	$(btnname).removeClass('ovlmn-itm-selected').addClass('ovl-itm'); 
	if (this.btnSelected == 0) {
		this.btnSelected = (OverlayMenu.menu.length-1);
//		$("#ovlBody").scrollTop($(this.elmName + this.btnSelected).parent().position().top);
		$("#ovlBody").animate ({scrollTop: $(this.elmName + this.btnSelected).parent().position().top}, this.scrollFlip);

		}
	else {
		this.btnSelected--;
		if (this.scrolling) {
			var pos = $(this.elmName + this.btnSelected).parent().position().top;
			Main.log("pos= " + pos + " ovlBodyHeight= " + $("#ovlBody").height() + " scrollTop= " + $("#ovlBody").scrollTop());
			if (pos < 0) {
//				$("#ovlBody").scrollTop($("#ovlBody").scrollTop() + pos);	
				$("#ovlBody").animate ({scrollTop: $("#ovlBody").scrollTop() + pos}, this.scrollDur);
				Main.log("New scrollTop= " +$("#ovlBody").scrollTop() +" new pos= " + $(this.elmName + this.btnSelected).parent().position().top);
			}
		}
	}
	$(this.elmName + this.btnSelected).removeClass('ovl-itm').addClass('ovlmn-itm-selected'); 
	Main.log(this.hndlName+"-BtnUp: New: " +this.btnSelected);
};

OverlayMenu.selectBtnDown = function () {
	$(this.elmName + this.btnSelected).removeClass('ovlmn-itm-selected').addClass('ovl-itm'); 
	if (this.btnSelected == (OverlayMenu.menu.length-1)) {
		this.btnSelected = 0;
		if (this.scrolling)
//			$("#ovlBody").scrollTop(0);
			$("#ovlBody").animate ({scrollTop: 0}, this.scrollFlip);
	}
	else {
		this.btnSelected++;
		if (this.scrolling) {
			var pos = $(this.elmName + this.btnSelected).parent().position().top;
			var height = $(this.elmName + this.btnSelected).parent().height();
			Main.log("pos= " + pos + " height= " + height + " ovlBodyHeight= " + $("#ovlBody").height() + " scrollTop= " + $("#ovlBody").scrollTop());
			if ((pos + height) > $("#ovlBody").height()) {
				$("#ovlBody").animate ({scrollTop: $("#ovlBody").scrollTop() + (pos + height) - $("#ovlBody").height()}, this.scrollDur); 
//				$("#ovlBody").scrollTop($("#ovlBody").scrollTop() + (pos + height) - $("#ovlBody").height());
				Main.log("New scrollTop= " +$("#ovlBody").scrollTop() +" new pos= " + $(this.elmName + this.btnSelected).parent().position().top);
			}

		}		
	}

	$(this.elmName + this.btnSelected).removeClass('ovl-itm').addClass('ovlmn-itm-selected'); 
	
	
};

OverlayMenu.onInput = function () {
    var keyCode = event.keyCode;
	Main.log(this.hndlName+" key= " + keyCode);
    switch(keyCode) {
		case tvKey.KEY_UP:
			Main.log(this.hndlName+"-Select Up");
			this.selectBtnUp();
			break;
		case tvKey.KEY_DOWN:
			Main.log(this.hndlName+"-Select Down");
			this.selectBtnDown();
		break;
		case tvKey.KEY_ENTER:
			if (OverlayMenu.menu[this.btnSelected].func  != undefined)
				OverlayMenu.menu[this.btnSelected].func(this.btnSelected); 	    	
			else
				Main.log("OverlayMenu.Enter: enterCallback is NULL");
			OverlayMenu.hide();

		break;
		case tvKey.KEY_RETURN:
		case tvKey.KEY_EXIT:
			OverlayMenu.hide();
			Main.log("OverlayMenu.onInput -> Exit");

			if (Main.state == Main.eCMDS)
				Main.changeState(0);

			if (OverlayMenu.returnCallback  != null)
				OverlayMenu.returnCallback(); 	    	
			break;

	}
	widgetAPI.blockNavigation(event);
};
	
//-----------------------------------------------------------------------
var TestHandler = {
		
};

TestHandler.showMenu = function (no) {
	OverlayMenu.reset();
	OverlayMenu.menu = [];	

	for (var i = 0; i < no; i++) {
		var self = this;
		OverlayMenu.menu.push ({title: ("Test Title " +i), func : function (idx) { self.selectCallback(idx); } });
	}

	OverlayMenu.show();
};

TestHandler.selectCallback = function (idx) {
	Main.log("TestHandler.selectCallback idx= " + idx );
};

//-----------------------------------------------------------------------
var RecCmdHandler = {
	guid : ""
};


RecCmdHandler.showMenu = function (guid) {
	this.guid = guid;
	RecCmds.reset();
	Server.fetchRecCmdsList();   // calls RecCmdHandler.createRecCmdOverlay() when finished
	OverlayMenu.reset();
	OverlayMenu.menu = [];		
};

RecCmdHandler.fillMenuArray = function () {
	for (var i = 0; i < RecCmds.getVideoCount(); i++) {
		var self = this;
		OverlayMenu.menu.push ({title: RecCmds.getCurrentItem().childs[i].title, func : function (idx) { self.selectCallback(idx); } });
	}
	
};

RecCmdHandler.createRecCmdOverlay = function () {
	//called, when Server.fetchRecCmdsList() is finished.
	Main.log("RecCmdHandler.createRecCmdOverlay for guid " + RecCmdHandler.guid);
	Main.logToServer("RecCmdHandler.createRecCmdOverlay for guid " + RecCmdHandler.guid);
	if (RecCmds.getVideoCount()== 0) {
		Main.log("RecCmdHandler.createRecCmdOverlay: RecCmds is empty" );
		Main.logToServer("RecCmdHandler.createRecCmdOverlay: RecCmds is empty" );
		return;		
	}
	RecCmdHandler.fillMenuArray();
	OverlayMenu.show();
};
	
RecCmdHandler.selectCallback = function (idx) {
	Main.logToServer("RecCmdHandler.selectCallback idx= " + idx + " t= " + RecCmds.getCurrentItem().childs[idx].title);
	if (RecCmds.getCurrentItem().childs[idx].isFolder == true) {
		Main.logToServer("RecCmdHandler.selectCallback isFolder");
		RecCmds.selectFolder(idx, 0);

		OverlayMenu.reset();
		OverlayMenu.menu = [];		
		RecCmdHandler.fillMenuArray();	
	}
	else {
		Main.logToServer("RecCmdHandler.selectCallback idx= " + idx + " cmd= " + RecCmds.getCurrentItem().childs[idx].payload.cmd);
		Server.execRecCmd(RecCmds.getCurrentItem().childs[idx].payload.cmd, RecCmdHandler.guid);
	}
};


//-----------------------------------------------------------------------
var CmdHandler = {
	guid : ""
};


CmdHandler.showMenu = function (guid) {
	this.guid = guid;
	RecCmds.reset();
	Server.fetchCmdsList();   // calls RecCmdHandler.createRecCmdOverlay() when finished
	OverlayMenu.reset();
	OverlayMenu.menu = [];		
	
};

CmdHandler.fillMenuArray = function () {
	for (var i = 0; i < RecCmds.getVideoCount(); i++) {
		var self = this;
		OverlayMenu.menu.push ({title: RecCmds.getCurrentItem().childs[i].title, func : function (idx) { self.selectCallback(idx); } });
	}
	
};

CmdHandler.createCmdOverlay = function () {
	//called, when Server.fetchRecCmdsList() is finished.
	Main.log("CmdHandler.createCmdOverlay for guid " + CmdHandler.guid);
	Main.logToServer("CmdHandler.createCmdOverlay for guid " + CmdHandler.guid);
	if (RecCmds.getVideoCount()== 0) {
		Main.log("CmdHandler.createCmdOverlay: RecCmds is empty" );
		Main.logToServer("CmdHandler.createCmdOverlay: RecCmds is empty" );
		return;		
	}
	CmdHandler.fillMenuArray();
	
	OverlayMenu.show();
};
	
CmdHandler.selectCallback = function (idx) {
	Main.logToServer("CmdHandler.selectCallback idx= " + idx + " t= " + RecCmds.getCurrentItem().childs[idx].title);
	if (RecCmds.getCurrentItem().childs[idx].isFolder == true) {
		Main.logToServer("CmdHandler.selectCallback isFolder");
		RecCmds.selectFolder(idx, 0);

		OverlayMenu.reset();
		OverlayMenu.menu = [];		
		CmdHandler.fillMenuArray();	
	}
	else {
		Main.logToServer("CmdHandler.selectCallback idx= " + idx + " cmd= " + RecCmds.getCurrentItem().childs[idx].payload.cmd);
		Server.execCmd(RecCmds.getCurrentItem().childs[idx].payload.cmd);
	}
};
