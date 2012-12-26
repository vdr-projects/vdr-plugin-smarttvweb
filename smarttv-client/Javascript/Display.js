var Display =
{
	pluginTime : null,
    statusDiv : null,
    statusPopup : null,
    bufferingElm : null,
    FIRSTIDX : 0,
    LASTIDX : 15,
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



Display.init = function()
{
    var success = true;
    
    this.statusDiv = document.getElementById("status");
    this.statusPopup = document.getElementById("statusPopup");
    
    this.pluginTime = document.getElementById("pluginTime");
    this.bufferingElm = document.getElementById("bufferingBar");
    
    alert("Display.init now=" + this.pluginTime.GetEpochTime());

    this.progOlHandler = new OverlayHandler("ProgHndl");
    this.volOlHandler = new OverlayHandler("VolHndl");
    this.popupOlHandler = new OverlayHandler("PopupHndl");
    this.progOlHandler.init(Display.handlerShowProgress, Display.handlerHideProgress);
    this.volOlHandler.init(Display.handlerShowVolume, Display.handlerHideVolume);
    this.popupOlHandler.init(Display.handlerShowPopup, Display.handlerHidePopup);
    
    Display.status("Stop");
    if (!this.statusDiv)
    {
        success = false;
    }
    for (var i = 0; i <= this.LASTIDX; i++) {
    	var elm = document.getElementById("video"+i);
    	elm.style.paddingLeft = "10px";
    	elm.style.paddingTop = "4px";
    	elm.style.paddingBottom = "6px";
    }

    var done = false;
    var i = 0;
    while (done != true) {
    	i ++;
    	var elm = document.getElementById("selectItem"+i);
    	if (elm == null) {
    		done = true;
    		alert( " only found to selectItem"+ (i-1));
    		break;
    	}
    	elm.style.paddingBottom = "3px";
    	elm.style.marginTop= " 5px";
    	elm.style.marginBottom= " 5px";
    	elm.style.textAlign = "center";
    }    
    
    alert("Display initialized" );
    return success;
};

Display.resetSelectItems = function (itm) {
	var done = false;
	var i = 0;
	while (done != true) {
		i ++;
		var elm = document.getElementById("selectItem"+i);
		if (elm == null) {
			done = true;
			alert( " only found to selectItem"+ (i-1));
			break;
	    }
		Display.unselectItem(elm);	
	}    
    Display.selectItem(document.getElementById("selectItem"+itm));
};

Display.resetVideoList = function () {
	var done = false;
	var i = 0;
	while (done != true) {
		i ++;
		var elm = document.getElementById("video"+i);
		if (elm == null) {
			done = true;
			break;
	    }
		Display.unselectItem(elm);	
	    widgetAPI.putInnerHTML(elm, "");
	}    
	
};

Display.setOlTitle = function (title) {
	this.olTitle = title;
	var elm = document.getElementById("olTitle");
    widgetAPI.putInnerHTML(elm, Display.olTitle);    
};

Display.setStartStop = function(start, stop) {
	this.olStartStop = "";

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

    var elm = document.getElementById("olStartStop");
    widgetAPI.putInnerHTML(elm, Display.olStartStop);    
};

/*
//obsolete?
Display.setTotalTime = function(total) {
    this.totalTime = total;
};
*/
/*

// Player.OnCurrentPlayTime
Display.setTime = function(time) {
    var timePercent = (100 * time) / this.totalTime;
    var timeHTML = "";
    var timeHour = 0; var timeMinute = 0; var timeSecond = 0;
    var totalTimeHour = 0; var totalTimeMinute = 0; 
    var totalTimesecond = 0;
    
    if(Player.state == Player.PLAYING)
    {
        totalTimeHour = Math.floor(this.totalTime/3600000);
        timeHour = Math.floor(time/3600000);
        
        totalTimeMinute = Math.floor((this.totalTime%3600000)/60000);
        timeMinute = Math.floor((time%3600000)/60000);
        
        totalTimeSecond = Math.floor((this.totalTime%60000)/1000);
        timeSecond = Math.floor((time%60000)/1000);
        
        timeHTML = timeHour + ":";
        
        if(timeMinute == 0)
            timeHTML += "00:";
        else if(timeMinute <10)
            timeHTML += "0" + timeMinute + ":";
        else
            timeHTML += timeMinute + ":";
            
        if(timeSecond == 0)
            timeHTML += "00/";
        else if(timeSecond <10)
            timeHTML += "0" + timeSecond + "/";
        else
            timeHTML += timeSecond + "/";
            
        timeHTML += totalTimeHour + ":";
        
        if(totalTimeMinute == 0)
            timeHTML += "00:";
        else if(totalTimeMinute <10)
            timeHTML += "0" + totalTimeMinute;
        else
            timeHTML += totalTimeMinute;
            
        if(totalTimeSecond == 0)
            timeHTML += "00";
        else if(totalTimeSecond <10)
            timeHTML += "0" + totalTimeSecond;
        else
            timeHTML += totalTimeSecond;
    }
    else
        timeHTML = "0:00:00/0:00:00";        
};
*/

Display.getHumanTimeRepresentation = function(time) {
	var totalTimeHour = 0; 
	var totalTimeMinute = 0; 
	var totalTimeSecond = 0;
	
    totalTimeHour = Math.floor(time/3600000); 
    totalTimeMinute = Math.floor((time%3600000)/60000);    
    totalTimeSecond = Math.floor((time%60000)/1000);

    var totalTimeStr = totalTimeHour + ":";

    if(totalTimeMinute == 0)
    	totalTimeStr += "00:";
    else if(totalTimeMinute <10)
    	totalTimeStr += "0" + totalTimeMinute + ":";
    else
    	totalTimeStr += totalTimeMinute + ":";
        
    if(totalTimeSecond == 0)
    	totalTimeStr += "00";
    else if(totalTimeSecond <10)
    	totalTimeStr += "0" + totalTimeSecond;
    else
    	totalTimeStr += totalTimeSecond;

	return totalTimeStr;
};

/*
// called by Player.OnStreamInfoReady
Display.updateTotalTime = function(time) {
    Player.totalTimeStr = Display.getHumanTimeRepresentation(time);
};
*/

// Player.OnCurrentPlayTime
Display.updatePlayTime = function() {
//    Player.curPlayTimeStr =  Display.getHumanTimeRepresentation(Player.curPlayTime);
    var timeElement = document.getElementById("olTimeInfo");
    widgetAPI.putInnerHTML(timeElement,  Player.curPlayTimeStr + " / " + Player.totalTimeStr);    
};

Display.updateProgressBar = function () {
	var timePercent = (Player.curPlayTime *100)/ Player.totalTime;
    document.getElementById("olProgressBar").style.width = Math.round(timePercent) + "%";	
};

Display.updateRecBar = function (start_time, duration){
	var now = Display.pluginTime.GetEpochTime();

	var remaining = Math.round(((start_time + duration) - now) * 100/ duration);
//    alert (" remaining= " + remaining + " start= " + start_time + " dur= " + duration);
	var elm = document.getElementById("olRecProgressBar");
    elm.style.display="block";
    elm.style.width = remaining + "%";
    elm.style.left = (100 - remaining) + "%";
};


Display.status = function(status) {
    alert(status);
    widgetAPI.putInnerHTML(this.statusDiv, status);
    widgetAPI.putInnerHTML(this.statusPopup, status);
};

Display.showStatus = function() {
	this.statusPopup.style.display="block";
};

Display.hideStatus = function() {
	this.statusPopup.style.display="none";
};


Display.progress = function(status) {
    widgetAPI.putInnerHTML(this.statusDiv, status);
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


Display.handleDescription =function (selected) {
	
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
//    	alert("handleDescription: " +Data.getCurrentItem().childs[selected].payload.desc);
    	var msg = "";
    	if (Main.state == 1) {
    		// Live
    		var now = pluginTime.GetEpochTime();

        	d_str = hour + ":" + min;

        	msg += title + "<br>";
        	msg += "<b>"+ prog + "</b><br>";
        	msg += "<br>Start: " + d_str + "<br>";
        	msg += "Duration: " + Display.durationString(length) + "h<br>";
        	msg += "Remaining: " + Display.durationString((itm.payload.start + length - now));
    	}
    	else {
    		// on-demand
        	d_str = mon + "/" + day + " " + hour + ":" + min;

        	msg += "<b>" + title + "</b>";
        	msg += "<br><br>" + d_str;
        	msg += " Duration: " + Display.durationString(length) + "h";
    	}
    	msg += "<br><br>"+ desc;
        Display.setDescription(msg);   	
    }
	
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

Display.getDisplayTitle = function(item) {
	var res = "";
	switch (Main.state) {
	case 1:
		// Live
		res = item.title;
		break;
	case 2:
	case 3:
		// Recordings
		if (item.isFolder == true) {
//			res = "<" + Display.getNumString(item.childs.length, 3) + ">-------- " + item.title; 
			res = "<" + Display.getNumString(item.childs.length, 3) + ">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- " + item.title; 
			
		}
		else {
			var digi = new Date(parseInt(item.payload.start*1000));
			var mon = Display.getNumString ((digi.getMonth()+1), 2);
			var day = Display.getNumString (digi.getDate(), 2);
			var hour = Display.getNumString (digi.getHours(), 2);
			var min = Display.getNumString (digi.getMinutes(), 2);

			var d_str = mon + "/" + day + " " + hour + ":" + min;
			res = d_str + " - " + item.title; 
		}
		break;
	default:
		alert("ERROR: Shall be in state 1 or 2. State= " + Main.state);
		break;
	}
	return res;
};

Display.setVideoList = function(selected, first) {
	// 
    var listHTML = "";
    var first_item = selected;
    if(typeof first !='undefined') {
    	first_item = first;
    	alert("Display.setVideoList first_item= " + first_item);
    }
    	
    var i=0;
    alert("Display.setVideoList title= " +Data.getCurrentItem().childs[selected].title + " selected= " + selected + " first_item= " + first_item);
    this.handleDescription(selected);
    
    for (i = 0; i <= this.LASTIDX; i++) {
    	if ((first_item+i) >= Data.getVideoCount()) {
    		listHTML = "";
    	}
    	else {
//            alert(" - title[first_item+i]= " +Data.getCurrentItem().childs[(first_item +i)].title + " i= " + i);
            listHTML = Display.getDisplayTitle (Data.getCurrentItem().childs[first_item+i]); 
    	}
        this.videoList[i] = document.getElementById("video"+i);
        widgetAPI.putInnerHTML(this.videoList[i], listHTML);
        this.unselectItem(this.videoList[i]);
    }
    
    this.currentWindow = (selected - first_item);
    this.selectItem(this.videoList[this.currentWindow]);
    
    listHTML = (selected +1) + " / " + Data.getVideoCount();
    
    widgetAPI.putInnerHTML(document.getElementById("videoCount"), listHTML);
};

Display.selectItem = function (item) {

	item.style.color = "black";
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


/*
 * this.currentWindow: Cursor (selected item)
 */
Display.setVideoListPosition = function(position, move)
{    
    var listHTML = "";
    alert ("Display.setVideoListPosition title= " +Data.getCurrentItem().childs[position].title + " move= " +move);

    this.handleDescription(position);
    
    listHTML = (position + 1) + " / " + Data.getVideoCount();
    widgetAPI.putInnerHTML(document.getElementById("videoCount"), listHTML);
    
    
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
                listHTML = Display.getDisplayTitle (Data.getCurrentItem().childs[i]); 
//            	listHTML = Data.getCurrentItem().childs[i].title;
                widgetAPI.putInnerHTML(this.videoList[i], listHTML);
                
                if(i == this.currentWindow)
                	this.selectItem(this.videoList[i]);
                else
                	this.unselectItem(this.videoList[i]);
                }
        }
        else {            
            for(i = 0; i <= this.LASTIDX; i++) {
                listHTML = Display.getDisplayTitle (Data.getCurrentItem().childs[i + position - this.currentWindow]); 
//                listHTML = Data.getCurrentItem().childs[i + position - this.currentWindow].title;
                widgetAPI.putInnerHTML(this.videoList[i], listHTML);
            }
        }
    }
    else if(this.currentWindow == this.FIRSTIDX && move == Main.UP)  {
    	// Previous Page
        if(position == Data.getVideoCount()-1) {
        	// very bottom element selected
        	this.currentWindow = this.LASTIDX;
            
            for(i = 0; i <= this.LASTIDX; i++) {
                listHTML = Display.getDisplayTitle (Data.getCurrentItem().childs[i + position - this.currentWindow]); 
//            	listHTML = Data.getCurrentItem().childs[i + position - this.currentWindow].title;               
                widgetAPI.putInnerHTML(this.videoList[i], listHTML);
                
                if(i == this.currentWindow)
                	this.selectItem(this.videoList[i]);
                else
                	this.unselectItem(this.videoList[i]);
            }
        }
        else {            
            for(i = 0; i <= this.LASTIDX; i++) {
                listHTML = Display.getDisplayTitle (Data.getCurrentItem().childs[i + position]); 
//                listHTML = Data.getCurrentItem().childs[i + position].title;
                widgetAPI.putInnerHTML(this.videoList[i], listHTML);
            }
        }
    }
};

