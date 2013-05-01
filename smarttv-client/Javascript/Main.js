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
 *  Display.GetEpochTime: returns the current time (UTC) in seconds
 * 
 *  Player: All operations to get the video playing
 *   
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

    eMAIN : 0, // state Main Select
    eLIVE : 1, // State Live Select Screen / Video Playing 
    eREC : 2, // State Recording Select Screen / Video Playing
    eMED : 3, // State Media Select Screen / Video Playing
    eURLS : 4, // State Urls
    eOPT : 5, // Options
    
    defKeyHndl : null,
    selectMenuKeyHndl : null,
    playStateKeyHndl : null,
    livePlayStateKeyHndl : null,
    menuKeyHndl : null
};

$(document).unload(function(){
	Main.onUnload ();
}); 

Main.onUnload = function() {
	Server.notifyServer("stopped");
    Player.deinit();
};

$(document).ready(function(){
	Main.onLoad ();
}); 

Main.onLoad = function() {

	window.onShow = showHandler;		
	window.onshow = showHandler;		

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

	$.ajaxSetup ({  
        cache: false  
    });  
	Display.init();
    Display.selectItem(document.getElementById("selectItem1"));
	Notify.init();
    Spinner.init();
	Helpbar.init();
	Options.init();

    this.defKeyHndl = new cDefaulKeyHndl;
    this.playStateKeyHndl = new cPlayStateKeyHndl(this.defKeyHndl);
    this.livePlayStateKeyHndl = new cLivePlayStateKeyHndl(this.defKeyHndl);
    this.menuKeyHndl = new cMenuKeyHndl(this.defKeyHndl);
    this.selectMenuKeyHndl = new cSelectMenuKeyHndl(this.defKeyHndl);

	Config.init();
};

showHandler = function() {
	NNaviPlugin = document.getElementById("pluginObjectNNavi");
	NNaviPlugin.SetBannerState(1);
	
	pluginObj.unregistKey(tvKey.KEY_VOL_UP);
	pluginObj.unregistKey(tvKey.KEY_VOL_DOWN);
	pluginObj.unregistKey(tvKey.KEY_MUTE);
	pluginObj.unregistKey(tvKey.KEY_PANEL_VOL_UP);
	pluginObj.unregistKey(tvKey.KEY_PANEL_VOL_DOWN);
};


// Called by Config, when done
Main.init = function () {
	if (Config.debug == true) {
		Main.logToServer = function (msg) {
			if (Config.serverUrl == "" )
				return;

			var XHRObj = new XMLHttpRequest();
			XHRObj.open("POST", Config.serverUrl + "/log", true);
			XHRObj.send("CLOG: " + msg);
		};
	}

	Main.log("Main.init()");
	
	Buttons.init();
    if ( Player.init() && Server.init() ) {

        // Start retrieving data from server
        Server.dataReceivedCallback = function() {
			/* Use video information when it has arrived */
        	Display.setVideoList(Main.selectedVideo, Main.selectedVideo); 
        	Spinner.hide();
            Display.show();

            if (Data.createAccessMap == true) {
            	Data.dumpDirectAccessMap();
            }
            if (Main.state == Main.eLIVE) {
               	Epg.startEpgUpdating();               	
            }
        };

        UrlsFetcher.dataReceivedCallback = function() {
			/* Use video information when it has arrived */
        	Display.setVideoList(Main.selectedVideo, Main.selectedVideo); 
        	Spinner.hide();
            Display.show();
        };
        
        
        // Enable key event processing
        this.enableKeys();
	
    }
    else {
       Main.log("Failed to initialise");
    }

	ClockHandler.start("#selectNow");
	HeartbeatHandler.start();
	
	Server.updateVdrStatus();
	
	DirectAccess.init();
	Config.getWidgetVersion();
	Comm.init();

//	DirectAccess.show();
//	Timers.init();
	//	Display.initOlForRecordings();
    /*
     * Fetch JS file
	 */
/*	if (Config.uploadJsFile != "undefined") {
		Main.logToServer ("Upload: " + Config.uploadJsFile );
		xhttp=new XMLHttpRequest();
		xhttp.open("GET",Config.uploadJsFile,false);
		xhttp.send("");
		xmlDoc=xhttp.responseText;
		Main.logToServer (xmlDoc);
	
	}
*/	
//	 Read widget conf. find the file to log
/*
	xhttp=new XMLHttpRequest();
	xhttp.open("GET","$MANAGER_WIDGET/Common/webapi/1.0/deviceapis.js",false);
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
//replaced, when widget.debug is true
/*	if (Config.serverUrl == "" )
		return;

	var XHRObj = new XMLHttpRequest();
    XHRObj.open("POST", Config.serverUrl + "/log", true);
    XHRObj.send("CLOG: " + msg);
*/
};


