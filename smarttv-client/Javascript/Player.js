/*
 * This module only works with the Samsung Media Players. For other player objects, the code need to be adjusted
 */

var Player =
{
    plugin : null,
    isLive : false,
    isRecording : false,
    
    startTime : 0,
    duration : 0,
    
    state : 0,
    cptOffset  : 0,  // millis
    curPlayTime : 0, // millis
    totalTime : -1,  // millis
    
    curPlayTimeStr : "00:00:00", // millis
    totalTimeStr : "",
    stopCallback : null,    /* Callback function to be set by client */
    errorCallback : null,
    originalSource : null,
    
    bufferState : 0,     // buffer state in %
    
    trickPlaySpeed : 1, // Multiple of 2 only.
    trickPlayDirection : 1,

    STOPPED : 0,
    PLAYING : 1,
    PAUSED : 2,  
    FORWARD : 3,
    REWIND : 4
};

Player.init = function() {
    var success = true;
          Main.log("success vale :  " + success);    
    this.state = this.STOPPED;
    
    this.plugin = document.getElementById("pluginPlayer");

/*    var pl_version = "";
    try {
    	pl_version = this.plugin.GetPlayerVersion();
    }
    catch (e) {
    	Main.logToServer("Error while getting player version: " +e);
    }
    Main.logToServer("PlayerVersion= " + pl_version);
*/    
    if (!this.plugin)
    {
          Main.log("success vale this.plugin :  " + success);    
         success = false;
    }

//    var vermsg = this.plugin.GetPlayerVersion();
//    Main.log ("player plugin version: " +vermsg);
   
    this.plugin.OnCurrentPlayTime = 'Player.OnCurrentPlayTime';
    this.plugin.OnStreamInfoReady = 'Player.OnStreamInfoReady';
    this.plugin.OnBufferingStart = 'Player.onBufferingStart';
    this.plugin.OnBufferingProgress = 'Player.onBufferingProgress';
    this.plugin.OnBufferingComplete = 'Player.onBufferingComplete';           
    this.plugin.OnConnectionFailed = 'Player.OnConnectionFailed'; // fails to connect to the streaming server
    this.plugin.OnStreamNotFound = 'Player.OnStreamNotFound'; // 404 file not found   
    this.plugin.OnNetworkDisconnected = 'Player.OnNetworkDisconnected'; //  when the ethernet is disconnected or the streaming server stops supporting the content in the middle of streaming.
    this.plugin.OnRenderingComplete = 'Player.OnRenderingComplete';
    
    Main.log("success= " + success);       
    return success;
};

Player.deinit = function()
{
      Main.log("Player deinit !!! " );       
      
      if (this.plugin)
      {
            this.plugin.Stop();
      }
};

Player.setWindow = function() {
//    this.plugin.SetDisplayArea(458, 58, 472, 270);
};

Player.setFullscreen = function() {
    this.plugin.SetDisplayArea(0, 0, 960, 540);
};

