var widgetAPI = new Common.API.Widget();
var tvKey = new Common.API.TVKeyValue();

var custom = window.deviceapis.customdevice || {};


/*
 * TODO:
 * Resume
 * Audio Track Select
 * Screensaver (using setOnScreenSaver() from common modules)
 * VDR Status on main screne
 */ 


var Main = {
	state : 0,  // selectScreen
	selectedVideo : 0,
	olTimeout : 3000,
	mode : 0,
    mute : 0,
    
    
    UP : 0,
    DOWN : 1,

    WINDOW : 0,
    FULLSCREEN : 1,
    
    NMUTE : 0,
    YMUTE : 1,
    
    defKeyHndl : null,
    selectMenuKeyHndl : null,
    playStateKeyHndl : null,
    livePlayStateKeyHndl : null,
    menuKeyHndl : null
};

Main.onLoad = function() {
	Network.init();
	Display.init(); 
	
    this.defKeyHndl = new cDefaulKeyHndl;
    this.playStateKeyHndl = new cPlayStateKeyHndl(this.defKeyHndl);
    this.livePlayStateKeyHndl = new cLivePlayStateKeyHndl(this.defKeyHndl);
    this.menuKeyHndl = new cMenuKeyHndl(this.defKeyHndl);
    this.selectMenuKeyHndl = new cSelectMenuKeyHndl(this.defKeyHndl);

    alert (" created KeyHandlers");

	Config.init();
};

// Called by Config, when done
// TODO: Send sendReadyEvent early and show a splash screen during startup
Main.init = function () {
	alert("Main.init()");
    if ( Player.init() && Audio.init() && Server.init() ) {
    	Display.setVolume( Audio.getVolume() );

        // Start retrieving data from server
        Server.dataReceivedCallback = function()
            {
                /* Use video information when it has arrived */
        		alert("Server.dataReceivedCallback");
        		Display.setVideoList(Main.selectedVideo);

                Display.show();
            };

        // Enable key event processing
        this.enableKeys();

        Display.selectItem(document.getElementById("selectItem1"));
        
		document.getElementById("splashScreen").style.display="none";
		
		widgetAPI.sendReadyEvent();    		
    }
    else {
       alert("Failed to initialise");
    }
   
};

Main.log = function (msg) {
	if (Config.serverUrl == "" )
		return;

	var XHRObj = new XMLHttpRequest();
    XHRObj.open("POST", Config.serverUrl + "/log", true);
    XHRObj.send("CLOG: " + msg);
};

Main.onUnload = function()
{
    Player.deinit();
};

Main.changeState = function (state) {
	alert("change state: new state= " + state);
	var old_state = this.state;
	this.state = state;
	
	switch (this.state) {
	case 0:
		Main.selectMenuKeyHndl.select = old_state;
		alert ("old Select= " + Main.selectMenuKeyHndl.select);
		Display.resetSelectItems(Main.selectMenuKeyHndl.select);
        
		document.getElementById("selectScreen").style.display="block";
		Display.hide();
		Display.resetVideoList();		
		break;
	case 1:
		document.getElementById("selectScreen").style.display="none";
		Display.show();
		Data.reset ();
		Main.liveSelected();
		break;
	case 2:
		document.getElementById("selectScreen").style.display="none";
		Display.show();
		Data.reset ();
		Main.recordingsSelected();
		break;
	case 3:
		document.getElementById("selectScreen").style.display="none";
		Display.show();
		Data.reset ();
		Main.mediaSelected();
		break;
	case 4:
		// Options
    	Options.init();
		document.getElementById("selectScreen").style.display="none";
		document.getElementById("optionsScreen").style.display="block";
		Main.optionsSelected();
		break;

	}
};