Main.testUrls = function () {
	Main.log("################## Main.testUrls");
	Spinner.show();
	UrlsFetcher.autoplay = "6927QNxye6k";
	UrlsFetcher.appendGuid("6927QNxye6k");

};

Main.changeState = function (state) {
	Main.log("change state: OldState= " + this.state + " NewState= " + state);
	var old_state = this.state;

	
	this.state = state;
	
	ClockHandler.stop();
	Epg.stopUpdates();
	
	Server.updateVdrStatus();
	
	switch (this.state) {
	case Main.eMAIN:
		Main.selectMenuKeyHndl.select = old_state;
		
		Main.log ("old Select= " + Main.selectMenuKeyHndl.select);
		Display.resetSelectItems(old_state);
        
		$("#selectScreen").show();
	
		ClockHandler.start("#selectNow");
		Display.hide();
		Data.reset ();
		//TODO: Should reset progress bar as well
		Display.resetVideoList();	
		Display.resetDescription ();
		
		break;
	case Main.eLIVE:
		$("#selectScreen").hide();
		ClockHandler.start("#logoNow");
		Display.show();
		Main.selectedVideo = 0;
		Main.liveSelected();
		break;
	case Main.eREC:
		$("#selectScreen").hide();
		ClockHandler.start("#logoNow");
		Display.show();
		Main.selectedVideo = 0;
		Main.recordingsSelected();
		break;
	case Main.eMED:
		$("#selectScreen").hide();
		ClockHandler.start("#logoNow");
		Display.show();
		Main.selectedVideo = 0;
		Main.mediaSelected();
		break;
	case Main.eURLS:
		$("#selectScreen").hide();
		ClockHandler.start("#logoNow");
		Display.show();
		Main.selectedVideo = 0;
		Main.urlsSelected();

//		window.setTimeout(function() {Main.testUrls (); }, (5*1000));

		break;
		
	case Main.eOPT:
		// Options
//    	Options.init();
		$("#selectScreen").hide();
		Options.show();
		Main.optionsSelected();
		break;
	}
};

Main.liveSelected = function() {
	Server.retries = 0;
    Player.stopCallback = function() {
    	Display.show();
    };
    Player.isLive = true;
    Server.setSort(false);
    Server.errorCallback = Main.serverError;
	Data.createAccessMap = true;
    Spinner.show();
    Server.fetchVideoList(Config.serverUrl + "/channels.xml?channels="+Config.liveChannels); /* Request video information from server */    
};

Main.recordingsSelected = function() {
		
	Server.retries = 0;
    Player.stopCallback = function() {
    	Display.show();
		Data.getCurrentItem().childs[Main.selectedVideo].payload.isnew = "false";
		var res = Display.getDisplayTitle (Data.getCurrentItem().childs[Main.selectedVideo]); 
		Display.setVideoItem(Display.videoList[Display.currentWindow +Display.FIRSTIDX], res);
		Server.saveResume ();    	
    };

    Server.errorCallback = Main.serverError;
    Server.setSort(true);
/*    if (Config.format == "") {
        Server.fetchVideoList(Config.serverUrl + "/recordings.xml?model=samsung"); 
        Main.log("fetchVideoList from: " + Config.serverUrl + "/recordings.xml?model=samsung");
    }
    else {
    	Main.logToServer("Using format " + Config.format);
    	if (Config.format == "")
        	Server.fetchVideoList(Config.serverUrl + "/recordings.xml?model=samsung&has4hd=false"); 
    	else
    		Server.fetchVideoList(Config.serverUrl + "/recordings.xml?model=samsung&has4hd=false&type="+Config.format); 
    }
	*/
    Spinner.show();
	Server.fetchVideoList(Config.serverUrl + "/recordings.xml"); /* Request video information from server */
    Main.log("fetchVideoList from: " + Config.serverUrl + "/recordings.xml");
};


