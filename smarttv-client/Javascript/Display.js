var Display =
{
	pluginTime : null,
    statusDiv : null,
    statusPopup : null,
    bufferingElm : null,
    FIRSTIDX : 0,
    LASTIDX : 15,
    currentWindow : 0,   // always from 0 ...

    olTitle : "",
    olStartStop: "",
    SELECTOR : 0,
    LIST : 1,
    
    volOlHandler : null,
    progOlHandler : null,
    popupOlHandler : null,
    infoOlHandler : null,
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
    

    this.progOlHandler = new OverlayHandler("ProgHndl");
    this.volOlHandler = new OverlayHandler("VolHndl");
    this.popupOlHandler = new OverlayHandler("PopupHndl");
    this.infoOlHandler = new OverlayHandler("InfoHndl");
    this.progOlHandler.init(Display.handlerShowProgress, Display.handlerHideProgress);
    this.volOlHandler.init(Display.handlerShowVolume, Display.handlerHideVolume);
    this.popupOlHandler.init(Display.handlerShowPopup, Display.handlerHidePopup);
    this.infoOlHandler.init(Display.handlerShowInfo, Display.handlerHideInfo);
    this.infoOlHandler.olDelay = Config.infoTimeout;

    // Different popup behavior during config phase;
    this.popupOlHandler.olDelay = 30*1000;
    $("#popup").css("height", "300px");
    // end
    
    if (!this.statusDiv) {
        success = false;
    }

    for (var i = this.FIRSTIDX; i <= this.LASTIDX; i++) {
    	var elm = $("#video"+i);
    	$(elm).css({"width" : "100%", "text-align": "left", "padding-top": "4px", "padding-bottom": "5px" });
    	$(elm).append($("<div>").css({ "display": "inline-block", "width":"20%", 
			"overflow": "hidden", "text-overflow":"ellipsis", "height": "14px", "color": "inherit"})); 
    	$(elm).append($("<div>").css({ "display": "inline-block", "width":"70%", 
			"overflow": "hidden", "text-overflow":"ellipsis", "white-space": "nowrap", "height": "14px", "color": "inherit"})); 
    	$(elm).append($("<div>").css({ "display": "inline-block", "width":"5%", 
    		"overflow": "hidden", "text-overflow":"ellipsis", "white-space": "nowrap", "height": "14px", "color": "inherit"})); 
    }  
	
    /*
    var done = false;
    var i = 0;

    while (done != true) {
    	i ++;
    	var elm = document.getElementById("selectItem"+i);
    	if (elm == null) {
    		done = true;
    		break;
    	}
    	elm.style.paddingBottom = "3px";
    	elm.style.marginTop= " 5px";
    	elm.style.marginBottom= " 5px";
    	elm.style.textAlign = "center";
    }    
    */
	Display.resetDescription();   
    Main.log("Display initialized" );
    return success;
};

Display.putInnerHTML = function (elm, val) {
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
//	item.setAttribute("class", "style_menuItemSelected");
	item.style.color = "black";
	item.style.background = "white";
	item.style.background = "-webkit-linear-gradient(top, rgba(246,248,249,1) 0%,rgba(229,235,238,1) 50%,rgba(215,222,227,1) 51%,rgba(245,247,249,1) 100%)";
	item.style.borderRadius= "3px";
	item.style["-webkit-box-shadow"] = "2px 2px 1px 2px rgba(0,0,0, 0.5)";
	
};

Display.unselectItem = function (item) {
	item.style.color = "white";
	item.style.background = "transparent";
	item.style.borderRadius= "0px";
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
			break;
	    }
		Display.unselectItem(elm);	
	}    
    Display.selectItem(document.getElementById("selectItem"+itm));
};

Display.updateWidgetVersion = function (ver) {
	
	$("#widgetVersion").text("  Version "+ ver);
};

/*
 * Video Select Screen Functions
 * 
 */
 
Display.addHeadline = function (name) {
// Add the headline to first element
	Display.setVideoItem(document.getElementById("video0"), {c1: "", c2: name, c3: ""});
	Display.FIRSTIDX= 1;
	
	var item = document.getElementById("video0");
	item.style.color = "black";
//	item.style.background = "linear-gradient(0deg, #1e5799 0%,#2989d8 41%,#7db9e8 100%)";
	item.style.background = "-webkit-linear-gradient(top, #1e5799 0%,#2989d8 41%,#7db9e8 100%)";
	item.style.borderRadius= "3px";
	item.style["-webkit-box-shadow"] = "2px 2px 1px 2px rgba(0,0,0, 0.5)";

};
 
