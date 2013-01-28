var Display =
{
	pluginTime : null,
    statusDiv : null,
    statusPopup : null,
    bufferingElm : null,
    FIRSTIDX : 0,
    LASTIDX : 15,
    itemHeight : 0,
    currentWindow : 0,

    olTitle : "",
    olStartStop: "",
    SELECTOR : 0,
    LIST : 1,
    
//    folderPath : new Array(),
    volOlHandler : null,
    progOlHandler : null,
    popupOlHandler : null,
    videoList : new Array()
};

/*
 * General Functions
 * 
 */

Display.init = function()
{
    var success = true;

    // Samsung specific object
    this.pluginTime = document.getElementById("pluginTime");

    this.statusDiv = document.getElementById("status");
    this.statusPopup = document.getElementById("statusPopup");
    
    this.bufferingElm = document.getElementById("bufferingBar");
    
//    Main.log("Display.init now=" + this.pluginTime.GetEpochTime());

    this.progOlHandler = new OverlayHandler("ProgHndl");
    this.volOlHandler = new OverlayHandler("VolHndl");
    this.popupOlHandler = new OverlayHandler("PopupHndl");
    this.progOlHandler.init(Display.handlerShowProgress, Display.handlerHideProgress);
    this.volOlHandler.init(Display.handlerShowVolume, Display.handlerHideVolume);
    this.popupOlHandler.init(Display.handlerShowPopup, Display.handlerHidePopup);
    
    if (!this.statusDiv)
    {
        success = false;
    }

    for (var i = 0; i <= this.LASTIDX; i++) {
    	var elm = $("#video"+i);
    	$(elm).css({"width" : "100%", "text-align": "left", "padding-top": "4px", "padding-bottom": "5px" });
    	$(elm).append($("<div>").css({ "display": "inline-block", "width":"20%", 
			"overflow": "hidden", "text-overflow":"ellipsis", "height": "14px"})); 
    	$(elm).append($("<div>").css({ "display": "inline-block", "width":"70%", 
			"overflow": "hidden", "text-overflow":"ellipsis", "white-space": "nowrap", "height": "14px"})); 
    	$(elm).append($("<div>").css({ "display": "inline-block", "width":"5%", 
			 "height": "14px"})); 
    }  
	

/*    for (var i = 0; i <= this.LASTIDX; i++) {
    	var elm = $("#video"+i);
    	$(elm).css({"width" : "100%", "text-align": "left" });
    	$(elm).append($("<div>").css({ "display": "inline-block", "padding-top": "4px", "padding-bottom": "6px", "width":"20%", 
			"overflow": "hidden", "text-overflow":"ellipsis"})); 
    	$(elm).append($("<div>").css({ "display": "inline-block", "padding-top": "4px", "padding-bottom": "6px", "width":"70%", 
			"overflow": "hidden", "text-overflow":"ellipsis"})); 
    	$(elm).append($("<div>").css({ "display": "inline-block", "padding-top": "4px", "padding-bottom": "6px", "width":"5%"
			})); 
    }  
*/
   
    var done = false;
    var i = 0;

    while (done != true) {
    	i ++;
    	var elm = document.getElementById("selectItem"+i);
    	if (elm == null) {
    		done = true;
    		Main.log( " only found to selectItem"+ (i-1));
    		break;
    	}
    	elm.style.paddingBottom = "3px";
    	elm.style.marginTop= " 5px";
    	elm.style.marginBottom= " 5px";
    	elm.style.textAlign = "center";
    }    
    
    Main.log("Display initialized" );
    return success;
};


Display.putInnerHTML = function (elm, val) {
//	alert(Config.deviceType + " " +elm + " " + val);
	switch (Config.deviceType) {
	case 0:
		// Samsung specific handling of innerHtml
		widgetAPI.putInnerHTML(elm, val);
		break;
	default:
		elm.innerHTML = val;
		break;
	}
	
};

Display.GetEpochTime = function() {
	var res = 0;
	switch (Config.deviceType) {
	case 0:
		// Samsung specific UTC time function
		res = Display.pluginTime.GetEpochTime();
		break;
	default:
		var now_millis = ((new Date).getTime());
		res =   (now_millis /1000.0);
	break;
	}

	return res;
};

