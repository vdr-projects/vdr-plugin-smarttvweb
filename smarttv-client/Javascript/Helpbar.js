var Helpbar = {
	isInited : false	
};

Helpbar.init = function () {
	if (this.isInited == false)	{
		Helpbar.createHelpbar();	
		Helpbar.hide();
	}
};

Helpbar.show = function () {
	$("#helpbar").show();
};

Helpbar.hide = function () {
	$("#helpbar").hide();
};

Helpbar.createHelpbar = function() {
	this.isInited = true;
	var sheet = $("<style>");
	sheet.attr({type : 'text/css',
		innerHTML : '\
		.hb-bg {left:0px; top:480px; width:960px; height:40px; position: absolute; font-size:18px; background: darkblue;background: -webkit-linear-gradient(top, #1e5799 0%,#7db9e8 50%,#1e5799 100%);}\
		}'});
	$('body').append(sheet);

//	$('<div>', { id: "helpbar", class: "hb-bg"}).appendTo ($("body"));
//	$('<div>', {id: "hb-row"}).appendTo("#helpbar");
	$("<table>", {id:"helpbar", class: "hb-bg"}).appendTo ($("body"));
	$("<tr>", {id: "hb-row", align:"center", valign:"middle"}).appendTo("#helpbar");

	Helpbar.addItem("Images/helpbar/help_lr.png", "Move Cursor");
	Helpbar.addItem("Images/helpbar/help_back.png", "Cancel");
	
	Helpbar.addItem("Images/helpbar/help_enter.png", "Done");
	Helpbar.addItem("Images/helpbar/help_red.png", "Clear all");
	Helpbar.addItem("Images/helpbar/help_green.png", "Clear Char");
	Helpbar.addItem("Images/helpbar/help_yellow.png", "Dot (.)");
	Helpbar.addItem("Images/helpbar/help_blue.png", "Colon (:)");
};

Helpbar.addItem = function(url, msg) {
	var hb_elm = $("<td>");
//	var hb_elm = $("<div>");
//	hb_elm.css({"display":"inline-block"});
	hb_elm.appendTo("#hb-row");
	
	var tab = $("<table>");
	tab.appendTo(hb_elm);
	var row = $("<tr>");
	row.appendTo(tab);
	
	$("<td>").append($("<img>", { src: url})).appendTo(row);
	$("<td>").append($("<p>", { text: msg})).appendTo(row);
};