Player.setBuffer = function (btr){
	var res = true;
	var buffer_byte = (Config.totalBufferDuration * Config.tgtBufferBitrate) / 8.0;

	Main.logToServer("Seting TotalBufferSize to " + Math.round(buffer_byte) +"Byte dur= " +Config.totalBufferDuration + "sec init_buffer_perc= " +Config.initialBuffer +"% pend_buffer_perc= " +Config.pendingBuffer + "% initialTimeOut= " +Config.initialTimeOut + "sec");
	
	//The SetTotalBufferSize function sets the streaming buffer size of media player.
	res = this.plugin.SetTotalBufferSize(Math.round(buffer_byte));
	if (res == false) {
		Display.showPopup("SetTotalBufferSize(" + Math.round(buffer_byte) +") returns error");
		Main.logToServer("SetTotalBufferSize(" + Math.round(buffer_byte) +") returns error");
	}
  
	// The SetInitialBuffer function sets the first buffering size as percentage of buffer size before starting playback.
	res = this.plugin.SetInitialBuffer(Math.round( buffer_byte * Config.initialBuffer/ 100.0));
	if (res == false) {
		Display.showPopup("SetInitialBuffer(" + Math.round(buffer_byte * Config.initialBuffer/ 100.0) +") returns error");
		Main.logToServer("SetInitialBuffer(" + Math.round(buffer_byte * Config.initialBuffer/ 100.0) +") returns error");
	}	
	//he SetInitialTimeOut function sets the maximum time out value for initial buffering before starting playback.
	res = this.plugin.SetInitialTimeOut(Config.initialTimeOut);
	if (res == false) {
		Display.showPopup("SetInitialTimeOut(" + 2 +") returns error");
		Main.logToServer("SetInitialTimeOut(" + 2 +") returns error");
	}

	// The SetPendingBuffer function sets the size of a buffer as percentage of total buffer size that media player goes out from buffering status.
	res = this.plugin.SetPendingBuffer(Math.round(buffer_byte * Config.pendingBuffer /100.0)); 
	if (res == false) {
		Display.showPopup("SetPendingBuffer(" + Math.round(buffer_byte * Config.pendingBuffer /100.0) +") returns error");
		Main.logToServer("SetPendingBuffer(" + Math.round(buffer_byte * Config.pendingBuffer /100.0) +") returns error");
	}

};

Player.setVideoURL = function(url) {
    this.url = url;
    Main.log("URL = " + this.url);
};

Player.setCurrentPlayTimeOffset = function(val) {
	// val in milli sec
	this.cptOffset = val;
//	Display.showPopup("CurrentPlayTimeOffset= " + this.cptOffset);
};

Player.playVideo = function() {
	if (Config.deviceType != 0) {
		Display.showPopup ("Only supported for TVs");
		return;
	}
    if (this.url == null) {
        Main.log("No videos to play");
    }
    else
    {
    	
//    	Player.curPlayTime = 0;
    	Display.updatePlayTime();

        Display.status("Play");
    	Display.showStatus();
    	Display.showProgress();
        this.state = this.PLAYING;
        
        if (this.plugin.InitPlayer(this.url) == false)
        	Display.showPopup("InitPlayer returns false");

        Player.setBuffer(15000000.0);
        Player.ResetTrickPlay();
        
        Main.log ("StartPlayback for " + this.url);
        if (this.plugin.StartPlayback() == false)
        	Display.showPopup("StartPlayback returns false");
        
//        this.plugin.Play( this.url );
        Audio.plugin.SetSystemMute(false); 
    }
};

Player.pauseVideo = function() {
	Display.showProgress();
	Main.logToServer("pauseVideo");

    this.state = this.PAUSED;
    Display.status("Pause");
    var res = this.plugin.Pause();
	if (res == false)
		Display.showPopup("pause ret= " +  ((res == true) ? "True" : "False"));  
};

Player.stopVideo = function() {
	if (this.state != this.STOPPED) {
		this.state = this.STOPPED;
        Display.status("Stop");
        this.plugin.Stop();
        Player.bufferState = 0;
//        Display.setTime(0);

        if (this.stopCallback) {
            this.stopCallback();
        }
    }
    else {
        Main.log("Ignoring stop request, not in correct state");
    }
};

Player.resumeVideo = function() {
	Main.logToServer("resumeVideo");
	Display.showProgress();
    this.state = this.PLAYING;
    Display.status("Play");
    var res = this.plugin.Resume();
	if (res == false)
		Display.showPopup("resume ret= " +  ((res == true) ? "True" : "False"));  

};