Display.setDescription = function(description) {
    var descriptionElement = document.getElementById("description");
    
    widgetAPI.putInnerHTML(descriptionElement, description);
};

//--------------------------------------------------------
Display.bufferUpdate = function() {
	// Player.bufferState 
	// find buffering element and show status
	this.bufferingElm.style.width= Player.bufferState+ "%";
};

//--------------------------------------------------------
Display.hide = function()
{
    document.getElementById("main").style.display="none";
};

Display.show = function()
{
	// cancel ongoing overlays first
	this.volOlHandler.cancel();
	this.progOlHandler.cancel();
	this.popupOlHandler.cancel();
    document.getElementById("main").style.display="block";
};

//---------------------------------------------------------
Display.setVolume = function(level)
{
    document.getElementById("volumeBar").style.width = level + "%";
    
    var volumeElement = document.getElementById("volumeInfo");

    widgetAPI.putInnerHTML(volumeElement, "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + Audio.getVolume());
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
Display.showPopup = function(text) {
	var oldHTML = document.getElementById("popup").innerHTML;
	widgetAPI.putInnerHTML(document.getElementById("popup"), oldHTML + "<br>" + text);
	this.popupOlHandler.show();
};

Display.handlerShowPopup = function() {
    document.getElementById("popup").style.display="block";
	
};

Display.handlerHidePopup = function() {
    document.getElementById("popup").style.display="none";
	widgetAPI.putInnerHTML(document.getElementById("popup"), "");
};

//---------------------------------------------------------

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
	    var now = pluginTime.GetEpochTime();
	    var remaining = Math.round(((Player.startTime + Player.duration) - now) * 100/ Player.duration);
	    alert (" remaining= " + remaining);
    	var elm = document.getElementById("olRecProgressBar");
	    elm.style.display="block";
	    elm.style.width = remaining + "%";
	    elm.style.left = (100 - remaining) + "%";
	}
	else
	    document.getElementById("olRecProgressBar").style.display="none";
    
    var timePercent = (Player.curPlayTime *100)/ Player.totalTime;
    
	alert("show OL Progress timePercent= " + timePercent);

    document.getElementById("olProgressBar").style.width = timePercent + "%";

    var timeElement = document.getElementById("olTimeInfo");
    widgetAPI.putInnerHTML(timeElement,  Player.curPlayTimeStr + " / " + Player.totalTimeStr);    

    var nowElement = document.getElementById("olNow");
    var Digital=new Date();
    var hours=Digital.getHours();
    var minutes=Digital.getMinutes();
    if (minutes<=9)
    	   minutes='0'+minutes;
    widgetAPI.putInnerHTML(nowElement, hours + ':' + minutes);    
};