Main.mediaSelected = function() {
	Server.retries = 0;
    Player.stopCallback = function() {
    	// 
    	Display.show();
    };
    Server.errorCallback = function (msg) {
    	Display.showPopup(msg);
    	Main.changeState(0);
    };
    Server.setSort(true);
    Spinner.show();
    Server.fetchVideoList(Config.serverUrl + "/media.xml"); /* Request video information from server */
};

Main.urlsSelected = function() {
	Server.retries = 0;
    Player.stopCallback = function() {
    	// 
    	Display.show();
    };
    Server.errorCallback = function (msg) {
    	Display.showPopup(msg);
    	Main.changeState(0);
    };
    Server.setSort(false);
    Spinner.show();
    UrlsFetcher.fetchUrlList();
};

Main.optionsSelected = function() {
	Main.log ("Main.optionsSelected");
};


Main.serverError = function(errorcode) {
	if (Server.retries < 2) {
		switch (this.state) {
		case this.eLIVE: // live
		    Server.fetchVideoList( Config.serverUrl + "/channels.xml?mode=nodesc"); /* Request video information from server */
			break;
		case this.eRECE: 
		    Server.fetchVideoList( Config.serverUrl + "/recordings.xml?mode=nodesc"); /* Request video information from server */
			break;
		}		
	}
	else {
		Display.showPopup(msg);
		Main.changeState(0);		
	}

};


Main.enableKeys = function() {
	Main.log("Main.enableKeys");
    document.getElementById("anchor").focus();
};

Main.keyDown = function(event) {
event = event || window.event;
	switch (this.state) {
	case 0: 
		// selectView
        this.selectMenuKeyHndl.handleKeyDown(event);
		break;
	case Main.eLIVE: 
		// Live
		Main.log("Live - Main.keyDown PlayerState= " + Player.getState());
	    if(Player.getState() == Player.STOPPED) {
	    	// Menu Key
	        this.menuKeyHndl.handleKeyDown(event);
	    }
	    else {
	    	// Live State Keys
	    	this.livePlayStateKeyHndl.handleKeyDown(event);
	    };

		break;
	case Main.eREC: 
	case Main.eMED:
	case Main.eURLS:
		// recordings
//		Main.log("Recordings - Main.keyDown PlayerState= " + Player.getState());
	    if(Player.getState() == Player.STOPPED) {
	    	// Menu Key
	        this.menuKeyHndl.handleKeyDown(event);
	    }
	    else {
	    	// Play State Keys
	        this.playStateKeyHndl.handleKeyDown(event);
	    };

		break;
	case Main.eOPT:
//		Options.onInput();
//		Main.log ("ERROR: Wrong State");
		break;
	};
};


