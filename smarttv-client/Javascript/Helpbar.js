var Helpbar = {
	isInited : false	
};

Helpbar.init = function () {
	if (this.isInited == false)	{
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