Display.durationString = function(time) {
    var timeHour = 0; 
    var timeMinute = 0; 
    var timeSecond = 0;
    var res = "";

    timeHour = Math.floor(time/3600);
    timeMinute = Math.floor((time%3600)/60);
    timeSecond = Math.floor(time%60);

	res = "0:";
    if (timeHour != 0)
    	res = timeHour + ":";

    if(timeMinute == 0)
    	res += "00:";
    else if(timeMinute <10)
    	res += "0" + timeMinute + ":";
    else
    	res += timeMinute + ":";
        
    if(timeSecond == 0)
    	res += "00";
    else if(timeSecond <10)
    	res += "0" + timeSecond;
    else
    	res += timeSecond;       

    return res;
};


Display.getNumString =function(num, fmt) {
	var res = "";

	if (num < 10) {
		for (var i = 1; i < fmt; i ++) {
			res += "0";		
		};
	} else if (num < 100) {
		for (var i = 2; i < fmt; i ++) {
			res += "0";		
		};	
	}

	res = res + num;
	
	return res;
};

Display.selectItem = function (item) {

	item.style.color = "black";
	item.style.background = "white";
	item.style.background = "-webkit-linear-gradient(top, rgba(246,248,249,1) 0%,rgba(229,235,238,1) 50%,rgba(215,222,227,1) 51%,rgba(245,247,249,1) 100%)";
	item.style.borderRadius= "3px";
	item.style["-webkit-box-shadow"] = "2px 2px 1px 2px rgba(0,0,0, 0.5)";
	//	item.style.backgroundColor = "white";

};

Display.unselectItem = function (item) {
	item.style.color = "white";
	item.style.backgroundColor = "transparent";
	item.style.background = "transparent";
	item.style["-webkit-box-shadow"] = "";
};

Display.jqSelectItem = function (item) {
	//item is a JQ Object
	item.css( {"color": "black", "background" : "white", 
		"background" : "-webkit-linear-gradient(top, rgba(246,248,249,1) 0%,rgba(229,235,238,1) 50%,rgba(215,222,227,1) 51%,rgba(245,247,249,1) 100%)",
		"border-radius": "3px",
		"-webkit-box-shadow": "2px 2px 1px 2px rgba(0,0,0, 0.5)"
		});
};

Display.jqUnselectItem = function (item) {
	item.css ({"color" : "white", "background" : "transparent", "-webkit-box-shadow": ""});
};

/*
 * Main Select Screen Functions
 * 
 */
Display.resetSelectItems = function (itm) {
	var done = false;
	var i = 0;
	while (done != true) {
		i ++;
		var elm = document.getElementById("selectItem"+i);
		if (elm == null) {
			done = true;
			Main.log( " only found to selectItem"+ (i-1));
			break;
	    }
		Display.unselectItem(elm);	
	}    
    Display.selectItem(document.getElementById("selectItem"+itm));
};

/*
 * Video Select Screen Functions
 * 
 */
Display.hide = function() {
//    document.getElementById("main").style.display="none";
    $("#main").hide();
};

Display.show = function() {
	// cancel ongoing overlays first
	this.volOlHandler.cancel();
	this.progOlHandler.cancel();
	this.popupOlHandler.cancel();
//    document.getElementById("main").style.display="block";
    $("#main").show();

    this.itemHeight = Math.round(parseInt($("#videoList").height()) / (this.LASTIDX +1) );    
};

Display.tuneLeftSide = function() {
	var res = {};
	res.w1 = "20%";
	res.w2 = "70%";
	res.w3 = "5%";
	switch (Main.state) {
		case Main.eLIVE:
		case Main.eMED:
			res.w1 = "5%";
			res.w2 = "85%";
			res.w3 = "5%";
		break;
		case Main.eREC:
			res.w1 = "20%";
			res.w2 = "70%";
			res.w3 = "5%";
		break;
		default:
			Main.logToServer("ERROR in Display.tuneLeftSide. Should not be here");
		break;
	}
	Main.log("Display.tuneLeftSide: w1= " + res.w1 +" w2= " + res.w2 + " w3= " + res.w3  );
	return res;
};


