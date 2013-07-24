DirectAccess = {
	created: false,
	returnCallback : null,
	timeout : 0,
	timeoutObj : null,
	delay : 1500
};

/*
There is the Data.directAccessMap which contains an array for each channel number

When I do a direct access, then I first need to "go down to root" and then apply the positions from the array.

Main.selectedVideo needs to point to the selected video of that current folder


*/
DirectAccess.init = function (){
	if (this.created == false) {
		DirectAccess.createStyleSheet();
		$("#directChanAccess").hide();
		this.created = true;
	}
};

DirectAccess.selectNewChannel = function (num) {
	Main.log("DirectAccess.selectNewChannel: val= (" + num + ")");
	if (!(num in Data.directAccessMap)){
		Main.log("DirectAccess.selectNewChannel: val= (" + num +") not found!");
		Notify.showNotify("Not Found", true);

/*		Player.stopVideo();
		Main.changeState(0);
		widgetAPI.blockNavigation(event);
*/
		return;
	}
	
	Main.log("DirectAccess.selectNewChannel num= " + num + " Data.directAccessMap[num]= " +Data.directAccessMap[num] );
	if (Data.isRootFolder() != true) {
 		var itm = Data.folderUp();
		Main.selectedVideo = itm.id;
	}
	// now I should be in root
	switch(Data.directAccessMap[num].length) {
	case 1:
		Main.selectedVideo= Data.directAccessMap[num][0];
		Main.log("DirectAccess.selectNewChannel num=" + num +" - Case 1: Main.selectedVideo= "+ Main.selectedVideo);
		break;
	case 2:
		Main.log("DirectAccess.selectNewChannel num=" + num +" - Case 2: Data.directAccessMap[num][0]= "+ Data.directAccessMap[num][0] + " Data.directAccessMap[num][1]= " + Data.directAccessMap[num][1]);
 		if (Data.getCurrentItem().childs[Data.directAccessMap[num][0]].isFolder == true) {
 			Data.selectFolder(Data.directAccessMap[num][0], Data.directAccessMap[num][0]);
 			Main.selectedVideo= Data.directAccessMap[num][1];
 		}
		else {
			// Error: Should be a folder, if there is two elms in directAccessMap
			Display.showPopup("directAccess Failed: Inconsistency in directAccessMap");
			Main.log("ERROR in selectNewChannel num=" + num +"- Case 2: Data.directAccessMap[num][0]= "+ Data.directAccessMap[num][0] + " Data.directAccessMap[num][1]= " + Data.directAccessMap[num][1]);
			
			Player.stopVideo();
			Main.changeState(0);
			widgetAPI.blockNavigation(event);
		}
		break;
	default:
		Display.showPopup("directAccess Failed: Inconsistency in directAccessMap. More than 2 elms");
		Main.log("ERROR in selectNewChannel num=" + num +" - Data.directAccessMap[num].length= "+ Data.directAccessMap[num].length);
		Player.stopVideo();
		Main.changeState(0);
		widgetAPI.blockNavigation(event);
		
		return;
		break;
	}
	
	Player.stopVideo();
	Main.playItem(); 

	
		//
};


DirectAccess.show = function (val) {
	Main.log("DirectAccess.show " + val);
	$("#directAccessText").text(val);
	$("#directChanAccess").show();
	$("#directAccessAnchor").focus();
	DirectAccess.timeout = Display.GetEpochTime() + (DirectAccess.delay / 1000.0);
	DirectAccess.timeoutObj = window.setTimeout( function() {DirectAccess.handleTimeout();}, DirectAccess.delay);
	Main.log("DirectAccess.show: now= "+ Display.GetEpochTime() +" timeout= " + DirectAccess.timeout +" delta= " + (DirectAccess.timeout -Display.GetEpochTime()));
	};


DirectAccess.hide = function () {
	Main.log("DirectAccess.hide: timeout= " + DirectAccess.timeout);
	if (DirectAccess.timeoutObj != null) {
		window.clearTimeout(DirectAccess.timeoutObj);
		DirectAccess.timeoutObj = null;
	};
//	$("#directAccessAnchor").val("");
	$("#directAccessText").text("");

	$("#directChanAccess").hide();
	$("#directAccessAnchor").blur();
	Main.enableKeys();
};

DirectAccess.handleTimeout = function () {
	Main.log("DirectAccess.handleTimeout");
	DirectAccess.timeoutObj = null;
	if (Display.GetEpochTime() < DirectAccess.timeout) {
		var delta = (DirectAccess.timeout -Display.GetEpochTime()) *1000.0;
		DirectAccess.timeoutObj = window.setTimeout( DirectAccess.handleTimeout, delta);
		DirectAccess.timeout = Display.GetEpochTime() + (delta / 1000.0);
		Main.log("DirectAccess.timeout: " + DirectAccess.timeout);
	}
	else {
		Main.log("DirectAccess.timeout: handleEnter");
		DirectAccess.handleEnter();
	};
};

