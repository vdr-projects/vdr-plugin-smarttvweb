var widgetAPI = null;
var tvKey = null;
var pluginObj = null;

try {
	widgetAPI = new Common.API.Widget();
	tvKey = new Common.API.TVKeyValue();
	pluginObj = new Common.API.Plugin();
}
catch (e) {
}

/*
 * Config.deviceType is used to differentiate main devices.
 * Config.deviceType == 0 is a Samsung ES Series Device (2012)
 * Config.deviceType != 0 is currently a Chrome Browser (Only GUI, no Video Playback) 
 * 
 * In order to adjust to other devices:
 *  Config.js: realization of persistent storage for variable "Config.serverUrl" (URL of server plugin)
 * 
 *  Handle KeyCodes: global variable tvKey holds an enum
 *  event.keyCode: is used to get the key pressed 
 *  
 *  Display.putInnerHTML: Samsung specific way to hanle innerHTML 
 *  Display.GetEpochTime: returns the current time (UTC) in seconds
 * 
 *  Audio: Get and Set Volume
 *  Player: All operations to get the video playing
 *   
 */

//var custom = window.deviceapis.customdevice || {};


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
	window.onShow = showHandler;

	Network.init();
    try {
		widgetAPI.sendReadyEvent();    	
		
	}
	catch (e) {
		Config.deviceType = 1;
		tvKey = Main.tvKeys; 

		Main.log("Not a Samsung Smart TV" );
//		Display.showPopup("Not a Samsung Smart TV. Lets see, how far we come");
	}

	Display.init(); 

    this.defKeyHndl = new cDefaulKeyHndl;
    this.playStateKeyHndl = new cPlayStateKeyHndl(this.defKeyHndl);
    this.livePlayStateKeyHndl = new cLivePlayStateKeyHndl(this.defKeyHndl);
    this.menuKeyHndl = new cMenuKeyHndl(this.defKeyHndl);
    this.selectMenuKeyHndl = new cSelectMenuKeyHndl(this.defKeyHndl);

    Main.log (" created KeyHandlers");
    
	Config.init();
};

showHandler = function() {
	NNaviPlugin = document.getElementById("pluginObjectNNavi");
	NNaviPlugin.SetBannerState(2);
	
	pluginObj.unregistKey(tvKey.KEY_VOL_UP);
	pluginObj.unregistKey(tvKey.KEY_VOL_DOWN);
	pluginObj.unregistKey(tvKey.KEY_MUTE);
	pluginObj.unregistKey(tvKey.KEY_PANEL_VOL_UP);
	pluginObj.unregistKey(tvKey.KEY_PANEL_VOL_DOWN);
};


// Called by Config, when done
// TODO: Send sendReadyEvent early and show a splash screen during startup
Main.init = function () {
	Main.log("Main.init()");
    if ( Player.init() && Server.init() && Audio.init()) {
    	Display.setVolume( Audio.getVolume() );

        // Start retrieving data from server
        Server.dataReceivedCallback = function() {
                /* Use video information when it has arrived */
//        		Main.log("Server.dataReceivedCallback");
        		Display.setVideoList(Main.selectedVideo);

                Display.show();
            };

        // Enable key event processing
        this.enableKeys();

        Display.selectItem(document.getElementById("selectItem1"));
        
		document.getElementById("splashScreen").style.display="none";
		
    }
    else {
       Main.log("Failed to initialise");
    }
    /*
     * 
     * Fetch JS file
	xhttp=new XMLHttpRequest();
	xhttp.open("GET","$MANAGER_WIDGET/Common/API/Plugin.js",false);
	xhttp.send("");
	xmlDoc=xhttp.responseText;
	Main.logToServer (xmlDoc);
*/

};

Main.log = function (msg) {
	// alert redirect
	if (Config.deviceType == 0) {
		alert (msg);
	}
	else {
		console.log(msg);
	}
	
};

Main.logToServer = function (msg) {
//	if (Config.serverUrl == "" )
//		return;

	var XHRObj = new XMLHttpRequest();
//    XHRObj.open("POST", Config.serverUrl + "/log", true);
    XHRObj.open("POST", "http://192.168.1.122:8000/log", true);

    XHRObj.send("CLOG: " + msg);
};