Display.setVideoList = function(selected, first) {
	// 
    var listHTML = "";
    var res = {};
//    var first_item = selected;

    var first_item = first; //thlo	
//	var first_item = selected - ( selected % (Display.LASTIDX +1))

	tab_style = Display.tuneLeftSide();
    var i=0;
    Main.log("Display.setVideoList title= " +Data.getCurrentItem().childs[selected].title + " selected= " + selected + " first_item= " + first_item);
    this.handleDescription(selected);

    for (i = 0; i <= this.LASTIDX; i++) {
    	if ((first_item+i) >= Data.getVideoCount()) {
    		res = {c1: "", c2: "", c3: ""};
    	}
    	else {
            res = Display.getDisplayTitle (Data.getCurrentItem().childs[first_item+i]); 
    	}
        this.videoList[i] = document.getElementById("video"+i);
		Display.setVideoItem(this.videoList[i], res, tab_style);
		
        this.unselectItem(this.videoList[i]);
    }
    
    this.currentWindow = (selected - first_item);
    this.selectItem(this.videoList[this.currentWindow]);
    
    listHTML = (selected +1) + " / " + Data.getVideoCount();
	$("#videoCount").text(listHTML);
//    Display.putInnerHTML(document.getElementById("videoCount"), listHTML);
};

Display.setVideoItem = function (elm, cnt, style) {
	// cnt
	$(elm).children("div").eq(0).text (cnt.c1);
	$(elm).children("div").eq(1).text (cnt.c2);
	$(elm).children("div").eq(2).text (cnt.c3);
	
	if (typeof(style) != "undefined") {
//		Main.log ("Display.setVideoItem: change style w1= " + style.w1 + " w2= " + style.w2 + " w3= " + style.w3);
		$(elm).children("div").eq(0).css("width", style.w1 );
		$(elm).children("div").eq(1).css("width", style.w2 );
		$(elm).children("div").eq(2).css("width", style.w3 );
	}
	/*
	var itm = $(elm).children("div").eq(1);
	if (itm.outerHeight() > this.itemHeight) {
		var temp = cnt.c2;
		while(itm.outerHeight() > this.itemHeight) {
		    temp = temp.substr(0, temp.length-1);
		    itm.text(temp + '...');
		}	
	}
	*/
};

//Video Select Screen
Display.resetVideoList = function () {
	var done = false;
	var i = 0;
	while (done != true) {
		var elm = document.getElementById("video"+i);
		if (elm == null) {
			done = true;
			break;
	    }
		Display.unselectItem(elm);	
		Display.setVideoItem(elm, {c1: "", c2: "", c3: ""}, {w1: "20%", w2:"70%", w3:"5%"});
		i ++;
	}    
	
};

//Video Select Screen
Display.handleDescription =function (selected) {
	Main.log("Display.handleDescription ");
	
	if (Data.getCurrentItem().childs[selected].isFolder == true) {
        Display.setDescription( "Dir: " +Data.getCurrentItem().childs[selected].title );
    }
    else {
    	var itm = Data.getCurrentItem().childs[selected];
    	var title = itm.title;
    	var prog = itm.payload.prog;
    	var desc = itm.payload.desc;
    	var length = itm.payload.dur;
    	
    	var digi = new Date(parseInt(itm.payload.start*1000));
    	var mon = Display.getNumString ((digi.getMonth()+1), 2);
    	var day = Display.getNumString (digi.getDate(), 2);
    	var hour = Display.getNumString (digi.getHours(), 2);
    	var min = Display.getNumString (digi.getMinutes(), 2);

    	var d_str ="";
    	var msg = "";
		switch (Main.state) {
		case Main.eLIVE:
    		var now = Display.GetEpochTime();

        	d_str = hour + ":" + min;

        	msg += title + "<br>";
        	msg += "<b>"+ prog + "</b><br>";
        	msg += "<br>Start: " + d_str + "<br>";
        	msg += "Duration: " + Display.durationString(length) + "h<br>";
//        	Main.log("itm.payload.start= " + itm.payload.start + " length= " + length + " now= " +now);
        	msg += "Remaining: " + Display.durationString((itm.payload.start + length - now));
			msg += "<br><br>"+ desc;
		break;
		case Main.eREC:
        	d_str = mon + "/" + day + " " + hour + ":" + min;

        	msg += "<b>" + title + "</b>";
        	msg += "<br><br>" + d_str;
        	msg += " Duration: " + Display.durationString(length) + "h";
			msg += "<br><br>"+ desc;
		break;
		case Main.eMED:
        	msg += "<b>" + title + "</b>";
		break;
		default:
			Main.logToServer("ERROR in Display.handleDescription: Should not be here");
		break;
		}

        Display.setDescription(msg);   	
    }
	
};