Player.jumpToVideo = function(percent) {
	if (this.isLive == true) {
		return;
	}
    Player.bufferState = 0;
	Display.showProgress();
    if (this.state != this.PLAYING) {
    	Main.log ("Player not Playing");
    	return;
    }
	if (this.totalTime == -1 && this.isLive == false) 
		this.totalTime = this.plugin.GetDuration();
	var tgt = Math.round(((percent-2)/100.0) *  this.totalTime/ 1000.0);
	
	Main.log("jumpToVideo= " + percent + "% of " + (this.totalTime/1000) + "sec tgt = " + tgt + "sec curPTime= " + (this.curPlayTime/1000) +"sec");	
//    Display.showPopup("jumpToVideo= " + percent + "% of " + (this.totalTime/1000) + "sec<br>--> tgt = " + tgt + "sec curPTime= " + (this.curPlayTime/1000)+"sec");
	this.plugin.Stop();
	
	Display.showStatus();

	var res = this.plugin.ResumePlay(this.url, tgt );
	if (res == false)
		Display.showPopup("ResumePlay ret= " +  ((res == true) ? "True" : "False"));  
};

Player.skipForwardVideo = function() {
    var res = this.plugin.JumpForward(Config.skipDuration);
    if (res == false) 
    	Display.showPopup("Jump Forward ret= " +  ((res == true) ? "True" : "False"));
};

Player.skipBackwardVideo = function() {
    var res = this.plugin.JumpBackward(Config.skipDuration);
    if (res == false) 
    	Display.showPopup("Jump Backward ret= " +  ((res == true) ? "True" : "False"));
};

Player.fastForwardVideo = function() {
	if (this.trickPlayDirection == 1)
		this.trickPlaySpeed = this.trickPlaySpeed * 2;
	else {
		this.trickPlaySpeed = this.trickPlaySpeed / 2;

		if (this.trickPlaySpeed < 1) {
			this.trickPlaySpeed = 1;
			this.trickPlayDirection = -1;
		}

	}
	
	Main.log("FastForward: Direction= " + ((this.trickPlayDirection == 1) ? "Forward": "Backward") + "trickPlaySpeed= " + this.trickPlaySpeed);
	Main.logToServer("FastForward: Direction= " + ((this.trickPlayDirection == 1) ? "Forward": "Backward") + "trickPlaySpeed= " + this.trickPlaySpeed);
	if (this.plugin.SetPlaybackSpeed(this.trickPlaySpeed * this.trickPlayDirection) == false) {
    	Display.showPopup("trick play returns false. Reset Trick-Play" );	
    	this.trickPlaySpeed = 1;
    	this.trickPlayDirection = 1;
	}

};

Player.RewindVideo = function() {
	if (this.trickPlayDirection == 1) {
		this.trickPlaySpeed = this.trickPlaySpeed / 2;
		if (this.trickPlaySpeed < 1) {
			this.trickPlaySpeed = 1;
			this.trickPlayDirection = 1;
		}
		
	}
	else
		this.trickPlaySpeed = this.trickPlaySpeed * 2;

	if (this.plugin.SetPlaybackSpeed(this.trickPlaySpeed * this.trickPlayDirection) == false) {
    	Display.showPopup("trick play returns false. Reset Trick-Play" );	
    	this.trickPlaySpeed = 1;
    	this.trickPlayDirection = 1;
	}

	Main.log("Rewind: Direction= " + ((this.trickPlayDirection == 1) ? "Forward": "Backward") + "trickPlaySpeed= " + this.trickPlaySpeed);
	Main.logToServer("Rewind: Direction= " + ((this.trickPlayDirection == 1) ? "Forward": "Backward") + "trickPlaySpeed= " + this.trickPlaySpeed);
	if (this.plugin.SetPlaybackSpeed(this.trickPlaySpeed * this.trickPlayDirection) == false) {
    	Display.showPopup("trick play returns false. Reset Trick-Play" );	
    	this.trickPlaySpeed = 1;
    	this.trickPlayDirection = 1;
	}

};