Main.onUnload = function()
{
    Player.deinit();
};


Main.changeState = function (state) {
	Main.log("change state: new state= " + state);
	var old_state = this.state;
	this.state = state;
	
	switch (this.state) {
	case 0:
		Main.selectMenuKeyHndl.select = old_state;
		Main.log ("old Select= " + Main.selectMenuKeyHndl.select);
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
        Main.log("fetchVideoList from: " + Config.serverUrl + "/recordings.xml?model=samsung");
    }
    else {
    	Main.logToServer("Using format " + Config.format);
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
	Main.log ("Main.optionsSelected");
};

Main.enableKeys = function() {
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
		Main.log("Live - Main.keyDown PlayerState= " + Player.getState());
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
		Main.log("Recordings - Main.keyDown PlayerState= " + Player.getState());
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
		Main.log ("ERROR: Wrong State");
		break;
	};
};

Main.playItem = function (url) {
	Main.log(Main.state + " playItem for " +Data.getCurrentItem().childs[Main.selectedVideo].payload.link);
	var start_time = Data.getCurrentItem().childs[Main.selectedVideo].payload.start;
	var duration = Data.getCurrentItem().childs[Main.selectedVideo].payload.dur;
	var now = Display.GetEpochTime();
	
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
	    Player.totalTimeStr =Display.durationString(Player.totalTime / 1000.0);

//		Display.updateTotalTime(Player.totalTime);
		var digi = new Date((Data.getCurrentItem().childs[Main.selectedVideo].payload.start*1000));
		Main.log (" Date(): StartTime= " + digi.getHours() + ":" + digi.getMinutes() + ":" + digi.getSeconds());
//		Player.cptOffset = (now - Data.getCurrentItem().childs[Main.selectedVideo].payload.start) * 1000;
		Player.setCurrentPlayTimeOffset((now - Data.getCurrentItem().childs[Main.selectedVideo].payload.start) * 1000);
		Player.OnCurrentPlayTime(0);
		Main.log ("Live now= " +  now + " StartTime= " + Data.getCurrentItem().childs[Main.selectedVideo].payload.start + " offset= " +Player.cptOffset );
		Main.log("Live Content= " + Data.getCurrentItem().childs[Main.selectedVideo].title + " dur= " + Data.getCurrentItem().childs[Main.selectedVideo].payload.dur);
	break;
	case 2: 
	case 3:
		Player.setCurrentPlayTimeOffset(0);
//		Player.cptOffset = 0;
		Player.isLive = false;
		Player.isRecording = false;
    	Main.log(" playItem: now= " + now + " start_time= " + start_time + " dur= " + duration + " (Start + Dur - now)= " + ((start_time + duration) -now));

    	Player.totalTime = Data.getCurrentItem().childs[Main.selectedVideo].payload.dur * 1000;
	    Player.totalTimeStr =Display.durationString(Player.totalTime / 1000.0);

    	if ((now - (start_time + duration)) < 0) {
			// still recording
			Main.log("*** Still Recording! ***");
			Player.isRecording = true;
			Player.startTime = start_time;
			Player.duration = duration;
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
	Main.log("selectPageUp: this.selectedVideo= " + this.selectedVideo + " first_item= " + first_item);

    Display.setVideoList(this.selectedVideo, first_item);
};

Main.selectPageDown = function(down) {
    this.selectedVideo = (this.selectedVideo + Display.LASTIDX + 1);
    
    if (this.selectedVideo >= Data.getVideoCount()) {
    	this.selectedVideo = Data.getVideoCount() -1;
    }	
    var first_item = this.selectedVideo - Display.currentWindow;

    Main.log("selectPageDown: this.selectedVideo= " + this.selectedVideo + " first_item= " + first_item);
    Display.setVideoList(this.selectedVideo, first_item);
};

Main.nextVideo = function(no) {
    this.selectedVideo = (this.selectedVideo + no) % Data.getVideoCount();	
	Main.log("nextVideo= " + this.selectedVideo);
};

Main.previousVideo = function(no) {

	this.selectedVideo = (this.selectedVideo - no);
    if (this.selectedVideo < 0) {
        this.selectedVideo += Data.getVideoCount();
    }
	Main.log("previousVideo= " + this.selectedVideo);

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
            Main.log("ERROR: unexpected mode in muteMode");
            break;
    }
};