/*
 * this.currentWindow: Cursor (selected item)
 */
Display.setVideoListPosition = function(position, move)
{    
    var listHTML = "";
//    var res = {}; //thlo: unused?
    Main.log ("Display.setVideoListPosition title= " +Data.getCurrentItem().childs[position].title + " move= " +move);

    this.handleDescription(position);
    
//    listHTML = (position + 1) + " / " + Data.getVideoCount();
//    Display.putInnerHTML(document.getElementById("videoCount"), listHTML);
	$("#videoCount").text((position + 1) + " / " + Data.getVideoCount());
    
    if(Data.getVideoCount() < this.LASTIDX) {
        for (var i = 0; i < Data.getVideoCount(); i++)
        {
            if(i == position)
            	this.selectItem(this.videoList[i]);
            else
            	this.unselectItem(this.videoList[i]);

        }
    }
    else if((this.currentWindow!=this.LASTIDX && move==Main.DOWN) || (this.currentWindow!=this.FIRSTIDX && move==Main.UP))
    {
    	// Just move cursor
        if(move == Main.DOWN)
            this.currentWindow ++;
        else
            this.currentWindow --;
            
        for (var i = 0; i <= this.LASTIDX; i++) {
            if(i == this.currentWindow)
            	this.selectItem(this.videoList[i]);            
            else
            	this.unselectItem(this.videoList[i]);
        }
    }
    else if(this.currentWindow == this.LASTIDX && move == Main.DOWN) {
    	// Next Page
        if(position == this.FIRSTIDX) {
        	// very top element selected
        	this.currentWindow = this.FIRSTIDX;
            
            for(i = 0; i <= this.LASTIDX; i++) {
        		Display.setVideoItem(this.videoList[i], Display.getDisplayTitle (Data.getCurrentItem().childs[i]));
                
                if(i == this.currentWindow)
                	this.selectItem(this.videoList[i]);
                else
                	this.unselectItem(this.videoList[i]);
                }
        }
        else {            
            for(i = 0; i <= this.LASTIDX; i++) {
        		Display.setVideoItem(this.videoList[i], Display.getDisplayTitle (Data.getCurrentItem().childs[i + position - this.currentWindow]));
            }
        }
    }
    else if(this.currentWindow == this.FIRSTIDX && move == Main.UP)  {
    	// Previous Page
        if(position == Data.getVideoCount()-1) {
        	// very bottom element selected
        	this.currentWindow = this.LASTIDX;
            
            for(i = 0; i <= this.LASTIDX; i++) {
        		Display.setVideoItem(this.videoList[i], Display.getDisplayTitle (Data.getCurrentItem().childs[i + position - this.currentWindow]));
                if(i == this.currentWindow)
                	this.selectItem(this.videoList[i]);
                else
                	this.unselectItem(this.videoList[i]);
            }
        }
        else {            
            for(i = 0; i <= this.LASTIDX; i++) {
        		Display.setVideoItem(this.videoList[i], Display.getDisplayTitle (Data.getCurrentItem().childs[i + position]));
            }
        }
    }
};

Display.setDescription = function(description) {
    var descriptionElement = document.getElementById("description");
    
    Display.putInnerHTML(descriptionElement, description);
};