Player.ResetTrickPlay = function() {
	if (this.trickPlaySpeed != 1) {
		this.trickPlaySpeed = 1;
		this.trickPlayDirection = 1;
		Main.log("Reset Trickplay " );
		if (this.plugin.SetPlaybackSpeed(this.trickPlaySpeed * this.trickPlayDirection) == false) {
	    	Display.showPopup("trick play returns false. Reset Trick-Play" );	
	    	this.trickPlaySpeed = 1;
	    	this.trickPlayDirection = 1;
		}
		
	}
};

Player.getState = function() {
    return this.state;
};

// ------------------------------------------------
// Global functions called directly by the player 
//------------------------------------------------

Player.onBufferingStart = function() {
	Main.logToServer("Buffer Start: " + Player.curPlayTime);
	Player.bufferStartTime = new Date().getTime();

	Player.bufferState = 0;
	Display.bufferUpdate();
	// should trigger from here the overlay
	Display.showProgress();
	Display.status("Buffering...");
	Display.showStatus();
};

Player.onBufferingProgress = function(percent)
{
	// should trigger from here the overlay
    Display.status("Buffering:" + percent + "%");

    Player.bufferState = percent;
	Display.bufferUpdate();
	Display.showProgress();
};

Player.onBufferingComplete = function() {
    Display.status("Play");
	Display.hideStatus();

	Main.logToServer("Buffer Completed - Buffering Duration= " + (new Date().getTime() - Player.bufferStartTime) + " ms");

    Player.bufferState = 100;
	Display.bufferUpdate();
	Display.showProgress();
	
    Player.setFullscreen();
    Display.hide();   
    
	Main.logToServer("onBufferingComplete ");
/*	Player.pauseVideo();
	window.setTimeout(Player.resumeVideo, 1000);	*/
};


Player.OnCurrentPlayTime = function(time) {
	Player.curPlayTime = parseInt(time) + parseInt(Player.cptOffset);
	
    // Update the Current Play Progress Bar 
    Display.updateProgressBar();
    
    if (Player.isRecording == true) {
    	Display.updateRecBar(Player.startTime, Player.duration);
    }
    Player.curPlayTimeStr =  Display.durationString(Player.curPlayTime / 1000.0);

    Display.updatePlayTime();
};


Player.OnStreamInfoReady = function() {
    Main.log("*** OnStreamInfoReady ***");
	Main.logToServer("GetCurrentBitrates= " + Player.plugin.GetCurrentBitrates());
	if ((Player.isLive == false) && (Player.isRecording == false)) {
		Player.totalTime = Player.plugin.GetDuration();
	}
//    Player.curPlayTimeStr =  Display.durationString(Player.totalTime / 1000.0);
    Player.totalTimeStr =Display.durationString(Player.totalTime / 1000.0);
    
/*    var height = Player.plugin.GetVideoHeight();
    var width = Player.GetVideoWidth();
    Display.showPopup("Resolution= " + height + " x " +width);
    Main.log("Resolution= " + height + " x " +width);
*/
};

Player.OnRenderingComplete = function() {
	// Do Something
	Player.stopVideo();
};

Player.OnConnectionFailed = function() {
	// fails to connect to the streaming server
	Main.log ("ERROR: Failed to connect to the streaming server");
//	widgetAPI.putInnerHTML(document.getElementById("popup"), "Failed to connect to the streaming server");
	Display.showPopup("Failed to connect to the streaming server");
};

Player.OnStreamNotFound = function() {
// 404 file not found   
	Main.log ("ERROR: Stream Not Found");
//	widgetAPI.putInnerHTML(document.getElementById("popup"), "Stream Not Found");
	Display.showPopup("Stream Not Found");

};

Player.OnNetworkDisconnected = function() {
//  when the ethernet is disconnected or the streaming server stops supporting the content in the middle of streaming.
	Main.log ("ERROR: Lost Stream (Unavailable?)");

//	widgetAPI.putInnerHTML(document.getElementById("popup"), "Lost Stream (Unavailable?)");
	Display.showPopup("Lost Stream (Unavailable?)");
};