Main.playItem = function (url) {
	Main.log(Main.state + " playItem for " +Data.getCurrentItem().childs[Main.selectedVideo].payload.link);
	var start_time = Data.getCurrentItem().childs[Main.selectedVideo].payload.start;
	var duration = Data.getCurrentItem().childs[Main.selectedVideo].payload.dur;
	var now = Display.GetEpochTime();
	
//	document.getElementById("olRecProgressBar").style.display="none";
//	Player.mFormat = Player.eUND; // default val
	
	switch (this.state) {
	case Main.eLIVE:
		// Live
		// Check for updates
		Display.hide();
    	Display.showProgress();
    	
		Player.isLive = true;
 
		Display.updateOlForLive (start_time, duration, now);
		Main.log ("Live now= " +  now + " StartTime= " + Data.getCurrentItem().childs[Main.selectedVideo].payload.start + " offset= " +Player.cptOffset );
		Main.log("Live Content= " + Data.getCurrentItem().childs[Main.selectedVideo].title + " dur= " + Data.getCurrentItem().childs[Main.selectedVideo].payload.dur);

		Player.guid = Data.getCurrentItem().childs[Main.selectedVideo].payload.guid;

		Player.setVideoURL( Data.getCurrentItem().childs[Main.selectedVideo].payload.link);
		Player.playVideo(-1);
	break;
	case Main.eREC: 

		var url_ext = "";
		Player.mFormat = Player.ePDL;
//		Server.getResume(Player.guid);
		
    	Main.log(" playItem: now= " + now + " start_time= " + start_time + " dur= " + duration + " (Start + Dur - now)= " + ((start_time + duration) -now));
    	Main.logToServer(" playItem: now= " + now + " start_time= " + start_time + " dur= " + duration + " (Start + Dur - now)= " + ((start_time + duration) -now));

		Player.setDuration();
//thlo    	Player.totalTime = Data.getCurrentItem().childs[Main.selectedVideo].payload.dur * 1000;
//thlo	    Player.totalTimeStr =Display.durationString(Player.totalTime / 1000.0);

	  //thlo
	    if (Config.usePdlForRecordings == false) {	
	    	Main.log("Main.playItem: use AHS for recordings");
	    	Main.logToServer("Main.playItem: use AHS for recordings");
			if ((Data.getCurrentItem().childs[Main.selectedVideo].payload.fps <= 30) && (Data.getCurrentItem().childs[Main.selectedVideo].payload.ispes == "false")) {
				// in case fps is smaller than 30 and ts recording use HLS or HAS
				if (Config.format == "hls") {
					Player.mFormat = Player.eHLS;
					url_ext = "/manifest-seg.m3u8|COMPONENT=HLS";
				}
				Player.mFormat = Player.eHAS;
				if (Config.format == "has") {
					url_ext = "/manifest-seg.mpd|COMPONENT=HAS";
				}
			}
	    }

    	if ((now - (start_time + duration)) < 0) {
			// still recording
			Main.log("*** Still Recording! ***");
			Main.logToServer("*** Still Recording! ***");
			Player.isRecording = true; 
			Player.startTime = start_time;
			Player.duration = duration; // EpgDuration
//			document.getElementById("olRecProgressBar").style.display="block";
			$("#olRecProgressBar").show();
			Display.updateRecBar(start_time, duration);

// New recording in progress handling
			url_ext = "";
			Player.mFormat = Player.ePDL;

/*			if ((Data.getCurrentItem().childs[Main.selectedVideo].payload.fps <= 30) && (Data.getCurrentItem().childs[Main.selectedVideo].payload.ispes == "false")) {
				// HLS only works for framerate smaller 30fps
				// HLS only works for TS streams
				if (Config.format == "hls") {
					Player.mFormat = Player.eHLS;
					url_ext = "/manifest-seg.m3u8|COMPONENT=HLS";
				}
				Player.mFormat = Player.eHAS;
				if (Config.format == "has") {
					url_ext = "/manifest-seg.mpd|COMPONENT=HAS";
				}
			}
*/
		}
		Player.setVideoURL( Data.getCurrentItem().childs[Main.selectedVideo].payload.link + url_ext);
		Player.guid = Data.getCurrentItem().childs[Main.selectedVideo].payload.guid;
		Main.log("Main.playItem - Player.guid= " +Player.guid);

		Display.setOlTitle(Data.getCurrentItem().childs[Main.selectedVideo].title);
//		Main.log("IsNew= " +Data.getCurrentItem().childs[Main.selectedVideo].payload.isnew);
		Player.OnCurrentPlayTime(0);   // updates the HTML elements of the Progressbar 
		
		Buttons.show();
		
		break;
	case Main.eMED:
		Display.hide();
    	Display.showProgress();
		Player.mFormat = Player.ePDL;
    	
    	Main.log(" playItem: now= " + now + " start_time= " + start_time + " dur= " + duration + " (Start + Dur - now)= " + ((start_time + duration) -now));

		Display.setOlTitle(Data.getCurrentItem().childs[Main.selectedVideo].title);

		Player.setVideoURL( Data.getCurrentItem().childs[Main.selectedVideo].payload.link);
		Player.playVideo(-1);

		Player.guid = "unknown";

		break;
	case Main.eURLS:
		Display.hide();
    	Display.showProgress();
		Player.mFormat = Player.ePDL;
    	
    	Main.log(" playItem: now= " + now + " start_time= " + start_time + " dur= " + duration + " (Start + Dur - now)= " + ((start_time + duration) -now));

		Display.setOlTitle(Data.getCurrentItem().childs[Main.selectedVideo].title);

		Main.log("playItem: guid= " + Data.getCurrentItem().childs[Main.selectedVideo].payload.guid);
		UrlsFetcher.getYtVideoUrl( Data.getCurrentItem().childs[Main.selectedVideo].payload.guid);

		break;
	default:
		Main.logToServer("ERROR in Main.playItem: should not be here");
		break;
		};
		
};