Display.getDisplayTitle = function(item) {
	var res = {c1:"", c2:"", c3:""};
	switch (Main.state) {
	case Main.eLIVE:
		// Live
		if (item.isFolder == true) {
			res.c2 = item.title;
			res.c3 = "<" + Display.getNumString(item.childs.length, 2) +">"; 			
		}
		else {
			res.c2 = item.title;
		}
		break;
	case Main.eREC:
		// Recordings
		if (item.isFolder == true) {
			res.c1 = "<" + Display.getNumString(item.childs.length, 3) + ">";
			res.c2 = item.title; 			
		}
		else {
			var digi = new Date(parseInt(item.payload.start*1000));
			var mon = Display.getNumString ((digi.getMonth()+1), 2);
			var day = Display.getNumString (digi.getDate(), 2);
			var hour = Display.getNumString (digi.getHours(), 2);
			var min = Display.getNumString (digi.getMinutes(), 2);

			var d_str = mon + "/" + day + " " + hour + ":" + min;
			res.c1 = d_str;
			res.c2 = item.title; 
		}
		break;
	case Main.eMED:
		if (item.isFolder == true) {
			res.c3 = "<" + Display.getNumString(item.childs.length, 3) + ">";
			res.c2 = item.title; 						
		}
		else {
			res.c2 = item.title; 
		}
		break;
	default:
		Main.logToServer("ERROR in Display.getDisplayTitle: Shall be in state 1, 2 or 3. State= " + Main.state);
		break;
	}
	return res;
};



/*
 * Overlay Functions
 * 
 */
/*
 * Progress Overlay
 * 
 */

Display.showOlStartStop = function () {
	$("#olTitle").css("width", "50%");
	$("#olStartStop").show();
};

Display.hideOlStartStop = function () {
	$("#olStartStop").hide();
	$("#olTitle").css("width", "75%");
};
 
Display.updateOlForLive = function (start_time, duration, now) {
	
	Display.setOlTitle(Data.getCurrentItem().childs[Main.selectedVideo].title + " - " +Data.getCurrentItem().childs[Main.selectedVideo].payload.prog);
	Display.setStartStop (start_time, (start_time + duration));
	Player.totalTime = Data.getCurrentItem().childs[Main.selectedVideo].payload.dur * 1000;
	Player.totalTimeStr =Display.durationString(Player.totalTime / 1000.0);

//		Display.updateTotalTime(Player.totalTime);
	var digi = new Date((Data.getCurrentItem().childs[Main.selectedVideo].payload.start*1000));
	Main.log (" Date(): StartTime= " + digi.getHours() + ":" + digi.getMinutes() + ":" + digi.getSeconds());
//		Player.cptOffset = (now - Data.getCurrentItem().childs[Main.selectedVideo].payload.start) * 1000;
	Player.setCurrentPlayTimeOffset((now - Data.getCurrentItem().childs[Main.selectedVideo].payload.start) * 1000);
	Player.OnCurrentPlayTime(0);   // updates the HTML elements of the Progressbar 
}; 
 
Display.setOlTitle = function (title) {
	this.olTitle = title;
	$("#olTitle").text(this.olTitle);
//	Main.log("Display.setOlTitle: font-size=" + $("#olTitle").css("font-size"));
//	Main.log("Display.setOlTitle: height=" + $("#olTitle").css("height"));
//	Main.log("Display.setOlTitle: outerHeight=" + $("#olTitle").outerHeight());
	
//	var elm = document.getElementById("olTitle");
//	Display.putInnerHTML(elm, Display.olTitle);    
};

Display.resetStartStop = function () {
	Display.olStartStop = "";
	Display.hideOlStartStop();
	$("#olStartStop").text("");
/*    var elm = document.getElementById("olStartStop");
    Display.putInnerHTML(elm, Display.olStartStop);    
*/	
};
Display.setStartStop = function(start, stop) {
	this.olStartStop = "";
	Display.showOlStartStop();
	
	var digi =new Date(start * 1000);
    var hours=digi.getHours();
    var minutes=digi.getMinutes();
    if (minutes<=9)
    	   minutes='0'+minutes;
    this.olStartStop = hours + ":" + minutes + " - ";

	digi =new Date(stop * 1000);
    hours=digi.getHours();
    minutes=digi.getMinutes();
    if (minutes<=9)
    	   minutes='0'+minutes;
    this.olStartStop = this.olStartStop + hours + ":" + minutes;    
	
	$("#olStartStop").text(Display.olStartStop);
  
/*	var elm = document.getElementById("olStartStop");
    Display.putInnerHTML(elm, Display.olStartStop);    
	*/
};