Display.removeHeadline = function () {
	Display.FIRSTIDX= 0;
	
	var item = document.getElementById("video0");
	item.style.color = "white";
	item.style.backgroundColor = "transparent";
	item.style.background = "transparent";
	item.style.borderRadius= "0px";
	item.style["-webkit-box-shadow"] = "";

};
 
Display.hide = function() {
    $("#main").hide();
};

Display.show = function() {
	// cancel ongoing overlays first
	this.volOlHandler.cancel();
	this.progOlHandler.cancel();
	this.popupOlHandler.cancel();
	this.infoOlHandler.cancel();
    $("#main").show();
};

Display.tuneLeftSide = function() {
	var res = {};
	res.w1 = "20%";
	res.w2 = "70%";
	res.w3 = "5%";
	switch (Main.state) {
		case Main.eLIVE:
			res.w1 = "7%";
			res.w2 = "25%";
			res.w3 = "65%";
		break;
		case Main.eREC:
			res.w1 = "20%";
			res.w2 = "70%";
			res.w3 = "5%";
		break;
		case Main.eMED:
			res.w1 = "5%";
			res.w2 = "85%";
			res.w3 = "5%";
		break;
		case Main.eURLS:
			res.w1 = "5%";
			res.w2 = "85%";
			res.w3 = "5%";
		break;
		default:
			Main.logToServer("ERROR in Display.tuneLeftSide. Should not be here");
		break;
	}
	return res;
};

Display.getNumberOfVideoListItems = function () {
	return (Display.LASTIDX + 1 - Display.FIRSTIDX);
};


Display.setVideoList = function(selected, first) {
    var listHTML = "";
    var res = {};

    var first_item = first; //thlo	

	tab_style = Display.tuneLeftSide();
    var i=0;
	var max_idx = (Data.getVideoCount() < Display.getNumberOfVideoListItems()) ? Data.getVideoCount() :(Display.getNumberOfVideoListItems()) ;
    this.handleDescription(selected);

	
    var idx = 0;
    for (i = 0; i < max_idx; i++) {
    	if ((first_item+i) <0) {
			// wrap around
    		idx = (first_item+i) + Data.getVideoCount();
    		
            res = Display.getDisplayTitle (Data.getCurrentItem().childs[(first_item+i) + Data.getVideoCount()]); 
    	}
    	else if ((first_item+i) >= Data.getVideoCount()) {
			idx = (first_item+i) - Data.getVideoCount();
            res = Display.getDisplayTitle (Data.getCurrentItem().childs[(first_item+i) - Data.getVideoCount()]); 
		}
		else {
			idx = first_item+i; 
            res = Display.getDisplayTitle (Data.getCurrentItem().childs[first_item+i]); 
    	}
        this.videoList[i + this.FIRSTIDX] = document.getElementById("video"+(i+ this.FIRSTIDX));
		Display.setVideoItem(this.videoList[(i+ this.FIRSTIDX)], res, (idx == 0)? true : false, tab_style);
        this.unselectItem(this.videoList[(i+ this.FIRSTIDX)]);
    }

    if (max_idx < Display.getNumberOfVideoListItems()) {
    	for (i = max_idx; i < Display.getNumberOfVideoListItems(); i++) {
            this.videoList[(i+ this.FIRSTIDX)] = document.getElementById("video"+(i+ this.FIRSTIDX));
    		Display.setVideoItem(this.videoList[(i+ this.FIRSTIDX)], {c1: "", c2: "", c3: ""}, false, tab_style);
			this.unselectItem(this.videoList[i+ this.FIRSTIDX]);
    	}
    }
    
    this.currentWindow = (selected - first_item);
    this.selectItem(this.videoList[(this.currentWindow+ this.FIRSTIDX)]);
    
    listHTML = (selected +1) + " / " + Data.getVideoCount();
	$("#videoCount").text(listHTML);
};

