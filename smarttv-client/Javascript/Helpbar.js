
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
		.hb-bg {width:960px; height: 40px; left: 0px; top: 480px; font-size:16px;background: darkblue;background: -webkit-linear-gradient(top, #1e5799 0%,#7db9e8 50%,#1e5799 100%);}\
		}'});
	$('body').append(sheet);

	
	$("<table>", {id:"helpbar", class: "hb-bg"}).appendTo ($("body"));
//	$("#helpbar").hide();
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
	hb_elm.appendTo("#hb-row");
	
	var tab = $("<table>");
	tab.appendTo(hb_elm);
	var row = $("<tr>");
	row.appendTo(tab);
	
	$("<td>").append($("<img>", { src: url})).appendTo(row);
	$("<td>").append($("<p>", { text: msg})).appendTo(row);

};