Display.setSkipDuration = function(duration) {
	this.olStartStop = "";
	Display.showOlStartStop();

	this.olStartStop = duration;    

	$("#olStartStop").text("Next Skip: " + Display.olStartStop+"sec");

/*    var elm = document.getElementById("olStartStop");
    Display.putInnerHTML(elm, "Next Skip: " + Display.olStartStop+"sec");    
	*/
};

// Player.OnCurrentPlayTime
Display.updatePlayTime = function() {
//    Player.curPlayTimeStr =  Display.getHumanTimeRepresentation(Player.curPlayTime);
    var timeElement = document.getElementById("olTimeInfo");
    Display.putInnerHTML(timeElement,  Player.curPlayTimeStr + " / " + Player.totalTimeStr);    
};

Display.updateProgressBar = function () {
	var timePercent = (Player.curPlayTime *100)/ Player.totalTime;
    document.getElementById("olProgressBar").style.width = Math.round(timePercent) + "%";	
};

Display.updateRecBar = function (start_time, duration){
	var now = Display.GetEpochTime();

	var remaining = Math.round(((start_time + duration) - now) * 100/ duration);
//    Main.log (" remaining= " + remaining + " start= " + start_time + " dur= " + duration);
	var elm = document.getElementById("olRecProgressBar");
    elm.style.display="block";
    elm.style.width = remaining + "%";
    elm.style.left = (100 - remaining) + "%";
};



Display.status = function(status) {
    Main.log("Display.status: " +status);
    Display.putInnerHTML(this.statusDiv, status);
    Display.putInnerHTML(this.statusPopup, status);
};

Display.showStatus = function() {
	this.statusPopup.style.display="block";
};

Display.hideStatus = function() {
	this.statusPopup.style.display="none";
};


Display.progress = function(status) {
	Display.putInnerHTML(this.statusDiv, status);
};




//--------------------------------------------------------
Display.bufferUpdate = function() {
	// Player.bufferState 
	// find buffering element and show status
	this.bufferingElm.style.width= Player.bufferState+ "%";
};

//--------------------------------------------------------
/*
 * Volume Control Handlers (obsolete)
 */