Display.setVideoItem = function (elm, cnt, top, style) {
	// cnt
	$(elm).children("div").eq(0).text (cnt.c1);
	$(elm).children("div").eq(1).text (cnt.c2);
	$(elm).children("div").eq(2).text (cnt.c3);

		
	if (typeof(style) != "undefined") {
		$(elm).children("div").eq(0).css("width", style.w1 );
		$(elm).children("div").eq(1).css("width", style.w2 );
		$(elm).children("div").eq(2).css("width", style.w3 );
	}
	if (typeof(top) != "undefined")
		if (top == true) {
			$(elm).css("border-top-style", "solid");
			$(elm).css("border-top-width", "1px");
		}
	else
		$(elm).css("border-top-width", "0px");
};

//Video Select Screen
Display.resetVideoList = function () {
	var done = false;
	var i = 0;

	Display.removeHeadline();

	while (done != true) {
		var elm = document.getElementById("video"+i);
		if (elm == null) {
			done = true;
			break;
	    }
		Display.unselectItem(elm);	
		Display.setVideoItem(elm, {c1: "", c2: "", c3: ""}, false, {w1: "20%", w2:"70%", w3:"5%"});
		i ++;
	}    
	
};

/*Display.resetDescription = function () {
	$("#description").text(""); // reset 

};
*/

//Video Select Screen
Display.handleDescription =function (selected) {
	Main.log("Display.handleDescription selected= " + selected);
	
	if (Data.getCurrentItem().childs[selected].isFolder == true) {
		$("#descTitle").text("Dir: " +Data.getCurrentItem().childs[selected].title);
//        Display.setDescription( "Dir: " +Data.getCurrentItem().childs[selected].title );
		$("#descProg").text("");			
		$("#descStart").text("");			
		$("#descDuration").text("");
		$("#descRemaining").text("");
		$("#descDesc").text("");
		$("#descImg").hide();
    }
    else {
    	var itm = Data.getCurrentItem().childs[selected];
    	var title = itm.title;
    	var prog = itm.payload.prog;
    	var desc = itm.payload.desc;
    	var length = itm.payload.dur;
    	
    	var digi = new MyDate(parseInt(itm.payload.start*1000));
    	var mon = Display.getNumString ((digi.getMonth()+1), 2);
    	var day = Display.getNumString (digi.getDate(), 2);
    	var hour = Display.getNumString (digi.getHours(), 2);
    	var min = Display.getNumString (digi.getMinutes(), 2);

    	var d_str ="";
		switch (Main.state) {
		case Main.eLIVE:
    		var now = Display.GetUtcTime();
//    		var now = (new MyDate()).getTimeSec();
    		
        	d_str = hour + ":" + min;

			$("#descProg").show();
			$("#descRemaining").show();

			$("#descTitle").text(title);			
			$("#descProg").text(prog);			
			$("#descStart").text("Start: " + d_str);			
			$("#descDuration").text("Duration: " + Display.durationString(length) + "h");
			$("#descRemaining").text("Remaining: " + Display.durationString((itm.payload.start + length - now)));
			$("#descDesc").text(desc);

			break;
		case Main.eREC:
        	d_str = mon + "/" + day + " " + hour + ":" + min;
			$("#descTitle").text(title);
			$("#descStart").text("Start: " + d_str);			
			$("#descDuration").text("Duration: " + Display.durationString(length) + "h");
			$("#descDesc").html(desc);

			$("#descImg").show();
			$("#descImg")
				.error(function() { $("#descImg").hide();})
				.attr('src', Data.getCurrentItem().childs[selected].payload.link + "/preview_vdr.png?"+Math.random());

			break;
		case Main.eMED:
			$("#descTitle").text(title);
		break;
		case Main.eURLS:
			$("#descTitle").text(title);
			$("#descDuration").text("Duration: " + Display.durationString(length) + "h");
			$("#descDesc").text(desc);
		break;
		default:
			Main.logToServer("ERROR in Display.handleDescription: Should not be here");
		break;
		}

//        Display.setDescription(msg);   	
    }
	
};
Display.resetDescription = function () {
	$("#descTitle").text("");
	$("#descProg").text("");			
	$("#descStart").text("");			
	$("#descDuration").text("");
	$("#descRemaining").text("");
	$("#descDesc").text("");

	$("#descProg").hide();
	$("#descRemaining").hide();
	$("#descImg").hide();
};
/*
 * this.currentWindow: Cursor (selected item)
 */
