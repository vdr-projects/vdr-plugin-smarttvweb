var OverlayMenu = {
	menu : []	
};

OverlayMenu.init = function () {
	// initiate the overlay menue
	
	// should get an Array with Title and Command as input
//	OverlayMenu.menu.push ({title: "Teefax", func : undefined});
//	OverlayMenu.menu.push ({title: "Verleihnix", func : undefined});

	OverlayMenu.createStyleSheet();
	

	this.elmName = "#olm-";
	this.masterElm = "#overlayMenu";
	this.inputElm = "#overlayMenu-anchor";
	this.btnSelected = 0;
	
	var elem = document.getElementById('overlayMenu-anchor');
	elem.setAttribute('onkeydown', 'OverlayMenu.onInput();');

	$("#overlayMenu").hide();
};


OverlayMenu.show = function() {
	Main.log("***** OverlayMenu.show *****");
	OverlayMenu.createMenu();
//	this.menuHandler.show();
	
	Main.log("OverlayMenu.show(): masterElm= " +this.masterElm + " inputElm= " + this.inputElm);
	$(this.masterElm).show();
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
		#overlayMenu { width:40%; height: 30%; position: absolute; text-align:center; border-width:1px;\
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

OverlayMenu.createHelpbarRow = function() {
	var res  = $("<tr>", {style: "width:100%; align:center"});
	var outer_cell = $("<td>", {style: "width:100%; align:center"});

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
	res.append(outer_cell);

	return res;
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
	if (this.btnSelected == 0)
		this.btnSelected = (OverlayMenu.menu.length-1);
	else
		this.btnSelected--;
	$(this.elmName + this.btnSelected).removeClass('ovl-itm').addClass('ovlmn-itm-selected'); 
	Main.log(this.hndlName+"-BtnUp: New: " +this.btnSelected);
};

OverlayMenu.selectBtnDown = function () {
	$(this.elmName + this.btnSelected).removeClass('ovlmn-itm-selected').addClass('ovl-itm'); 
	if (this.btnSelected == (OverlayMenu.menu.length-1))
		this.btnSelected = 0;
	else
		this.btnSelected++;
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
			if (this.returnCallback  != null)
				this.returnCallback(); 	    	
			break;

	}
	widgetAPI.blockNavigation(event);
	};
	

