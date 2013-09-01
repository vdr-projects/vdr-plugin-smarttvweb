var SelectScreen = {
	keyToStateMap : []
};


SelectScreen.init = function() {
    Main.log("SelectScreen.init");
    Main.logToServer("Config.getWidgetVersion= " + Config.widgetVersion) ;
	var parent = $("#selectView");
	var idx = 0;
	$("#selectScreen").show();
	
	this.keyToStateMap[idx] = Main.eMAIN; // State of this view
	this.keyToStateMap[++idx] = Main.eLIVE;
	parent.append($("<div>", {id : "selectItem"+idx, text:idx+": Live", class : "style_menuItem"}));
	
	this.keyToStateMap[++idx] = Main.eREC;
	parent.append($("<div>", {id : "selectItem"+idx, text:idx+": Recordings", class : "style_menuItem"}));

	this.keyToStateMap[++idx] = Main.eMED;
	parent.append($("<div>", {id : "selectItem"+idx, text:idx+": Media", class : "style_menuItem"}));

	this.keyToStateMap[++idx] = Main.eTMR;
	parent.append($("<div>", {id : "selectItem"+idx, text:idx+": Timers", class : "style_menuItem"}));

	if (Config.haveYouTube) {
		this.keyToStateMap[++idx] = Main.eURLS;
		parent.append($("<div>", {id : "selectItem"+idx, text:idx+": You Tube", class : "style_menuItem"}));
//		Main.selectMenuKeyHndl.selectMax++;
	}
	
	this.keyToStateMap[++idx] = Main.eSRVR;
	parent.append($("<div>", {id : "selectItem"+idx, text:idx+": Select Server", class : "style_menuItem"}));
	this.keyToStateMap[++idx] = Main.eOPT;
	parent.append($("<div>", {id : "selectItem"+idx, text:idx+": Options", class : "style_menuItem"}));

/*
	var done = false;
    var i = 0;

    while (done != true) {
    	i ++;
    	var elm = document.getElementById("selectItem"+i);
//    	var elm = $("#selectItem"+i);
    	if (elm == null) {
    		done = true;
    		break;
    	}
    	Main.log("found " + i);
    	elm.style.paddingBottom = "3px";
    	elm.style.marginTop= " 5px";
    	elm.style.marginBottom= " 5px";
    	elm.style.textAlign = "center";
    	
    }
*/
	Main.selectMenuKeyHndl.selectMax = idx;
    Display.selectItem(document.getElementById("selectItem1"));
//    Display.jqSelectItem($("#selectItem1"));
    Main.log("SelectScreen.init - done");

};

SelectScreen.resetElements = function () {
	$('.style_menuItem').remove();
	this.keyToStateMap = [];
//	Main.selectMenuKeyHndl.selectMax = 5;
	Main.selectMenuKeyHndl.select =1;
//	Main.selectedVideo = 0;
	
};

SelectScreen.keyToState = function (key) {
	
};
//---------------------------------------------------
//Select Menu Key Handler
//---------------------------------------------------
function cSelectMenuKeyHndl (def_hndl) {
	this.defaultKeyHandler = def_hndl;
	this.handlerName = "SelectMenuKeyHandler";
	Main.log(this.handlerName + " created");

	this.select = 1;
	this.selectMax = 5; // Highest Select Entry
//	this.selectMax = 6; // Highest Select Entry
};

cSelectMenuKeyHndl.prototype.handleKeyDown = function (keyCode) {
// var keyCode = event.keyCode;
// Main.log(this.handlerName+": Key pressed: " + Main.getKeyCode(keyCode));
 
 switch(keyCode) {
 case tvKey.KEY_1:
 	Main.log("KEY_1 pressed");
 	this.select = 1;
     Main.changeState (SelectScreen.keyToStateMap[this.select]);
 	break;
 case tvKey.KEY_2:
 	Main.log("KEY_2 pressed");
 	this.select = 2;
     Main.changeState (SelectScreen.keyToStateMap[this.select]);

     break;
 case tvKey.KEY_3:
 	Main.log("KEY_3 pressed");
 	this.select = 3;
     Main.changeState (SelectScreen.keyToStateMap[this.select]);

 	break;
 case tvKey.KEY_4:
 	Main.log("KEY_4 pressed");
 	this.select = 4;
     Main.changeState (SelectScreen.keyToStateMap[this.select]);
 	break;

 case tvKey.KEY_5:
 	Main.log("KEY_5 pressed");
 	this.select = 5;
     Main.changeState (SelectScreen.keyToStateMap[this.select]);
 	break;

 case tvKey.KEY_6:
 	Main.log("KEY_6 pressed");
 	this.select = 6;
     Main.changeState (SelectScreen.keyToStateMap[this.select]);
 	break;

 case tvKey.KEY_ENTER:
 case tvKey.KEY_PLAY:
 case tvKey.KEY_PANEL_ENTER:
 	Main.log("ENTER");
 	Main.log ("CurSelect= " + this.select + " State= " + SelectScreen.keyToStateMap[this.select]);

 	Main.changeState (SelectScreen.keyToStateMap[this.select]);

 	break; //thlo: correct?
 case tvKey.KEY_DOWN:
 	Display.unselectItem(document.getElementById("selectItem"+this.select));
 	if (++this.select > this.selectMax) 	          	
 		this.select = 1;
 	Display.selectItem(document.getElementById("selectItem"+this.select));
 	Main.log("DOWN " +this.select);
 	break;
         
 case tvKey.KEY_UP:
 	Display.unselectItem(document.getElementById("selectItem"+this.select));

 	if (--this.select < 1)
 		this.select = this.selectMax;
 	Display.selectItem(document.getElementById("selectItem"+this.select));

 	Main.log("UP "+ this.select);
 	break;            
 default:
 	this.defaultKeyHandler.handleDefKeyDown(keyCode);
 break;
 }
};