Main.recordingsSelected = function() {
    Player.stopCallback = function() {
    	// 
    	var msg = "devid:" + Network.getMac() + "\n"; 
    	msg += "title:" + Data.getCurrentItem().childs[Main.selectedVideo].title + "\n"; 
    	msg += "start:" +Data.getCurrentItem().childs[Main.selectedVideo].payload.start + "\n";
    	msg += "resume:"+ (Player.curPlayTime/1000) + "\n" ;
    	
        var XHRObj = new XMLHttpRequest();
        XHRObj.open("POST", Config.serverUrl + "/resume", true);
        XHRObj.send(msg);
    	
    	Display.show();
    };
    Player.isLive = false;   
    Server.setSort(true);
    if (Config.format == "") {
        Server.fetchVideoList(Config.serverUrl + "/recordings.xml?model=samsung"); /* Request video information from server */
        alert("fetchVideoList from: " + Config.serverUrl + "/recordings.xml?model=samsung");
    }
    else {
    	Main.log("Using format " + Config.format);
    	if (Config.format == "")
        	Server.fetchVideoList(Config.serverUrl + "/recordings.xml?model=samsung&has4hd=false"); /* Request video information from server */
    	else
    		Server.fetchVideoList(Config.serverUrl + "/recordings.xml?model=samsung&has4hd=false&type="+Config.format); /* Request video information from server */
    }
};

Main.serverError = function(errorcode) {
	if (Server.retries == 0) {
		switch (this.state) {
		case 1: // live
		    Server.fetchVideoList( Config.serverUrl + "/channels.xml?mode=nodesc"); /* Request video information from server */
			break;
		}		
	}
};

Main.liveSelected = function() {
	Server.retries = 0;
    Player.stopCallback = function() {
    };
    Player.isLive = true;
    Server.setSort(false);
    Server.errorCallback = Main.serverError;
    Server.fetchVideoList(Config.serverUrl + "/channels.xml"); /* Request video information from server */
};

Main.mediaSelected = function() {
    Player.stopCallback = function() {
    	// 
    	Display.show();
    };
    Player.isLive = false;   
    Server.setSort(true);
    Server.fetchVideoList(Config.serverUrl + "/media.xml"); /* Request video information from server */
};

Main.optionsSelected = function() {
	alert ("Main.optionsSelected");
};

Main.enableKeys = function()
{
    document.getElementById("anchor").focus();
};

Main.keyDown = function() {
	switch (this.state) {
	case 0: 
		// selectView
        this.selectMenuKeyHndl.handleKeyDown();
		break;
	case 1: 
		// Live
		alert("Live - Main.keyDown PlayerState= " + Player.getState());
	    if(Player.getState() == Player.STOPPED) {
	    	// Menu Key
	        this.menuKeyHndl.handleKeyDown();
	    }
	    else {
	    	// Live State Keys
	    	this.livePlayStateKeyHndl.handleKeyDown();
	    };

		break;
	case 2: 
	case 3:
		// recordings
		alert("Recordings - Main.keyDown PlayerState= " + Player.getState());
	    if(Player.getState() == Player.STOPPED) {
	    	// Menu Key
	        this.menuKeyHndl.handleKeyDown();
	    }
	    else {
	    	// Play State Keys
	        this.playStateKeyHndl.handleKeyDown();
	    };

		break;
	case 4:
		alert ("ERROR: Wrong State");
		break;
	};
};