//---------------------------------------------------------
Display.setVolume = function(level)
{
    document.getElementById("volumeBar").style.width = level + "%";
    
    var volumeElement = document.getElementById("volumeInfo");

    Display.putInnerHTML(volumeElement, "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + Audio.getVolume());
};

// Called by main
Display.showVolume = function() {
	this.volOlHandler.show();
};

//called by handle
Display.handlerShowVolume = function() {
    document.getElementById("volume").style.display="block";
};


//Called by handler
Display.handlerHideVolume = function() {
    document.getElementById("volume").style.display="none";
};


//---------------------------------------------------------
/*
 * Popup handlers
 */
Display.showPopup = function(text) {
	var oldHTML = document.getElementById("popup").innerHTML;
	Display.putInnerHTML(document.getElementById("popup"), oldHTML + "<br>" + text);
	this.popupOlHandler.show();
};

Display.handlerShowPopup = function() {
    document.getElementById("popup").style.display="block";
	
};

Display.handlerHidePopup = function() {
    document.getElementById("popup").style.display="none";
    Display.putInnerHTML(document.getElementById("popup"), "");
};

/* ---------------------------------------------------------
 * Progress Bar Handlers
 * ---------------------------------------------------------
 */

Display.isProgressOlShown = function () {
	return this.progOlHandler.active;
};

Display.showProgress = function() {
	this.progOlHandler.show();
};

Display.handlerHideProgress = function() {
    document.getElementById("overlay").style.display="none";
};

Display.handlerShowProgress = function() {

	document.getElementById("overlay").style.display="block";
	if (Player.isRecording == true) {
	    document.getElementById("olRecProgressBar").style.display="block";
	    var now = Display.GetEpochTime();
	    var remaining = Math.round(((Player.startTime + Player.duration) - now) * 100/ Player.duration);
	    Main.log (" remaining= " + remaining);
    	var elm = document.getElementById("olRecProgressBar");
	    elm.style.display="block";
	    elm.style.width = remaining + "%";
	    elm.style.left = (100 - remaining) + "%";
	}
	else
	    document.getElementById("olRecProgressBar").style.display="none";
    
    var timePercent = (Player.curPlayTime *100)/ Player.totalTime;
    
	Main.log("show OL Progress timePercent= " + timePercent);

    document.getElementById("olProgressBar").style.width = timePercent + "%";

	$("#olTimeInfo").text(Player.curPlayTimeStr + " / " + Player.totalTimeStr);
//    var timeElement = document.getElementById("olTimeInfo");
//    Display.putInnerHTML(timeElement,  Player.curPlayTimeStr + " / " + Player.totalTimeStr);    

    var Digital=new Date();
    var hours=Digital.getHours();
    var minutes=Digital.getMinutes();
    if (minutes<=9)
    	   minutes='0'+minutes;
	$("#olNow").text(hours + ':' + minutes);
//	var nowElement = document.getElementById("olNow");
//    Display.putInnerHTML(nowElement, hours + ':' + minutes);    
};


var ClockHandler = {
	timeoutObj : null,
	isActive : false,
	elm : ""
};

ClockHandler.start = function(elm){
	if (this.isActive ==true)
		window.clearTimeout(this.timeoutObj);
		
	this.isActive = true;
	this.elm = elm;
	ClockHandler.update();
};

ClockHandler.update = function() {
	var date = new Date();
    var hours= date.getHours();
    var minutes= date.getMinutes();
    if (minutes<=9)
    	   minutes='0'+minutes;
	$(this.elm).text(hours + ':' + minutes);

	this.timeoutObj = window.setTimeout(function() {ClockHandler.update(); }, (10*1000));
};

ClockHandler.stop = function(){
	if (this.isActive == false )
		return;

	window.clearTimeout(this.timeoutObj);
	this.isActive = false;
};

/*
 * OverlayHandler Class
 * 
 */
function OverlayHandler (n) {
//	this.pluginTime = null;
	this.active = false;
	this.startTime = 0;
	this.hideTime = 0;
	this.olDelay = 3000; // in millis
	this.timeoutObj = null;
	
	this.handlerName = n; // readable name for debugging
	this.showCallback = null; // callback, which shows the element
	this.hideCallback = null; // callback, which hides the element
};

OverlayHandler.prototype.init = function(showcb, hidecb) {
	var success = true;
	this.showCallback = showcb;
	this.hideCallback = hidecb;
/*	this.pluginTime = document.getElementById("pluginTime");
	if (!this.pluginTime) {
        Main.log(this.handlerName + " cannot aquire time plugin :  " + success);    
        success = false;
	}
*/
	//	Main.log(this.handlerName + " is initialized");	
	return success;
};

OverlayHandler.prototype.checkHideCallback = function () {
	var now = Display.GetEpochTime();
	if (now >= this.hideTime) {

		this.olDelay = 3000;
		if (this.hideCallback) {
			this.hideCallback();			
		}
		else
			Main.log(this.handlerName + ": No hideCallback defined - ignoring " );
		
		this.active = false;
		return;
	}
	var delay = (this.hideTime - now) * 1000;

	// pass an anonymous function to keep the context
	var self = this;
	this.timeoutObj = window.setTimeout(function() {self.checkHideCallback(); }, delay);
};

OverlayHandler.prototype.show = function() {
	if (!this.active ) {
//		this.startTime = this.pluginTime.GetEpochTime();
		this.startTime = Display.GetEpochTime();
		
		this.hideTime = this.startTime + (this.olDelay / 1000);

//		Main.log(this.handlerName + " showing " + this.handlerName + " from= " + this.startTime + " to at least= " + this.hideTime);
		if (this.showCallback) {
			this.showCallback();
			
			var self = this;
			this.timeoutObj = window.setTimeout(function() {self.checkHideCallback();}, this.olDelay);
			this.active = true;
		}
		else
			Main.log(this.handlerName + ": No showCallback defined - ignoring " );
	}
	else {
		this.hideTime = Display.GetEpochTime() + (this.olDelay /1000);
	}
};


OverlayHandler.prototype.cancel = function () {
	if (!this.active)
		return;
	
//	Main.log("cancel for handler " + this.handlerName);
	if (this.hideCallback) {
		this.hideCallback();			
	}
	else
		Main.log(this.handlerName + ": No hideCallback defined - ignoring " );
	
	this.active = false;
	window.clearTimeout(this.timeoutObj);
};