Display.setVideoListPosition = function(position, move) {   
    this.handleDescription(position);
    
	$("#videoCount").text((position + 1) + " / " + Data.getVideoCount());

    if(Data.getVideoCount() <= Display.getNumberOfVideoListItems()) {
		// videos fit into the video list. No spill overs, so no scrolling.
		this.currentWindow  = position;
		for (var i = 0; i < Data.getVideoCount(); i++) {
            if(i == this.currentWindow)
            	this.selectItem(this.videoList[(i+ this.FIRSTIDX)]);
            else
            	this.unselectItem(this.videoList[(i+ this.FIRSTIDX)]);
        }
		
    }
    else if((this.currentWindow!=(this.LASTIDX -this.FIRSTIDX) && move==Main.DOWN) || (this.currentWindow!=0 && move==Main.UP)) {
    	// Just move cursor, all items used
        if(move == Main.DOWN)
            this.currentWindow ++;
        else
            this.currentWindow --;
        for (var i = 0; i < Display.getNumberOfVideoListItems(); i++) {
            if(i == this.currentWindow)
            	this.selectItem(this.videoList[(i+this.FIRSTIDX)]);            
            else
            	this.unselectItem(this.videoList[(i+this.FIRSTIDX)]);
        }
    }
    else if(this.currentWindow == (this.LASTIDX -this.FIRSTIDX)&& move == Main.DOWN) {
    	// Next Page
		var c_pos = position - this.currentWindow;
		if (c_pos < 0) 
			c_pos += Data.getVideoCount();
			
		for(i = 0; i < Display.getNumberOfVideoListItems(); i++) {
			var idx = (i + c_pos) %Data.getVideoCount();
			Main.log("idx= " + idx);
			Display.setVideoItem(this.videoList[(i+this.FIRSTIDX)], Display.getDisplayTitle (Data.getCurrentItem().childs[idx]), (idx == 0)? true: false);
			}
    }
    else if(this.currentWindow == 0 && move == Main.UP)  {
    	// Previous Page
//		Main.log("Display.setVideoListPosition: previous page. position= " + position);

		for(i = 0; i < Display.getNumberOfVideoListItems(); i++) {
			var idx = (i + position) %Data.getVideoCount();
        	Display.setVideoItem(this.videoList[(i+this.FIRSTIDX)], Display.getDisplayTitle (Data.getCurrentItem().childs[idx]), (idx == 0) ?true: false);
        }
    }
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
			res.c1 = item.payload.num;
			res.c2 = item.title;
			if(item.payload.start>0) 
			{
				var epg_start_time=new MyDate(item.payload.start*1000);
				var epg_start_hour=epg_start_time.getHours();
				if(epg_start_hour<10)
				{
					epg_start_hour = "0"+epg_start_hour;
				}
				var epg_start_minute=epg_start_time.getMinutes();
				if(epg_start_minute<10)
				{
					epg_start_minute = "0"+epg_start_minute;
				}
				res.c3 = epg_start_hour + ":" + epg_start_minute +" "+item.payload.prog;				
			}
			else {
				res.c3 =  "NA:NA" +" "+item.payload.prog;				
			}
		} // else
		break;
	case Main.eREC:
		// Recordings
		if (item.isFolder == true) {
			res.c1 = "<" + Display.getNumString(item.childs.length, 3) + ">";
			res.c2 = item.title; 			
		}
		else {
			var digi = new MyDate(parseInt(item.payload.start*1000));
			var mon = Display.getNumString ((digi.getMonth()+1), 2);
			var day = Display.getNumString (digi.getDate(), 2);
			var hour = Display.getNumString (digi.getHours(), 2);
			var min = Display.getNumString (digi.getMinutes(), 2);

			var d_str = mon + "/" + day + " " + hour + ":" + min;
			res.c1 = d_str + ((item.payload.isnew == "true") ? " *" : "");
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
	case Main.eURLS:
		res.c2 = item.title; 
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

Display.resetAtStop = function () {
	// this function should reset all overlay features to plan recordings.
	// Hide Recording bar

// TODO: Debugging purpose
//	Notify.notifyOlHandler.cancel();

	Player.resetAtStop(); // Needs to be done at beginning to reset parameters
	Display.resetStartStop();

	// Buffer Progress
	Display.bufferUpdate();
	
	// Progress Bar
	Display.updateProgressBar();

	// Playtime info
	Display.updatePlayTime();
	$("#olRecProgressBar").hide();	
};
 
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
	Player.setDuration();

	Player.setCurrentPlayTimeOffset((now - Data.getCurrentItem().childs[Main.selectedVideo].payload.start) * 1000);
	Player.OnCurrentPlayTime(0);   // updates the HTML elements of the Progressbar 
}; 
 