Main.playItem = function (url) {
	alert(Main.state + " playItem for " +Data.getCurrentItem().childs[Main.selectedVideo].payload.link);
	var start_time = Data.getCurrentItem().childs[Main.selectedVideo].payload.start;
	var duration = Data.getCurrentItem().childs[Main.selectedVideo].payload.dur;
	var now = Display.pluginTime.GetEpochTime();
	document.getElementById("olRecProgressBar").style.display="none";

	switch (this.state) {
	case 1:
		// Live
		Display.setOlTitle(Data.getCurrentItem().childs[Main.selectedVideo].payload.prog);
		Display.setStartStop (start_time, (start_time + duration));
		Player.isLive = true;
		Player.bufferState = 0;
		Player.isRecording = false;
		Player.totalTime = Data.getCurrentItem().childs[Main.selectedVideo].payload.dur * 1000;
//		Display.updateTotalTime(Player.totalTime);
		var digi = new Date((Data.getCurrentItem().childs[Main.selectedVideo].payload.start*1000));
		alert (" Date(): StartTime= " + digi.getHours() + ":" + digi.getMinutes() + ":" + digi.getSeconds());
//		Player.cptOffset = (now - Data.getCurrentItem().childs[Main.selectedVideo].payload.start) * 1000;
		Player.setCurrentPlayTimeOffset((now - Data.getCurrentItem().childs[Main.selectedVideo].payload.start) * 1000);
		Player.OnCurrentPlayTime(0);
		alert ("Live now= " +  now + " StartTime= " + Data.getCurrentItem().childs[Main.selectedVideo].payload.start + " offset= " +Player.cptOffset );
		alert("Live Content= " + Data.getCurrentItem().childs[Main.selectedVideo].title + " dur= " + Data.getCurrentItem().childs[Main.selectedVideo].payload.dur);
	break;
	case 2: 
	case 3:
		Player.setCurrentPlayTimeOffset(0);
//		Player.cptOffset = 0;
		Player.isLive = false;
		Player.isRecording = false;
    	alert(" playItem: now= " + now + " start_time= " + start_time + " dur= " + duration + " (Start + Dur - now)= " + ((start_time + duration) -now));
		if ((now - (start_time + duration)) < 0) {
			// still recording
			alert("*** Still Recording! ***");
			Player.isRecording = true;
			Player.startTime = start_time;
			Player.duration = duration;
			Player.totalTime = Data.getCurrentItem().childs[Main.selectedVideo].payload.dur * 1000;
			document.getElementById("olRecProgressBar").style.display="block";

			Display.updateRecBar(start_time, duration);
		}
		else {
	    	document.getElementById("olRecProgressBar").display="none";
		}
		Display.setOlTitle(Data.getCurrentItem().childs[Main.selectedVideo].title);
		Display.olStartStop = "";
		break;
	};
		
	Player.setVideoURL( Data.getCurrentItem().childs[Main.selectedVideo].payload.link);
	Player.playVideo();
};

Main.selectPageUp = function(up) {
	if (this.selectedVideo == 0) {
		 Main.changeState(0);
		 return;
	};
	
	this.selectedVideo = (this.selectedVideo - (Display.LASTIDX + 1));
    if (this.selectedVideo < 0) {
    	this.selectedVideo = 0;
    }	

    var first_item = this.selectedVideo - Display.currentWindow;
    if (first_item < 0 )
    	first_item = 0;
	alert("selectPageUp: this.selectedVideo= " + this.selectedVideo + " first_item= " + first_item);

    Display.setVideoList(this.selectedVideo, first_item);
};

Main.selectPageDown = function(down) {
    this.selectedVideo = (this.selectedVideo + Display.LASTIDX + 1);
    
    if (this.selectedVideo >= Data.getVideoCount()) {
    	this.selectedVideo = Data.getVideoCount() -1;
    }	
    var first_item = this.selectedVideo - Display.currentWindow;

    alert("selectPageDown: this.selectedVideo= " + this.selectedVideo + " first_item= " + first_item);
    Display.setVideoList(this.selectedVideo, first_item);
};

Main.nextVideo = function(no) {
    this.selectedVideo = (this.selectedVideo + no) % Data.getVideoCount();	
	alert("nextVideo= " + this.selectedVideo);
};

Main.previousVideo = function(no) {

	this.selectedVideo = (this.selectedVideo - no);
    if (this.selectedVideo < 0) {
        this.selectedVideo += Data.getVideoCount();
    }
	alert("previousVideo= " + this.selectedVideo);

};

Main.selectNextVideo = function(down)
{
    Player.stopVideo();
    Main.nextVideo(1);

//    this.updateCurrentVideo(down);
    Display.setVideoListPosition(this.selectedVideo, down);
};

Main.selectPreviousVideo = function(up)
{
    Player.stopVideo();
    Main.previousVideo(1);

//    this.updateCurrentVideo(up);
    Display.setVideoListPosition(this.selectedVideo, up);
};



Main.setMuteMode = function()
{
    if (this.mute != this.YMUTE)
    {
        var volumeElement = document.getElementById("volumeInfo");
        //Audio.plugin.SetSystemMute(true);
        Audio.plugin.SetUserMute(true);
        document.getElementById("volumeBar").style.backgroundImage = "url(Images/muteBar.png)";
        document.getElementById("volumeIcon").style.backgroundImage = "url(Images/mute.png)";
        widgetAPI.putInnerHTML(volumeElement, "MUTE");
        this.mute = this.YMUTE;
    }
};