Main.selectPageUp = function() {
	Main.previousVideo(Display.getNumberOfVideoListItems());
	
    var first_item = this.selectedVideo - Display.currentWindow;
    if (first_item < 0 )
    	first_item = 0;
	Main.log("selectPageUp: this.selectedVideo= " + this.selectedVideo + " first_item= " + first_item);

    Display.setVideoList(this.selectedVideo, first_item);
};

Main.selectPageDown = function() {
	Main.nextVideo (Display.getNumberOfVideoListItems());

    var first_item = this.selectedVideo - Display.currentWindow;

    Main.log("selectPageDown: this.selectedVideo= " + this.selectedVideo + " first_item= " + first_item + " curWind= " + Display.currentWindow);
    Display.setVideoList(this.selectedVideo, first_item);
};

Main.nextVideo = function(no) {
	// Just move the selectedVideo pointer and ensure wrap around

	// Should I do anything, when no < Data.getVideoCount()?
	if (no > Data.getVideoCount())
		return;
	Main.log("Main.nextVideo: selVid(in)=  " + this.selectedVideo + " no= " + no + " vids= " + Data.getVideoCount() + " (no% Data.getVideoCount())= " +(no% Data.getVideoCount()));
    this.selectedVideo = (this.selectedVideo + (no% Data.getVideoCount())) % Data.getVideoCount();	
	Main.log("Main.nextVideo= " + this.selectedVideo + " no= " + no);
};

Main.previousVideo = function(no) {
// Just move the selectedVideo pointer and ensure wrap around

	// Issue: I deduct a number, which is larger than  videoCount
	// only jumps, which are mod videoCount?
	if (no > Data.getVideoCount())
		return;
	this.selectedVideo = (this.selectedVideo - (no% Data.getVideoCount()));
    if (this.selectedVideo < 0) {
		Main.log("Main.previousVideo: below Zero (" +this.selectedVideo+"), adding " + Data.getVideoCount());
        this.selectedVideo += Data.getVideoCount();
    }
	Main.log("Main.previousVideo= " + this.selectedVideo + " no= " +no);
};

Main.selectNextVideo = function() {
    Player.stopVideo();
    Main.nextVideo(1);

//    this.updateCurrentVideo(down);
    Display.setVideoListPosition(this.selectedVideo, Main.DOWN);
};

Main.selectPreviousVideo = function() {
    Player.stopVideo();
    Main.previousVideo(1);

//    this.updateCurrentVideo(up);
    Display.setVideoListPosition(this.selectedVideo, Main.UP);
};



//---------------------------------------------------
// PlayState Key Handler
//---------------------------------------------------

function cPlayStateKeyHndl(def_hndl) {
	this.defaultKeyHandler = def_hndl;
	this.handlerName = "PlayStateKeyHanlder";
	Main.log(this.handlerName + " created");

};