Display.setOlTitle = function (title) {
	this.olTitle = title;
	$("#olTitle").text(this.olTitle);
};

Display.resetStartStop = function () {
	Display.olStartStop = "";
	Display.hideOlStartStop();
	$("#olStartStop").text("");
};

Display.setStartStop = function(start, stop) {
	this.olStartStop = "";
	Display.showOlStartStop();
	
	var digi =new MyDate(start * 1000);
    var hours=digi.getHours();
    var minutes=digi.getMinutes();
    if (minutes<=9)
    	   minutes='0'+minutes;
    this.olStartStop = hours + ":" + minutes + " - ";

	digi =new MyDate(stop * 1000);
    hours=digi.getHours();
    minutes=digi.getMinutes();
    if (minutes<=9)
    	   minutes='0'+minutes;
    this.olStartStop = this.olStartStop + hours + ":" + minutes;    
	
	$("#olStartStop").text(Display.olStartStop);
  
};

Display.setSkipDuration = function(duration) {
	this.olStartStop = "";
//	if (this.olStartStop == "")
		Display.showOlStartStop();

	this.olStartStop = duration;    

	$("#olStartStop").text("Next Skip: " + Display.olStartStop+"sec");
};

Display.setTrickplay = function(direction, multiple) {
	this.olStartStop = "";
//	if (this.olStartStop == "")
		Display.showOlStartStop();

	this.olStartStop = multiple;    

	$("#olStartStop").text( ((direction == 1) ? "FF": "RW") + ": " + Display.olStartStop+"x");
};


// Player.OnCurrentPlayTime
Display.updatePlayTime = function() {
	$("#olTimeInfo").text(Player.curPlayTimeStr + " / " + Player.getDurationStr());
};

Display.updateProgressBar = function () {
	var timePercent = (Player.curPlayTime *100)/ Player.getDuration();
	$("#olProgressBar").css("width", (Math.round(timePercent) + "%"));
};

Display.updateRecBar = function (start_time, duration){
	var now = Display.GetUtcTime();
//	var now = (new MyDate()).getTimeSec();

	var remaining = Math.round(((start_time + duration) - now) * 100/ duration);
	$("#olRecProgressBar").show();
	$("#olRecProgressBar").css({"width": (remaining + "%"), "left": ((100 - remaining) + "%")});
};