DirectAccess.extendTimer = function () {
	DirectAccess.timeout = Display.GetEpochTime() + (DirectAccess.delay / 1000.0);
	Main.log("DirectAccess.extendTimer: " + DirectAccess.timeout);
};

DirectAccess.cancel = function () {
	DirectAccess.hide();
};

DirectAccess.handleEnter = function () {	
//	Main.log("DirectAccess.handleEnter val= " +$("#directAccessAnchor").val() );
//	DirectAccess.selectNewChannel($("#directAccessAnchor").val());
	Main.log("DirectAccess.handleEnter val= " +$("#directAccessText").text() );
	DirectAccess.selectNewChannel($("#directAccessText").text());
	DirectAccess.hide();

	// find entry according to number
};

DirectAccess.createStyleSheet = function () {
	var sheet = $("<style>");
	sheet.attr({type : 'text/css',
		innerHTML : '\
		#directChanAccess { left: 87%; top: 10px; width:8%; height: 10%; position: absolute; \
					text-align:center; \
		            background:rgba(0,0,139, 0.8);\
					border-width:1px;border-style:solid;border-width:1px;border-radius:15px;\
			       -webkit-box-shadow:3px 3px 7px 4px rgba(0,0,0, 0.5);z-index:15;}\
		#directAccessAnchor {background-color:transparent;text-align: right;font-size:20px}\
		#directAccessText {background-color:transparent;text-align: right;font-size:20px}\
		'});

	$('body').append(sheet);
};

DirectAccess.onInput = function () {
    var keyCode = event.keyCode;
	var input ="";
//	if (input.length == 4) {
//	Main.log("DirectAccess.onInput: len= " + $("#directAccessText").text().length );

	if ($("#directAccessText").text().length == 4) {
//		input= $("#directAccessAnchor").val().slice(1);
		input= $("#directAccessText").text().slice(1);
	}
	else {
//		input= $("#directAccessAnchor").val();
		input= $("#directAccessText").text();
	}
//		$("#directAccessAnchor").val(input.slice(1));
//	Main.log("DirectAccess.onInput: " + keyCode + " Val= " + $("#directAccessAnchor").val());
//	Main.log("DirectAccess.onInput: " + keyCode + " Val= " + $("#directAccessText").text() + " input.length= " + input.length);
	DirectAccess.extendTimer();
    switch(keyCode) {
        case tvKey.KEY_0:
//			$("#directAccessAnchor").val(input + "0");
			$("#directAccessText").text(input + "0");
			break;
        case tvKey.KEY_1:
//			$("#directAccessAnchor").val(input + "1");
			$("#directAccessText").text(input + "1");
			break;
        case tvKey.KEY_2:
//			$("#directAccessAnchor").val(input + "2");
			$("#directAccessText").text(input + "2");
			break;
        case tvKey.KEY_3:
//			$("#directAccessAnchor").val(input + "3");
			$("#directAccessText").text(input + "3");
			break;
        case tvKey.KEY_4:
//			$("#directAccessAnchor").val(input + "4");
			$("#directAccessText").text(input + "4");
			widgetAPI.blockNavigation(event);
			break;
        case tvKey.KEY_5:
//			$("#directAccessAnchor").val(input + "5");
			$("#directAccessText").text(input + "5");
			break;
        case tvKey.KEY_6:
//			$("#directAccessAnchor").val(input + "6");
			$("#directAccessText").text(input + "6");
			break;
        case tvKey.KEY_7:
//			$("#directAccessAnchor").val(input + "7");
			$("#directAccessText").text(input + "7");
			break;
        case tvKey.KEY_8:
//			$("#directAccessAnchor").val(input + "8");
			$("#directAccessText").text(input + "8");
			break;
        case tvKey.KEY_9:
//			$("#directAccessAnchor").val(input + "9");
			$("#directAccessText").text(input + "9");
			break;
        case tvKey.KEY_ENTER:
			//Search channel
			DirectAccess.handleEnter ();
			widgetAPI.blockNavigation(event);
		break;
		case tvKey.KEY_RETURN:
		case tvKey.KEY_EXIT:
			DirectAccess.hide();
			if (this.returnCallback  != null)
				this.returnCallback(); 	    	
			break;
	};
	Main.log("DirectAccess.onInput: input= " + $("#directAccessText").text());
	widgetAPI.blockNavigation(event);
};