//----------------------------------------
function OverlayHandler (n) {
	this.pluginTime = null;
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
	this.pluginTime = document.getElementById("pluginTime");
	if (!this.pluginTime) {
        alert(this.handlerName + " cannot aquire time plugin :  " + success);    
        success = false;
	}
//	alert(this.handlerName + " is initialized");	
	return success;
};

OverlayHandler.prototype.checkHideCallback = function () {
	var pluginTime = document.getElementById("pluginTime");
	var now = pluginTime.GetEpochTime();
//	alert(that.handlerName + "checkHideCallback: now= " + now + " hideTime= " +  that.hideTime +  " delta= " + (now - that.hideTime));
	if (now >= this.hideTime) {
//		alert(this.handlerName + "hiding " + this.handlerName + " howDur: act= " + (now - this.startTime) + " int= " + (this.hideTime-this.startTime));

		this.olDelay = 3000;
		if (this.hideCallback) {
			this.hideCallback();			
		}
		else
			alert(this.handlerName + ": No hideCallback defined - ignoring " );
		
		this.active = false;
		return;
	}
	var delay = (this.hideTime - now) * 1000;
//	alert(this.handlerName + "checkHideCallback: new timeout= " +delay);

	// pass an anonymous function
	var self = this;
	this.timeoutObj = window.setTimeout(function() {self.checkHideCallback(); }, delay);
};

OverlayHandler.prototype.show = function() {
	if (!this.active ) {
		this.startTime = this.pluginTime.GetEpochTime();
		this.hideTime = this.startTime + (this.olDelay / 1000);

//		alert(this.handlerName + " showing " + this.handlerName + " from= " + this.startTime + " to at least= " + this.hideTime);
		if (this.showCallback) {
			this.showCallback();
			
			var self = this;
			this.timeoutObj = window.setTimeout(function() {self.checkHideCallback();}, this.olDelay);
			this.active = true;
		}
		else
			alert(this.handlerName + ": No showCallback defined - ignoring " );
	}
	else {
//		alert(this.handlerName + " extending showtime for " + this.handlerName + " for another " + (this.olDelay /1000)+ "sec");
		this.hideTime = this.pluginTime.GetEpochTime() + (this.olDelay /1000);
	}
};


OverlayHandler.prototype.cancel = function () {
	if (!this.active)
		return;
	
//	alert("cancel for handler " + this.handlerName);
	if (this.hideCallback) {
		this.hideCallback();			
	}
	else
		alert(this.handlerName + ": No hideCallback defined - ignoring " );
	
	this.active = false;
	window.clearTimeout(this.timeoutObj);
};