Display.status = function(status) {
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
 * Info Overlay handlers
 */
Display.showInfo = function(selected) {
    var itm = Data.getCurrentItem().childs[selected];
	var title = itm.title;
    var prog = itm.payload.prog;
    var desc = itm.payload.desc;
    var length = itm.payload.dur;
    	
    var digi = new MyDate(parseInt(itm.payload.start*1000));
    var mon = Display.getNumString ((digi.getMonth()+1), 2);
    var day = Display.getNumString (digi.getDate(), 2);
    var hour = Display.getNumString (digi.getHours(), 2);
    var min = Display.getNumString (digi.getMinutes(), 2);

    var d_str ="";
	switch (Main.state) {
	case Main.eLIVE:
    	var now = Display.GetUtcTime();
//		var now = (new MyDate()).getTimeSec();
			
        d_str = hour + ":" + min;

		$("#infoTitle").text(title + "\n" + prog);
		$("#infoDuration").text("Duration: " + Display.durationString(length) + "h Remaining: " + Display.durationString((itm.payload.start + length - now)));
		$("#infoDesc").text(desc);
		$("#infoAudio").text("Audio Tracks: " + Player.getNumOfAudioTracks() + " Subtitle Tracks: " + Player.getNumOfSubtitleTracks());
		break;
	case Main.eREC:
        d_str = mon + "/" + day + " " + hour + ":" + min;
		$("#infoTitle").text(title);
		$("#infoDuration").text(d_str + " Duration: " + Display.durationString(length) + "h");
		$("#infoDesc").text(desc);
		try {
			$("#infoAudio").text("Audio Tracks: " + Player.getNumOfAudioTracks() + " Subtitle Tracks: " + Player.getNumOfSubtitleTracks());
		}
		catch (e) {
			$("#infoAudio").text("Audio Tracks: " + 0 + " Subtitle Tracks: " + 0);
		}
		break;
	case Main.eMED:
		$("#infoTitle").text(title);
		$("#infoDuration").text("Duration: " + Display.durationString(Player.getDuration()) );
		$("#infoAudio").text("Audio Tracks: " + Player.getNumOfAudioTracks() + " Subtitle Tracks: " + Player.getNumOfSubtitleTracks());
		break;
	case Main.eURLS:
		$("#infoTitle").text(title);
		$("#infoDuration").text("Duration: " + Display.durationString(length) );
		$("#infoDesc").text(desc);

		$("#infoAudio").text("Audio Tracks: " + Player.getNumOfAudioTracks() + " Subtitle Tracks: " + Player.getNumOfSubtitleTracks());
		break;
	default:
		Main.logToServer("ERROR in Display.handleDescription: Should not be here");
		break;
	}
	this.infoOlHandler.show();
	Main.log("Info title= (" + $("#infoTitle").position().top + ", " + $("#infoTitle").position().left+")");
	Main.log("Info dur= (" + $("#infoDuration").position().top + ", " + $("#infoDuration").position().left+")");
	Main.log("Info desc= (" + $("#infoDesc").position().top + ", " + $("#infoDesc").position().left+")");
	Main.log("Info desc line-height: " + $("#infoDesc").css('line-height'));
};

Display.handlerShowInfo = function() {
	$("#infoOverlay").slideDown(300);
};

Display.handlerHideInfo = function() {
	$("#infoOverlay").slideUp(300);
};

//---------------------------------------------------------
/*
 * Popup handlers
 */
Display.showPopup = function(text) {
	
	Main.log("Display.showPopup text= " + text);
	if (text == "")
		this.popupOlHandler.show();
		
	var elm = $("<p>", {text: text});
	$("#popup").append(elm);
	this.popupOlHandler.show();
	
	Display.scrollPopup ();
};

Display.scrollPopup = function () {
	Main.log("Display.scrollPopup" );
	
	var t = $('#popup').children().last().position().top;
	var h = $('#popup').children().last().outerHeight();
	if ((t + h) > $("#popup").height()) {
		$("#popup").animate ({scrollTop:  $("#popup").scrollTop() + t + h - $("#popup").height()}, 200);		
	}
	
};

Display.handlerShowPopup = function() {
    document.getElementById("popup").style.display="block";
	
};

Display.handlerHidePopup = function() {
	$("#popup").css("height", "100px");

    $('#popup').children().each(function() { $(this).remove(); });

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
    $("#overlay").fadeOut(300);
};

Display.handlerShowProgress = function() {
    $("#overlay").fadeIn(400);
    Main.log("************************ OL width= " + $("#olProgressBarBG").width());
    var bar_width = $("#olProgressBarBG").width();
	if (Player.isRecording == true) {
		if ((Player.startTime + Player.getDuration())  >  now) {
			// not done
			$("#olRecProgressBar").show();
			var now = Display.GetUtcTime();
//    		var now = (new MyDate()).getTimeSec();

			var remaining_px = ((Player.startTime + Player.getDuration()) - now) * bar_width/ Player.getDuration();
			var elm = document.getElementById("olRecProgressBar");
			elm.style.display="block";
			elm.style.width = remaining_px + "px";
			elm.style.left = (bar_width - remaining_px) + "px";
		} 

	}
	else
	    $("#olRecProgressBar").hide();
    
    var time_px = (Player.curPlayTime *bar_width)/ Player.getDuration();
    
    document.getElementById("olProgressBar").style.width = time_px + "px";

	$("#olTimeInfo").text(Player.curPlayTimeStr + " / " + Player.getDurationStr());

    var Digital=new MyDate();
    var hours= Digital.getHours() ;
    var minutes=Digital.getMinutes();
    if (minutes<=9)
    	   minutes='0'+minutes;
	$("#olNow").text(hours + ':' + minutes);
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
	var date = new MyDate();
//	Main.log("ClockHandler.update "+ date.getHours());

	if (Config.useVdrTime) {
		if (Config.deviceType == 0)
			Main.logToServer("Display.GetUtcTime: uvtUtcTime= " + Config.uvtUtcTime + " locRef= " + Config.uvtlocRefTime + " d= " + (Config.uvtUtcTime - Config.uvtlocRefTime) +" plgUtc= " + Display.pluginTime.GetEpochTime());
		else
			Main.logToServer("Display.GetUtcTime: uvtUtcTime= " + Config.uvtUtcTime + " locRef= " + Config.uvtlocRefTime + " d= " + (Config.uvtUtcTime - Config.uvtlocRefTime) +" plgUtc= " + new Date().getTime());
	}

    var hours= date.getHours() ;
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
	return success;
};

OverlayHandler.prototype.checkHideCallback = function () {
	var now = Display.GetUtcTime();
//	var now = (new MyDate()).getTimeSec();

	if (now >= this.hideTime) {

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
		this.startTime = Display.GetUtcTime();
//		this.startTime = (new MyDate()).getTimeSec();
		
		this.hideTime = this.startTime + (this.olDelay / 1000);

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
		this.hideTime = Display.GetUtcTime() + (this.olDelay /1000);
//		this.hideTime = (new MyDate()).getTimeSec() + (this.olDelay /1000);
	}
};


OverlayHandler.prototype.cancel = function () {
	if (!this.active)
		return;
	
	if (this.hideCallback) {
		this.hideCallback();			
	}
	else
		Main.log(this.handlerName + ": No hideCallback defined - ignoring " );
	
	this.active = false;
	window.clearTimeout(this.timeoutObj);
};


Display.GetUtcTime = function() {
	var res = 0;
	switch (Config.deviceType) {
	case 0:
		if (Config.useVdrTime == false) 
			// Samsung specific UTC time function
			res = Display.pluginTime.GetEpochTime(); // always in UTC
		else {
			// In case the Samsung does not have a TV input
			res = (Config.uvtUtcTime - Config.uvtlocRefTime) + Display.pluginTime.GetEpochTime() ;
		}

		break;
	default:
		var now_millis = ((new Date()).getTime());
		res =   (now_millis /1000.0) ;
	break;
	}

	return res;
};


function MyDate (input) {
	this.date = null;
	
	switch(arguments.length) {
	case 0:
		// Should only be used by clock function, otherwise use Display.pluginTime.GetEpochTime() !!!!
		if (Config.deviceType == 0) {
//			var cor = Display.GetEpochTime()*1000 - (Config.tzCorrection * 3600000);
			var cor = Display.GetUtcTime()*1000 - (Config.tzCorrection * 3600000);
			
			this.date = new Date(cor);			
		}
		else 
			// Browser
			this.date = new Date();			
		break;
	case 1:
		// in millisec or string
		if (typeof arguments[0] == "number") {
			if (Config.tzCorrection == 0) {
				this.date = new Date(arguments[0]);				
			}
			else {
				Main.log("MyDate arg[0]= " + arguments[0] + " cor= " + (Config.tzCorrection * 3600000) + " args= " + MyDate.arguments.length );
				this.date = new Date(arguments[0] - (Config.tzCorrection * 3600000));				
			}
			
		}
		else {
			Main.log("MyDate - ERROR not handled correctly - type String");
			Main.logToServer("MyDate - ERROR not handled correctly - type String");
			this.date = new Date(arguments[0]);
		}
		break;
	default:
		Main.log("MyDate - ERROR not handled correctly - args= " + MyDate.arguments.length );
		Main.logToServer("MyDate - ERROR not handled correctly - args= " + MyDate.arguments.length );
		if (MyDate.arguments.length == 3)
			this.date = new Date(arguments[0], arguments[1], arguments[2]);
		else
			this.date = new Date(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5]);
		break;
	}

};

// in millis. Not a UTC time due to TZ correction
MyDate.prototype.getTime = function() {
	return this.date.getTime();
};

// in seconds. Not a UTC time due to TZ correction
MyDate.prototype.getTimeSec = function () {
	return (this.date.getTime() / 1000.0)  ;
//	return ((this.date.getTime() / 1000.0) - (Config.tzCorrection * 60)) ;

//	var now_millis = ((new MyDate()).getTime());
//	res =   ((now_millis /1000.0) - (Config.tzCorrection * 60));

};

MyDate.prototype.getHours = function () {
	return this.date.getHours();
};

MyDate.prototype.getMinutes = function () {
	return this.date.getMinutes();
};

MyDate.prototype.getSeconds = function () {
	return this.date.getSeconds();
};

MyDate.prototype.getTimezoneOffset = function () {
	return this.date.getTimezoneOffset();
};

MyDate.prototype.getDate = function () {
	return this.date.getDate();
};

MyDate.prototype.getDay = function () {
	return this.date.getDay();
};

MyDate.prototype.getMonth = function () {
	return this.date.getMonth();
};

MyDate.prototype.getFullYear = function () {
	return this.date.getFullYear();
};