Main.noMuteMode = function()
{
    if (this.mute != this.NMUTE)
    {
        Audio.plugin.SetUserMute(false); 
        document.getElementById("volumeBar").style.backgroundImage = "url(Images/volumeBar.png)";
        document.getElementById("volumeIcon").style.backgroundImage = "url(Images/volume.png)";
        Display.setVolume( Audio.getVolume() );
        this.mute = this.NMUTE;
    }
};

Main.muteMode = function()
{
    switch (this.mute)
    {
        case this.NMUTE:
            this.setMuteMode();
            break;
            
        case this.YMUTE:
            this.noMuteMode();
            break;
            
        default:
            alert("ERROR: unexpected mode in muteMode");
            break;
    }
};

// -----------------------------------------------

Main.getKeyCode = function(code) {
	var res = "";
	switch(code) {
        case tvKey.KEY_1:
        	res = "KEY_1";
        	break;
        case tvKey.KEY_2:
        	res = "KEY_2";
        	break;
        case tvKey.KEY_3:
        	res = "KEY_3";
        	break;
        case tvKey.KEY_4:
        	res = "KEY_4";
        	break;
        case tvKey.KEY_5:
        	res = "KEY_5";
        	break;
        case tvKey.KEY_6:
        	res = "KEY_6";
        	break;
        case tvKey.KEY_7:
        	res = "KEY_7";
        	break;
        case tvKey.KEY_8:
        	res = "KEY_8";
        	break;
        case tvKey.KEY_9:
        	res = "KEY_9";
        	break;
        	
        case tvKey.KEY_TOOLS:
        	res = "KEY_TOOLS";
        	break;

        case tvKey.KEY_TOOLS:
        	res = "KEY_TOOLS";
        	break;

        case tvKey.KEY_TOOLS:
        	res = "KEY_TOOLS";
        	break;

        case tvKey.KEY_UP:
        	res = "KEY_UP";
        	break;

        case tvKey.KEY_DOWN:
        	res = "KEY_DOWN";
        	break;

        case tvKey.KEY_LEFT:
        	res = "KEY_LEFT";
        	break;

        case tvKey.KEY_RIGHT:
        	res = "KEY_RIGHT";
        	break;

        case tvKey.KEY_WHEELDOWN:
        	res = "KEY_WHEELDOWN";
        	break;

        case tvKey.KEY_WHEELUP:
        	res = "KEY_WHEELUP";
        	break;

        case tvKey.KEY_ENTER:
        	res = "KEY_ENTER";
        	break;

        case tvKey.KEY_INFO:
        	res = "KEY_INFO";
        	break;

        case tvKey.KEY_EXIT:
        	res = "KEY_EXIT";
        	break;

        case tvKey.KEY_RETURN:
        	res = "KEY_RETURN";
        	break;

        case tvKey.KEY_RED:
        	res = "KEY_RED";
        	break;

        case tvKey.KEY_GREEN:
        	res = "KEY_GREEN";
        	break;

        case tvKey.KEY_YELLOW:
        	res = "KEY_YELLOW";
        	break;

        case tvKey.KEY_BLUE:
        	res = "KEY_BLUE";
        	break;

        case tvKey.KEY_INFOLINK:
        	res = "KEY_INFOLINK";
        	break;

        case tvKey.KEY_RW:
        	res = "KEY_RW";
        	break;

        case tvKey.KEY_PAUSE:
        	res = "KEY_PAUSE";
        	break;

        case tvKey.KEY_FF:
        	res = "KEY_FF";
        	break;

        case tvKey.KEY_PLAY:
        	res = "KEY_PLAY";
        	break;

        case tvKey.KEY_STOP:
        	res = "KEY_STOP";
        	break;

        case tvKey.KEY_EMPTY:
        	res = "KEY_EMPTY";
        	break;

        case tvKey.KEY_PRECH:
        	res = "KEY_PRECH";
        	break;

        case tvKey.KEY_SOURCE:
        	res = "KEY_SOURCE";
        	break;

        case tvKey.KEY_CHLIST:
        	res = "KEY_CHLIST";
        	break;

        case tvKey.KEY_MENU:
        	res = "KEY_MENU";
        	break;

        case tvKey.KEY_WLINK:
        	res = "KEY_WLINK";
        	break;

        case tvKey.KEY_CC:
        	res = "KEY_CC";
        	break;

        case tvKey.KEY_CONTENT:
        	res = "KEY_CONTENT";
        	break;

        case tvKey.KEY_FAVCH:
        	res = "KEY_FAVCH";
        	break;

        case tvKey.KEY_REC:
        	res = "KEY_REC";
        	break;

        case tvKey.KEY_EMODE:
        	res = "KEY_EMODE";
        	break;

        case tvKey.KEY_DMA:
        	res = "KEY_DMA";
        	break;

        case tvKey.KEY_VOL_UP:
        	res = "KEY_VOL_UP";
        	break;

        case tvKey.KEY_VOL_DOWN:
        	res = "KEY_VOL_DOWN";
        	break;

        case tvKey.KEY_PANEL_CH_UP:
        	res = "KEY_PANEL_CH_UP";
        	break;

        case tvKey.KEY_PANEL_CH_DOWN:
        	res = "KEY_PANEL_CH_DOWN";
        	break;

        case tvKey.KEY_PANEL_VOL_UP:
        	res = "KEY_PANEL_VOL_UP";
        	break;

        case tvKey.KEY_PANEL_VOL_DOWN:
        	res = "KEY_PANEL_VOL_DOWN";
        	break;

        case tvKey.KEY_PANEL_ENTER:
        	res = "KEY_PANEL_ENTER";
        	break;

        case tvKey.KEY_PANEL_RETURN:
        	res = "KEY_PANEL_RETURN";
        	break;
       	
        case tvKey.KEY_PANEL_SOURCE:
        	res = "KEY_PANEL_SOURCE";
        	break;

        case tvKey.KEY_PANEL_MENU:
        	res = "KEY_PANEL_MENU";
        	break;

        case tvKey.KEY_PANEL_POWER:
        	res = "KEY_PANEL_POWER";
        	break;
        	

        default:
        	res = "Unknown Key (" + code + ")";
        break;
    }
	return res;
};