// -----------------------------------------------

Main.getKeyCode = function(code) {
	var res = "";
	
	if (Config.deviceType != 0) {
		// Not a Samsung
    	res = "Unknown Key (KeyCode= " + code + ")";
    	return res;
	}
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

Main.tvKeys = {
		KEY_UP :38,
		KEY_DOWN :40,
		KEY_LEFT :37,
		KEY_RIGHT :39,
		KEY_ENTER :13,

		KEY_STOP :27, // ESC
//		KEY_MUTE :27,

		// Un-used keycodes
		KEY_RETURN :88,
		KEY_EXIT :45,
		KEY_RED :108,
		KEY_GREEN :20,
		KEY_YELLOW :21,
		KEY_BLUE :22,
		KEY_RW :69,
		KEY_PAUSE :74,
		KEY_FF :72,
		KEY_PLAY :71,
		KEY_STOP :70,
		KEY_1 :101,
		KEY_2 :98,
		KEY_3 :6,
		KEY_4 :8,
		KEY_5 :9,
		KEY_6 :10,
		KEY_7 :12,
		KEY_8 :13,
		KEY_9 :14,
		KEY_0 :17,

		KEY_PANEL_CH_UP :104,
		KEY_PANEL_CH_DOWN :106,
		KEY_PANEL_VOL_UP :203,
		KEY_PANEL_VOL_DOWN :204,
		KEY_PANEL_ENTER :309,
		KEY_PANEL_SOURCE :612,
		KEY_PANEL_MENU :613,
		KEY_PANEL_POWER :614,

		KEY_POWER :76,
		KEY_VOL_UP :7,
		KEY_VOL_DOWN :11,
		KEY_CH_UP :68,
		KEY_CH_DOWN :65,
		KEY_MTS :655,
		KEY_12 :1057,
		KEY_AD :1039,
		KEY_FF_ :1078,
		KEY_REWIND_ :1080,
		KEY_SLEEP :1097,
		KEY_STEP :1023, 		
		KEY_HOME :1118
	
};


//---------------------------------------------------
// PlayState Key Handler
//---------------------------------------------------

function cPlayStateKeyHndl(def_hndl) {
	this.defaultKeyHandler = def_hndl;
	this.handlerName = "PlayStateKeyHanlder";
	Main.log(this.handlerName + " created");

};


cPlayStateKeyHndl.prototype.handleKeyDown = function () {
    var keyCode = event.keyCode;

    if(Player.getState() == Player.STOPPED) {
    	Main.log("ERROR: Wrong state - STOPPED");
    	return;
    }

    Main.log(this.handlerName+": Key pressed: " + Main.getKeyCode(keyCode));
    
    switch(keyCode)
    {
        case tvKey.KEY_1:
        	Main.log("KEY_1 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(10);
        	break;
        case tvKey.KEY_2:
        	Main.log("KEY_2 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(20);
        	break;
        case tvKey.KEY_3:
        	Main.log("KEY_3 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(30);
        	break;
        case tvKey.KEY_4:
        	Main.log("KEY_4 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(40);
        	break;
        case tvKey.KEY_5:
        	Main.log("KEY_5 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(50);
        	break;
        case tvKey.KEY_6:
        	Main.log("KEY_6 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(60);
        	break;
        case tvKey.KEY_7:
        	Main.log("KEY_7 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(70);
        	break;
        case tvKey.KEY_8:
        	Main.log("KEY_8 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(80);
        	break;
        case tvKey.KEY_9:
        	Main.log("KEY_9 pressed");
        	Display.showProgress();
        	Player.jumpToVideo(90);
        	break;
           
        case tvKey.KEY_FF:
        case tvKey.KEY_RIGHT:
            Main.log("Right: Skip Forward");
            Display.showProgress();
            Player.skipForwardVideo();
            break;
        
        case tvKey.KEY_RW:
        case tvKey.KEY_LEFT:
            Main.log("Left: Skip Backward");
            Display.showProgress();
            Player.skipBackwardVideo();
            break;

/* Works only for progressive streams, not Adaptive HTTP */
/*        case tvKey.KEY_FF:
            Main.log("FF");
            Display.showProgress();
            Player.fastForwardVideo();

            break;
        case tvKey.KEY_RW:
            Main.log("RW");
            Display.showProgress();
            Player.RewindVideo();
            break;
*/           
        case tvKey.KEY_ENTER:
        case tvKey.KEY_PLAY:
        case tvKey.KEY_PANEL_ENTER:
            Main.log("ENTER");
            if(Player.getState() == Player.PAUSED) {
                Player.resumeVideo();
            }
            Player.ResetTrickPlay();
            Display.showProgress();
            break;
        case tvKey.KEY_RETURN:
        case tvKey.KEY_PANEL_RETURN:
        case tvKey.KEY_STOP:
        	Main.log("STOP");
//        	Player.setWindow();
        	Player.stopVideo();
			widgetAPI.blockNavigation(event);

            break;           
        case tvKey.KEY_PAUSE:
            Main.log("PAUSE");
            Player.pauseVideo();
            break;

/*        case tvKey.KEY_UP:
        case tvKey.KEY_PANEL_VOL_UP:
        case tvKey.KEY_VOL_UP:
            Main.log("VOL_UP");
        	Display.showVolume();
            if(Main.mute == 0)
                Audio.setRelativeVolume(0);
            break;
            
        case tvKey.KEY_DOWN:
        case tvKey.KEY_PANEL_VOL_DOWN:
        case tvKey.KEY_VOL_DOWN:
            Main.log("VOL_DOWN");
        	Display.showVolume();
            if(Main.mute == 0)
                Audio.setRelativeVolume(1);
            break;      
*/
        default:
            Main.log("Calling Default Key Hanlder");
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
	Main.log(this.handlerName + " created");

};


cLivePlayStateKeyHndl.prototype.handleKeyDown = function () {
 var keyCode = event.keyCode;

 if(Player.getState() == Player.STOPPED) {
 	Main.log("ERROR: Wrong state - STOPPED");
 	return;
 }

 Main.log(this.handlerName+": Key pressed: " + Main.getKeyCode(keyCode));
 
 switch(keyCode) {
 	case tvKey.KEY_1:
 	case tvKey.KEY_CH_UP:
 		Main.log("Prog Up");
        Display.showProgress();
 		Player.stopVideo();
 		Main.previousVideo(1);
	 
 		Main.playItem(); 
 		break;

 	case tvKey.KEY_4:
 	case tvKey.KEY_CH_DOWN:
 		Main.log("Prog Down");
        Display.showProgress();
 		Player.stopVideo();
 		Main.nextVideo(1);
	 
 		Main.playItem(); 
 		break;

     case tvKey.KEY_ENTER:
     case tvKey.KEY_PLAY:
     case tvKey.KEY_PANEL_ENTER:
         Main.log("ENTER");
         Display.hide();
         Display.showProgress();
         break;
     case tvKey.KEY_LEFT:
     case tvKey.KEY_RETURN:
     case tvKey.KEY_PANEL_RETURN:
     case tvKey.KEY_STOP:
     	Main.log("STOP");
     	Player.stopVideo();
     	Display.setVideoList(Main.selectedVideo);
     	Display.show();
		widgetAPI.blockNavigation(event);

        break;           
     case tvKey.KEY_PAUSE:
         Main.log("PAUSE");
         break;

/*     case tvKey.KEY_UP:
     case tvKey.KEY_PANEL_VOL_UP:
     case tvKey.KEY_VOL_UP:
         Main.log("VOL_UP");
     	Display.showVolume();
         if(Main.mute == 0)
             Audio.setRelativeVolume(0);
         break;
         
     case tvKey.KEY_DOWN:
     case tvKey.KEY_PANEL_VOL_DOWN:
     case tvKey.KEY_VOL_DOWN:
         Main.log("VOL_DOWN");
     	Display.showVolume();
         if(Main.mute == 0)
             Audio.setRelativeVolume(1);
         break;      
*/
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
	Main.log(this.handlerName + " created");

};

cMenuKeyHndl.prototype.handleKeyDown = function () {
 var keyCode = event.keyCode;
 Main.log(this.handlerName+": Key pressed: " + Main.getKeyCode(keyCode));
 
 switch(keyCode) {
 
     	
     case tvKey.KEY_RIGHT:
         Main.log("Right");
         Main.selectPageDown(Main.DOWN);
         break;
     
     case tvKey.KEY_LEFT:
         Main.log("Left");
         Main.selectPageUp(Main.UP);
         break;

     case tvKey.KEY_ENTER:
     case tvKey.KEY_PLAY:
     case tvKey.KEY_PANEL_ENTER:
         Main.log("ENTER");
         
     	if (Data.getCurrentItem().childs[Main.selectedVideo].isFolder == true) {
     		Main.log ("selectFolder= " +Main.selectedVideo);
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

//     case tvKey.KEY_EXIT:
     case tvKey.KEY_RETURN:
     case tvKey.KEY_PANEL_RETURN:
    	 if (Data.isRootFolder() == true) {
    		 Main.log ("root reached");
    		 Main.changeState(0);    		 
    	 }
    	 else {
    		 Main.selectedVideo = Data.folderUp();
    		 Main.log("folderUp selectedVideo= " + Main.selectedVideo);
    		 Display.setVideoList(Main.selectedVideo);
    	 }
    	 widgetAPI.blockNavigation(event);

         break;
     case tvKey.KEY_DOWN:
         Main.log("DOWN");
         Main.selectNextVideo(Main.DOWN);
         break;
         
     case tvKey.KEY_UP:
         Main.log("UP");
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
	Main.log(this.handlerName + " created");

	this.select = 1;
	this.selectMax = 4; // Highest Select Entry
};

cSelectMenuKeyHndl.prototype.handleKeyDown = function () {
    var keyCode = event.keyCode;
    Main.log(this.handlerName+": Key pressed: " + Main.getKeyCode(keyCode));
    
    switch(keyCode) {
    case tvKey.KEY_1:
    	Main.log("KEY_1 pressed");
    	this.select = 1;
        Main.changeState (this.select);
    	break;
    case tvKey.KEY_2:
    	Main.log("KEY_2 pressed");
    	this.select = 2;
        Main.changeState (this.select);

        break;
    case tvKey.KEY_3:
    	Main.log("KEY_3 pressed");
    	this.select = 3;
        Main.changeState (this.select);

    	break;
    case tvKey.KEY_4:
    	Main.log("KEY_4 pressed");
    	this.select = 4;
        Main.changeState (this.select);
    	break;
    	
        case tvKey.KEY_ENTER:
        case tvKey.KEY_PLAY:
        case tvKey.KEY_PANEL_ENTER:
            Main.log("ENTER");
    		Main.log ("CurSelect= " + this.select);

            Main.changeState (this.select);

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


//---------------------------------------------------
// Default Key Handler
//---------------------------------------------------

function cDefaulKeyHndl() {
	this.handlerName = "DefaultKeyHanlder";
	Main.log(this.handlerName + " created");
};

cDefaulKeyHndl.prototype.handleDefKeyDown = function (keyCode) {
    Main.log("cDefaulKeyHndl::handleKeyDown: " + Main.getKeyCode(keyCode));
    
    switch(keyCode) {
        case tvKey.KEY_EXIT:
        	Main.log(this.handlerName +"Exit");
        	if (Main.state != 0) {
                Player.stopVideo();
                Main.changeState(0);
                widgetAPI.blockNavigation(event);
        	}
        	else {
                widgetAPI.sendReturnEvent(); 
        		
        	}
            break;

/*        case tvKey.KEY_VOL_UP:
            Main.log(this.handlerName + "VOL_UP");
        	Display.showVolume();
            if(Main.mute == 0)
                Audio.setRelativeVolume(0);
            break;
            
        case tvKey.KEY_VOL_DOWN:
            Main.log(this.handlerName + "VOL_DOWN");
        	Display.showVolume();
            if(Main.mute == 0)
                Audio.setRelativeVolume(1);
            break;      
        case tvKey.KEY_MUTE:
            Main.log(this.handlerName + "MUTE");
            Main.muteMode();
            break;
*/
        default:
            Main.log(this.handlerName + "Unhandled key");
            break;
    }
};


// ---------------------------------------------