cPlayStateKeyHndl.prototype.handleKeyDown = function (event) {
    var keyCode = event.keyCode;

    if(Player.getState() == Player.STOPPED) {
    	Main.log("ERROR: Wrong state - STOPPED");
    	return;
    }

    Main.log(this.handlerName+": Key pressed: " + Main.getKeyCode(keyCode));
    Main.logToServer(this.handlerName+": Key pressed: " + Main.getKeyCode(keyCode));
    
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
           
        case tvKey.KEY_RIGHT:
            Main.log("Right: Skip Forward");
            Display.showProgress();
			if (Player.trickPlaySpeed != 1) {
				Notify.showNotify("Trickplay!", true);				
			}
			else
				Player.skipForwardVideo();
            break;
        
        case tvKey.KEY_LEFT:
            Main.log("Left: Skip Backward");
            Display.showProgress();
			if (Player.trickPlaySpeed != 1) {
				Notify.showNotify("Trickplay!", true);				
			}
			else
				Player.skipBackwardVideo();
            break;

/* Works only for progressive streams, not Adaptive HTTP */
        case tvKey.KEY_FF:
            Main.log("FF");
            Display.showProgress();
/*			if (Player.isRecording == true) {
				Notify.showNotify("Recording!!!", true);
			}
			else */
//            if (Player.mFormat != Player.ePDL )
            if (Player.mFormat == Player.eHLS )
				Notify.showNotify("Not supported", true);
			else
				Player.fastForwardVideo();

            break;
        case tvKey.KEY_RW:
            Main.log("RW");
            Display.showProgress();
/*			if (Player.isRecording == true) {
				Notify.showNotify("Recording!!!", true);
			}
			else */
//            if (Player.mFormat != Player.ePDL )
            if (Player.mFormat == Player.eHLS )
				Notify.showNotify("Not supported", true);
			else
				Player.RewindVideo();
            break;
           
        case tvKey.KEY_ENTER:
        case tvKey.KEY_PLAY:
        case tvKey.KEY_PANEL_ENTER:
            Main.log("ENTER");
            if(Player.getState() == Player.PAUSED) {
                Player.resumeVideo();
            }
            if (Player.isInTrickplay() == true) {
                Player.ResetTrickPlay();            	
            }
            else if (Display.isProgressOlShown()) {
            	Player.adjustSkipDuration(0); // reset skip duration to default
        		Display.resetStartStop();
            }
            Display.showProgress();
            break;
        case tvKey.KEY_RETURN:
        case tvKey.KEY_PANEL_RETURN:
        case tvKey.KEY_STOP:
        	Main.log("STOP");
        	Player.stopVideo();
			widgetAPI.blockNavigation(event);

            break;           
        case tvKey.KEY_PAUSE:
            Main.log("PAUSE");
            if(Player.getState() == Player.PAUSED) {
                Player.resumeVideo();
            }
            else {
                Player.pauseVideo();            	
            }
            break;
        case tvKey.KEY_UP:
        	Player.adjustSkipDuration(1);
            Display.showProgress();
        	break;
        case tvKey.KEY_DOWN:
        	Player.adjustSkipDuration(2);
            Display.showProgress();
        	break;
		case tvKey.KEY_INFO:
			Display.showInfo(Main.selectedVideo);
			break;
		case tvKey.KEY_ASPECT:
			Player.toggleAspectRatio();
			break;
		case tvKey.KEY_BLUE:
			Player.nextAudioTrack();
			break;
        case tvKey.KEY_YELLOW:
			Player.nextSubtitleTrack();
        	break;
		break;
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


cLivePlayStateKeyHndl.prototype.handleKeyDown = function (event) {
 var keyCode = event.keyCode;

 if(Player.getState() == Player.STOPPED) {
 	Main.log("ERROR: Wrong state - STOPPED");
 	return;
 }

 Main.log(this.handlerName+": Key pressed: " + Main.getKeyCode(keyCode));
 
 switch(keyCode) {
	case tvKey.KEY_ASPECT:
		Player.toggleAspectRatio();
		break;

 	case tvKey.KEY_0:
		DirectAccess.show("0");
		break;
 	case tvKey.KEY_1:
		DirectAccess.show("1");
		break;
 	case tvKey.KEY_2:
		DirectAccess.show("2");
		break;
 	case tvKey.KEY_3:
		DirectAccess.show("3");
		break;
 	case tvKey.KEY_4:
		DirectAccess.show("4");
		break;
 	case tvKey.KEY_5:
		DirectAccess.show("5");
		break;
 	case tvKey.KEY_6:
		DirectAccess.show("6");
		break;
 	case tvKey.KEY_7:
		DirectAccess.show("7");
		break;
 	case tvKey.KEY_8:
		DirectAccess.show("8");
		break;
 	case tvKey.KEY_9:
		DirectAccess.show("9");
		break;
 	case tvKey.KEY_UP:
 	case tvKey.KEY_CH_UP:
 		Main.log("Prog Up");
        Display.showProgress();
 		Player.stopVideo();

 		// Check, weather I am the last element of a folder. If yes, go one level up
 		if (Main.selectedVideo == (Data.getVideoCount() -1)) {
 			//Last VideoItem, check wrap around or folder fall-down
 			if (Data.isRootFolder() != true) {
// 				Main.selectedVideo = Data.folderUp();
 				var itm = Data.folderUp();
				Main.selectedVideo = itm.id;
 			}
 		}
 		Main.nextVideo(1); // increase and wrap
 		// check, if new element is a folder again
 		if (Data.getCurrentItem().childs[Main.selectedVideo].isFolder == true) {
 			Data.selectFolder(Main.selectedVideo, Main.selectedVideo);
 			Main.selectedVideo= 0;
 		}
// 		Main.nextVideo(1);
 		
 		Main.playItem(); 
 		break;

// 	case tvKey.KEY_4:
 	case tvKey.KEY_DOWN:
 	case tvKey.KEY_CH_DOWN:
 		Main.log("Prog Down");
        Display.showProgress();
 		Player.stopVideo();

 		// check, if I am the first element of a folder
 		// if yes, then one up
 		if (Main.selectedVideo == 0) {
 			//First VideoItem, 
 			if (Data.isRootFolder() != true) {
// 				Main.selectedVideo = Data.folderUp();
 				var itm = Data.folderUp();
				Main.selectedVideo = itm.id;
 			}
 		}
 		Main.previousVideo(1);
 		// check, if new element is a folder again
 		if (Data.getCurrentItem().childs[Main.selectedVideo].isFolder == true) {
 			Data.selectFolder(Main.selectedVideo, Main.selectedVideo);
 			Main.selectedVideo= Data.getVideoCount()-1;
 		}
 			 
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
//     	Display.setVideoList(Main.selectedVideo, Main.selectedVideo- ( Main.selectedVideo % (Display.LASTIDX +1)));
     	//thlo: here
     	
     	if (Data.isRootFolder() != true) {
			Display.addHeadline(Data.getCurrentItem().title);
	     	Display.setVideoList(Main.selectedVideo, Main.selectedVideo- ( Main.selectedVideo % Display.getNumberOfVideoListItems()));
     	}
     	else {
			Display.removeHeadline();
	     	Display.setVideoList(Main.selectedVideo, Main.selectedVideo- ( Main.selectedVideo % Display.getNumberOfVideoListItems()));     		
     	}
     	
     	Display.show();
		widgetAPI.blockNavigation(event);

        break;           
     case tvKey.KEY_PAUSE:
         Main.log("PAUSE");
         break;
     case tvKey.KEY_INFO: 
			Display.showInfo(Main.selectedVideo);
			break;
     case tvKey.KEY_ASPECT:
    	 Player.toggleAspectRatio();
    	 break;
     case tvKey.KEY_BLUE:
    	 Player.nextAudioTrack();
		break;
     case tvKey.KEY_YELLOW:
			Player.nextSubtitleTrack();
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
	Main.log(this.handlerName + " created");

};

cMenuKeyHndl.prototype.handleKeyDown = function (event) {
 var keyCode = event.keyCode;
 
 switch(keyCode) {
 	case tvKey.KEY_0:
		if (Main.state == Main.eLIVE) {
			Main.log("cMenu DirectAccess: keyCode= " + keyCode);
			DirectAccess.show("0");
			}
		break;
 	case tvKey.KEY_1:
		if (Main.state == Main.eLIVE) {
			Main.log("cMenu DirectAccess: keyCode= " + keyCode);
			DirectAccess.show("1");
			}
		break;
 	case tvKey.KEY_2:
		if (Main.state == Main.eLIVE) {
			Main.log("cMenu DirectAccess: keyCode= " + keyCode);
			DirectAccess.show("2");
			}
		break;
 	case tvKey.KEY_3:
		if (Main.state == Main.eLIVE) {
			Main.log("cMenu DirectAccess: keyCode= " + keyCode);
			DirectAccess.show("3");
			}
		break;
 	case tvKey.KEY_4:
		if (Main.state == Main.eLIVE) {
			Main.log("cMenu DirectAccess: keyCode= " + keyCode);
			DirectAccess.show("4");
			}
		break;
 	case tvKey.KEY_5:
		if (Main.state == Main.eLIVE) {
			Main.log("cMenu DirectAccess: keyCode= " + keyCode);
			DirectAccess.show("5");
			}
		break;
 	case tvKey.KEY_6:
		if (Main.state == Main.eLIVE) {
			Main.log("cMenu DirectAccess: keyCode= " + keyCode);
			DirectAccess.show("6");
			}
		break;
 	case tvKey.KEY_7:
		if (Main.state == Main.eLIVE) {
			Main.log("cMenu DirectAccess: keyCode= " + keyCode);
			DirectAccess.show("7");
			}
		break;
 	case tvKey.KEY_8:
		if (Main.state == Main.eLIVE) {
			Main.log("cMenu DirectAccess: keyCode= " + keyCode);
			DirectAccess.show("8");
			}
		break;
 	case tvKey.KEY_9:
		if (Main.state == Main.eLIVE) {
			Main.log("cMenu DirectAccess: keyCode= " + keyCode);
			DirectAccess.show("9");
			}
		break;
 
		
 	case tvKey.KEY_YELLOW:
 		if (Main.state == Main.eURLS) {
 			Buttons.ynShow();
 		}
 		break;
 	case tvKey.KEY_BLUE:
		if (Main.state == Main.eREC) {
			//change sorting
			Spinner.show();
			Data.nextSortType();
			Main.selectedVideo = 0;
			Display.setVideoList(Main.selectedVideo, Main.selectedVideo); 
			Spinner.hide();
		}
 		break;
     	
     case tvKey.KEY_RIGHT:
         Main.log("Right");
         Main.selectPageDown();
         break;
     
     case tvKey.KEY_LEFT:
         Main.log("Left");
         Main.selectPageUp();
         break;
     case tvKey.KEY_DOWN:
         Main.log("DOWN");
         Main.selectNextVideo();
         break;
         
     case tvKey.KEY_UP:
         Main.log("UP");
         Main.selectPreviousVideo();           
         break;            

     case tvKey.KEY_ENTER:
     case tvKey.KEY_PLAY:
     case tvKey.KEY_PANEL_ENTER:
         Main.log("ENTER");
         
     	if (Data.getCurrentItem().childs[Main.selectedVideo].isFolder == true) {
     		Main.log ("selectFolder= " +Main.selectedVideo);
     		Data.selectFolder(Main.selectedVideo, (Main.selectedVideo - Display.currentWindow));
     		Main.selectedVideo= 0;
			Display.addHeadline(Data.getCurrentItem().title);
     		Display.setVideoList(Main.selectedVideo, Main.selectedVideo); // thlo

     	} 
     	else{
/*     		Display.hide();
        	Display.showProgress();
*/
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
//    		 Main.selectedVideo = Data.folderUp();
    		 var itm = Data.folderUp();
			 Main.selectedVideo = itm.id;
    		 Main.log("folderUp selectedVideo= " + Main.selectedVideo);
			if (Data.isRootFolder() == true) {
				Display.removeHeadline();
			} 
			else {
				Display.addHeadline(Data.getCurrentItem().title);
			}
    		 Display.setVideoList(Main.selectedVideo, itm.first); // thlo
    	 }
    	 widgetAPI.blockNavigation(event);

         break;
         
     default:
		Main.log(this.handlerName+": Key pressed: " + Main.getKeyCode(keyCode));
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
	this.selectMax = 5; // Highest Select Entry
};

cSelectMenuKeyHndl.prototype.handleKeyDown = function (event) {
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

    case tvKey.KEY_5:
    	Main.log("KEY_5 pressed");
    	this.select = 5;
        Main.changeState (this.select);
    	break;

    case tvKey.KEY_ENTER:
    case tvKey.KEY_PLAY:
    case tvKey.KEY_PANEL_ENTER:
    	Main.log("ENTER");
    	Main.log ("CurSelect= " + this.select);

    	Main.changeState (this.select);

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
        		Server.notifyServer("stopped");
                widgetAPI.sendReturnEvent(); 
        		
        	}
            break;
        default:
            Main.log(this.handlerName + "Unhandled key");
            break;
    }
};


// ---------------------------------------------
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
		KEY_1 :49,
		KEY_2 :50,
		KEY_3 :51,
		KEY_4 :52,
		KEY_5 :53,
		KEY_6 :54,
		KEY_7 :55,
		KEY_8 :56,
		KEY_9 :57,
		KEY_0 :48,

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

  