//---------------------------------------------------
// PlayState Key Handler
//---------------------------------------------------

function cPlayStateKeyHndl(def_hndl) {
	this.defaultKeyHandler = def_hndl;
	this.handlerName = "PlayStateKeyHanlder";
	alert(this.handlerName + " created");

};


cPlayStateKeyHndl.prototype.handleKeyDown = function () {
    var keyCode = event.keyCode;

    if(Player.getState() == Player.STOPPED) {
    	alert("ERROR: Wrong state - STOPPED");
    	return;
    }

    alert(this.handlerName+": Key pressed: " + Main.getKeyCode(keyCode));
    
    switch(keyCode)
    {
        case tvKey.KEY_1:
        	alert("KEY_1 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(10);
        	break;
        case tvKey.KEY_2:
        	alert("KEY_2 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(20);
        	break;
        case tvKey.KEY_3:
        	alert("KEY_3 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(30);
        	break;
        case tvKey.KEY_4:
        	alert("KEY_4 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(40);
        	break;
        case tvKey.KEY_5:
        	alert("KEY_5 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(50);
        	break;
        case tvKey.KEY_6:
        	alert("KEY_6 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(60);
        	break;
        case tvKey.KEY_7:
        	alert("KEY_7 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(70);
        	break;
        case tvKey.KEY_8:
        	alert("KEY_8 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(80);
        	break;
        case tvKey.KEY_9:
        	alert("KEY_9 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(90);
        	break;
           
        case tvKey.KEY_RIGHT:
        case tvKey.KEY_FF:
            alert("FF");
            Display.showProgress();
            Player.skipForwardVideo();
            break;
        
        case tvKey.KEY_LEFT:
        case tvKey.KEY_RW:
            alert("RW");
            Display.showProgress();
            Player.skipBackwardVideo();
            break;

        case tvKey.KEY_ENTER:
        case tvKey.KEY_PLAY:
        case tvKey.KEY_PANEL_ENTER:
            alert("ENTER");
            if(Player.getState() == Player.PAUSED) {
                Player.resumeVideo();
            }
            Display.showProgress();
            break;
        case tvKey.KEY_RETURN:
        case tvKey.KEY_PANEL_RETURN:
        case tvKey.KEY_STOP:
        	alert("STOP");
//        	Player.setWindow();
        	Player.stopVideo();
            break;           
        case tvKey.KEY_PAUSE:
            alert("PAUSE");
            Player.pauseVideo();
            break;

        case tvKey.KEY_UP:
        case tvKey.KEY_PANEL_VOL_UP:
        case tvKey.KEY_VOL_UP:
            alert("VOL_UP");
        	Display.showVolume();
            if(Main.mute == 0)
                Audio.setRelativeVolume(0);
            break;
            
        case tvKey.KEY_DOWN:
        case tvKey.KEY_PANEL_VOL_DOWN:
        case tvKey.KEY_VOL_DOWN:
            alert("VOL_DOWN");
        	Display.showVolume();
            if(Main.mute == 0)
                Audio.setRelativeVolume(1);
            break;      

        default:
            alert("Calling Default Key Hanlder");
        	this.defaultKeyHandler.handleDefKeyDown(keyCode);
            break;
    }
};


//---------------------------------------------------
// Live Play State Key Handler
//---------------------------------------------------

function cLivePlayStateKeyHndl(def_hndl) {
	this.defaultKeyHandler = def_hndl;
	this.handlerName = "LivePlayStateKeyHanlder";
	alert(this.handlerName + " created");

};


cLivePlayStateKeyHndl.prototype.handleKeyDown = function () {
 var keyCode = event.keyCode;

 if(Player.getState() == Player.STOPPED) {
 	alert("ERROR: Wrong state - STOPPED");
 	return;
 }

 alert(this.handlerName+": Key pressed: " + Main.getKeyCode(keyCode));
 
 switch(keyCode) {
 	case tvKey.KEY_1:
 	case tvKey.KEY_CH_UP:
 		alert("Prog Up");
        Display.showProgress();
 		Player.stopVideo();
 		Main.previousVideo(1);
	 
 		Main.playItem(); 
 		break;

 	case tvKey.KEY_4:
 	case tvKey.KEY_CH_DOWN:
 		alert("Prog Down");
        Display.showProgress();
 		Player.stopVideo();
 		Main.nextVideo(1);
	 
 		Main.playItem(); 
 		break;

     case tvKey.KEY_ENTER:
     case tvKey.KEY_PLAY:
     case tvKey.KEY_PANEL_ENTER:
         alert("ENTER");
         Display.hide();
         Display.showProgress();
         break;
     case tvKey.KEY_LEFT:
     case tvKey.KEY_RETURN:
     case tvKey.KEY_PANEL_RETURN:
     case tvKey.KEY_STOP:
     	alert("STOP");
     	Player.stopVideo();
     	Display.setVideoList(Main.selectedVideo);
     	Display.show();
        break;           
     case tvKey.KEY_PAUSE:
         alert("PAUSE");
         break;

     case tvKey.KEY_UP:
     case tvKey.KEY_PANEL_VOL_UP:
     case tvKey.KEY_VOL_UP:
         alert("VOL_UP");
     	Display.showVolume();
         if(Main.mute == 0)
             Audio.setRelativeVolume(0);
         break;
         
     case tvKey.KEY_DOWN:
     case tvKey.KEY_PANEL_VOL_DOWN:
     case tvKey.KEY_VOL_DOWN:
         alert("VOL_DOWN");
     	Display.showVolume();
         if(Main.mute == 0)
             Audio.setRelativeVolume(1);
         break;      

     default:
     	this.defaultKeyHandler.handleDefKeyDown(keyCode);
         break;
 }
};

//---------------------------------------------------
//Menu Key Handler
//---------------------------------------------------
function cMenuKeyHndl (def_hndl) {
	this.defaultKeyHandler = def_hndl;
	this.handlerName = "MenuKeyHandler";
	alert(this.handlerName + " created");

};

cMenuKeyHndl.prototype.handleKeyDown = function () {
 var keyCode = event.keyCode;
 alert(this.handlerName+": Key pressed: " + Main.getKeyCode(keyCode));
 
 switch(keyCode) {
 
     	
     case tvKey.KEY_RIGHT:
         alert("Right");
         Main.selectPageDown(Main.DOWN);
         break;
     
     case tvKey.KEY_LEFT:
         alert("Left");
         Main.selectPageUp(Main.UP);
         break;

     case tvKey.KEY_ENTER:
     case tvKey.KEY_PLAY:
     case tvKey.KEY_PANEL_ENTER:
         alert("ENTER");
         
     	if (Data.getCurrentItem().childs[Main.selectedVideo].isFolder == true) {
     		alert ("selectFolder= " +Main.selectedVideo);
     		Data.selectFolder(Main.selectedVideo);
     		Main.selectedVideo= 0;
     		Display.setVideoList(Main.selectedVideo);
     	} 
     	else{
     		Display.hide();
        	Display.showProgress();

        	Main.playItem(); 
     	}
        break;

     case tvKey.KEY_EXIT:
     case tvKey.KEY_RETURN:
     case tvKey.KEY_PANEL_RETURN:
    	 if (Data.isRootFolder() == true) {
    		 alert ("root reached");
    		 Main.changeState(0);    		 
    	 }
    	 else {
    		 Main.selectedVideo = Data.folderUp();
    		 alert("folderUp selectedVideo= " + Main.selectedVideo);
    		 Display.setVideoList(Main.selectedVideo);
    	 }
         break;
         

     case tvKey.KEY_DOWN:
         alert("DOWN");
         Main.selectNextVideo(Main.DOWN);
         break;
         
     case tvKey.KEY_UP:
         alert("UP");
         Main.selectPreviousVideo(Main.UP);           
         break;            
         
     default:
     	this.defaultKeyHandler.handleDefKeyDown(keyCode);
         break;
 }
};


//---------------------------------------------------
// Select Menu Key Handler
//---------------------------------------------------
function cSelectMenuKeyHndl (def_hndl) {
	this.defaultKeyHandler = def_hndl;
	this.handlerName = "SelectMenuKeyHandler";
	alert(this.handlerName + " created");

	this.select = 1;
	this.selectMax = 4; // Highest Select Entry
};

cSelectMenuKeyHndl.prototype.handleKeyDown = function () {
    var keyCode = event.keyCode;
    alert(this.handlerName+": Key pressed: " + Main.getKeyCode(keyCode));
    
    switch(keyCode) {
      	
        case tvKey.KEY_ENTER:
        case tvKey.KEY_PLAY:
        case tvKey.KEY_PANEL_ENTER:
            alert("ENTER");
    		alert ("CurSelect= " + this.select);

            Main.changeState (this.select);

        case tvKey.KEY_DOWN:
            Display.unselectItem(document.getElementById("selectItem"+this.select));
            if (++this.select > this.selectMax) 	          	
            	this.select = 1;
            Display.selectItem(document.getElementById("selectItem"+this.select));
            alert("DOWN " +this.select);
            break;
            
        case tvKey.KEY_UP:
            Display.unselectItem(document.getElementById("selectItem"+this.select));

            if (--this.select < 1)
            	this.select = this.selectMax;
            Display.selectItem(document.getElementById("selectItem"+this.select));

            alert("UP "+ this.select);
            break;            
        default:
        	this.defaultKeyHandler.handleDefKeyDown(keyCode);
            break;
    }
};


//---------------------------------------------------
// Default Key Handler
//---------------------------------------------------

function cDefaulKeyHndl() {
	this.handlerName = "DefaultKeyHanlder";
	alert(this.handlerName + " created");
};

cDefaulKeyHndl.prototype.handleDefKeyDown = function (keyCode) {
    alert("cDefaulKeyHndl::handleKeyDown: " + Main.getKeyCode(keyCode));
    
    switch(keyCode) {
        case tvKey.KEY_EXIT:
            alert(this.handlerName +"Exit");
            Player.stopVideo();
            widgetAPI.sendReturnEvent(); 
            break;

        case tvKey.KEY_VOL_UP:
            alert(this.handlerName + "VOL_UP");
        	Display.showVolume();
            if(Main.mute == 0)
                Audio.setRelativeVolume(0);
            break;
            
        case tvKey.KEY_VOL_DOWN:
            alert(this.handlerName + "VOL_DOWN");
        	Display.showVolume();
            if(Main.mute == 0)
                Audio.setRelativeVolume(1);
            break;      
        case tvKey.KEY_MUTE:
            alert(this.handlerName + "MUTE");
            Main.muteMode();
            break;
        default:
            alert(this.handlerName + "Unhandled key");
            break;
    }
};


// ---------------------------------------------
