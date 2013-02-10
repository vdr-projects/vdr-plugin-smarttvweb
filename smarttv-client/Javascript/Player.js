/*
 * This module only works with the Samsung Media Players. For other player objects, the code need to be adjusted
 */

var Player =
{
    plugin : null,
    pluginBD : null,
    mFrontPanel : null,
    isLive : false,
    isRecording : false,
    mFormat : 0,
    eUND : 0, // undefined
    ePDL : 1,
    eHLS : 2,
    eHAS : 3,
    
    
    url : "",
    guid : "unknown",
    startTime : 0,
    duration : 0,
 
    resumePos : -1,
    state : 0,
    cptOffset  : 0,  // millis
    curPlayTime : 0, // millis
    totalTime : -1,  // millis
    
    skipDuration : 30,
    
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
    REWIND : 4,
	
	aspectRatio :0,
	
	eASP16to9 :0,
	eASP4to3 :1,
	
	bufferStartTime : 0,
	requestStartTime :0
};

// This function is called when Stop was pressed
Player.resetAtStop = function () {
	// the default is for plain on-demand recording
	// should be called with the Diplayer overlay Reset
	
	if (this.state != Player.STOPPED) {
		Main.log("ERROR in Player.reset: should not be here");
		return;
	}
	this.aspectRatio = this.eASP16to9;
	this.bufferState = 0;
	
	Player.ResetTrickPlay(); // is the GUI resetted as well?
	Player.adjustSkipDuration (0);

	this.cptOffset  = 0;
	this.curPlayTime = 0;
	this.totalTime = -1;  // negative on purpose
	this.totalTimeStr = "0:00:00";
	this.curPlayTimeStr = "0:00:00";

	this.isLive =false;
    this.isRecording = false;
    this.mFormat =Player.eUND;	
	
	};

Player.toggleAspectRatio = function () {
	if (this.aspectRatio == this.eASP16to9) {
		// Do 4 to 3
		this.plugin.SetDisplayArea(120, 0, 720, 540);
		// 4/3 = x/540
		this.aspectRatio = this.eASP4to3;
		Main.logToServer("Player.toggleAspectRatio: 4 by 3 Now");
	}
	else {
		// do 16 to 9
		Player.setFullscreen();
		this.aspectRatio = this.eASP16to9;
		Main.logToServer("Player.toggleAspectRatio: 16 by 9 Now");
	}
};

Player.init = function() {
    var success = true;
          Main.log("success vale :  " + success);    
    this.state = this.STOPPED;
    
    this.plugin = document.getElementById("pluginPlayer");
    this.pluginBD = document.getElementById("pluginBD");
    try {
        this.pluginBD.DisplayVFD_Show(0101); // Stop    	
    }
    catch (e) {
    	
    }
    
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
    this.skipDuration = Config.skipDuration; // Use Config default also here
    
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

Player.setBuffer = function (){
	var res = true;
	var buffer_byte = (Config.totalBufferDuration * Config.tgtBufferBitrate) / 8.0;
	var initial_buf = Config.initialBuffer;
	if (Player.isLive == true)
		initial_buf = initial_buf *4;
	
	Main.logToServer("Seting TotalBufferSize to " + Math.round(buffer_byte) +"Byte dur= " +Config.totalBufferDuration + "sec init_buffer_perc= " +initial_buf +"% pend_buffer_perc= " +Config.pendingBuffer + "% initialTimeOut= " +Config.initialTimeOut + "sec");
	
	//The SetTotalBufferSize function sets the streaming buffer size of media player.
	res = this.plugin.SetTotalBufferSize(Math.round(buffer_byte));
	if (res == false) {
		Display.showPopup("SetTotalBufferSize(" + Math.round(buffer_byte) +") returns error");
		Main.logToServer("SetTotalBufferSize(" + Math.round(buffer_byte) +") returns error");
	}
  
	// The SetInitialBuffer function sets the first buffering size as percentage of buffer size before starting playback.
	res = this.plugin.SetInitialBuffer(Math.round( buffer_byte * initial_buf/ 100.0));
	if (res == false) {
		Display.showPopup("SetInitialBuffer(" + Math.round(buffer_byte * initial_buf/ 100.0) +") returns error");
		Main.logToServer("SetInitialBuffer(" + Math.round(buffer_byte * initial_buf/ 100.0) +") returns error");
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
    Main.log("Player.setVideoURL: URL = " + this.url);
};


Player.setCurrentPlayTimeOffset = function(val) {
	// val in milli sec
	this.cptOffset = val;
//	Display.showPopup("CurrentPlayTimeOffset= " + this.cptOffset);
};

Player.playVideo = function(resume_pos) {
	if (Config.deviceType != 0) {
		Display.showPopup ("Only supported for TVs");
		return;
	}
    if (this.url == null) {
        Main.log("No videos to play");
    }
    else {
    	Player.bufferState = 0;
    	Display.bufferUpdate();

    	Spinner.show();

//    	Player.curPlayTime = 0;
    	Display.updatePlayTime();

        Display.status("Play");
    	Display.hideStatus();
//    	Display.showStatus();

    	Display.showProgress();
        this.state = this.PLAYING;
        
        Player.setBuffer();
        Player.ResetTrickPlay();
        Player.skipDuration = Config.skipDuration; // reset

        Main.log ("Player.playVideo: StartPlayback for " + this.url);

        this.requestStartTime = new Date().getTime();
        if (Player.isRecording == false) {
            if (resume_pos == -1)
            	this.plugin.Play( this.url );
            else {
            	Main.logToServer ("Player.playVideo: resume_pos= " +resume_pos);
				this.plugin.ResumePlay(this.url, resume_pos);        
            }
        }
        else {
        	if (resume_pos == -1) 
        		resume_pos = 0;
			Player.setCurrentPlayTimeOffset(resume_pos * 1000.0);
			this.plugin.Play( this.url+ "?time=" + resume_pos );
			Main.logToServer("Player.play with ?time=" + resume_pos);        
        }

        if ((this.mFormat != this.ePDL) && (this.isLive == false)){
        	Notify.showNotify("No Trickplay", true);
        }
        Audio.plugin.SetSystemMute(false); 
        pluginObj.setOffScreenSaver();
        this.pluginBD.DisplayVFD_Show(0100); // Play
    }
};

Player.pauseVideo = function() {
	Display.showProgress();
	Main.logToServer("pauseVideo");
	
    this.state = this.PAUSED;
    Display.status("Pause");
	Display.showStatus();
    var res = this.plugin.Pause();
	if (res == false)
		Display.showPopup("pause ret= " +  ((res == true) ? "True" : "False"));  
	pluginObj.setOnScreenSaver();
    this.pluginBD.DisplayVFD_Show(0102); // Pause
};

Player.stopVideo = function() {
	if (this.state != this.STOPPED) {
		this.state = this.STOPPED;
        Display.status("Stop");
        this.plugin.Stop();
        
//        Display.setTime(0);

        if (this.stopCallback) {
        	Main.log(" StopCallback");
            this.stopCallback();
        }
        
        // Cleanup
		Display.resetAtStop();
        
        Spinner.hide();
		pluginObj.setOnScreenSaver();
	    this.pluginBD.DisplayVFD_Show(0101); // Stop
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
	Display.hideStatus();
    var res = this.plugin.Resume();
	if (res == false)
		Display.showPopup("resume ret= " +  ((res == true) ? "True" : "False"));  
	pluginObj.setOffScreenSaver();
    this.pluginBD.DisplayVFD_Show(0100); // Play
};

Player.jumpToVideo = function(percent) {
	if (this.isLive == true) {
		return;
	}
    if (this.state != this.PLAYING) {
    	Main.logToServer ("Player.jumpToVideo: Player not Playing");
    	return;
    }
	Spinner.show();
    Player.bufferState = 0;
	Display.showProgress();

	//TODO: the totalTime should be set already
	if (this.totalTime == -1 && this.isLive == false) 
		this.totalTime = this.plugin.GetDuration();
	var tgt = Math.round(((percent-2)/100.0) *  this.totalTime/ 1000.0);
	var res = false;

	this.requestStartTime = new Date().getTime();

	if (Player.isRecording == false) {
		if (tgt > (Player.curPlayTime/1000.0)) 
			res = this.plugin.JumpForward(tgt - (Player.curPlayTime/1000.0));
		else 
			res = this.plugin.JumpBackward( (Player.curPlayTime/1000.0)- tgt);
	}
	else {
		this.plugin.Stop();
		var old = Player.curPlayTime;

		Player.setCurrentPlayTimeOffset(tgt * 1000.0);
		res = this.plugin.Play( this.url+ "?time=" + tgt );
		Main.logToServer("Player.play with ?time=" + tgt);
		if (res == false)
			Player.setCurrentPlayTimeOffset(old);
			
		// set currentPlayTimeOffsert to tgt
		// set new url with time
		// play
	}
	Main.logToServer("Player.jumpToVideo: jumpTo= " + percent + "% of " + (this.totalTime/1000) + "sec tgt = " + tgt + "sec cpt= " + (this.curPlayTime/1000) +"sec" + " res = " + res);	
//    Display.showPopup("jumpToVideo= " + percent + "% of " + (this.totalTime/1000) + "sec<br>--> tgt = " + tgt + "sec curPTime= " + (this.curPlayTime/1000)+"sec");
//	Display.showStatus();

	//	this.plugin.Stop();
//	var res = this.plugin.ResumePlay(this.url, tgt );
	if (res == false)
		Display.showPopup("ResumePlay ret= " +  ((res == true) ? "True" : "False"));  
};

Player.skipForwardVideo = function() {
	this.requestStartTime = new Date().getTime();
	Display.showProgress();
	var res = false;
	if (Player.isRecording == false)
		res = this.plugin.JumpForward(Player.skipDuration);
	else {
		this.bufferState = 0;
		this.plugin.Stop();
		var old = Player.curPlayTime;
		var tgt = (Player.curPlayTime/1000.0) + Player.skipDuration;
		Player.setCurrentPlayTimeOffset(tgt * 1000.0);
		res = this.plugin.Play( this.url+ "?time=" + tgt );		
		Main.logToServer("Player.skipForwardVideo with ?time=" + tgt);
		if (res == false)
			Player.setCurrentPlayTimeOffset(old);			
	}
    if (res == false) {
    	Display.showPopup("Jump Forward ret= " +  ((res == true) ? "True" : "False"));    	
    }
};

Player.skipBackwardVideo = function() {
	this.requestStartTime = new Date().getTime();
	Display.showProgress();
	var res = false;
	if (Player.isRecording == false)
		res = this.plugin.JumpBackward(Player.skipDuration);
	else {
		this.bufferState = 0;
		this.plugin.Stop();
		var tgt = (Player.curPlayTime/1000.0) - Player.skipDuration;
		if (tgt < 0)
			tgt = 0;
		Player.setCurrentPlayTimeOffset(tgt * 1000.0);
		res = this.plugin.Play( this.url+ "?time=" + tgt );		
		Main.logToServer("Player.skipBackwardVideo with ?time=" + tgt);
		if (res == false)
			Player.setCurrentPlayTimeOffset(old);

	}
    if (res == false) {
    	Display.showPopup("Jump Backward ret= " +  ((res == true) ? "True" : "False"));    	
    }
};

Player.adjustSkipDuration = function (dir) {
	if (Player.isLive == true) {
		return;
	}
	switch (dir) {
	case 0:
		// Reset
    	Player.skipDuration = Config.skipDuration;
    	Display.setSkipDuration(Player.skipDuration );    		
		break;
	case 1:
		// Increase
    	Player.skipDuration += Config.skipDuration;
    	Display.setSkipDuration(Player.skipDuration );    		
		break;
	case 2:
		// Decrease
    	Player.skipDuration -= Config.skipDuration;
    	if (Player.skipDuration < Config.skipDuration)
    		Player.skipDuration = Config.skipDuration;
    	Display.setSkipDuration(Player.skipDuration );    		
		break;
	};
};

Player.isInTrickplay = function() {
	return (this.trickPlaySpeed != 1) ? true: false;
};

Player.fastForwardVideo = function() {
	if (this.trickPlayDirection == 1) {
		this.trickPlaySpeed = this.trickPlaySpeed * 2;
	}
	else {
		// I am in rewind mode, thus decrease speed
		this.trickPlaySpeed = this.trickPlaySpeed / 2;

		if (this.trickPlaySpeed <= 1) {
			this.trickPlaySpeed = 1;
			this.trickPlayDirection = 1;
		}

	}
	if (Player.isRecording == true) {
		if (this.trickPlaySpeed > 2)
			this.trickPlaySpeed = 2;
	}

	if  (this.trickPlaySpeed != 1) {
		Main.log("Player.fastForwardVideo: updating display");
		Display.setTrickplay (this.trickPlayDirection, this.trickPlaySpeed);		
	}
	else {
		Player.ResetTrickPlay();
		return;
	}

	Main.log("FastForward: Direction= " + ((this.trickPlayDirection == 1) ? "Forward": "Backward") + "trickPlaySpeed= " + this.trickPlaySpeed);
	Main.logToServer("FastForward: Direction= " + ((this.trickPlayDirection == 1) ? "Forward": "Backward") + "trickPlaySpeed= " + this.trickPlaySpeed);
	if (this.plugin.SetPlaybackSpeed(this.trickPlaySpeed * this.trickPlayDirection) == false) {
    	Display.showPopup("trick play returns false. Reset Trick-Play" );	
    	Player.ResetTrickPlay();
//    	this.trickPlaySpeed = 1;
//    	this.trickPlayDirection = 1;
	}
};

Player.RewindVideo = function() {

	if ((this.trickPlayDirection == 1) && (this.trickPlaySpeed == 1)){
		this.trickPlayDirection = -1;
		this.trickPlaySpeed = this.trickPlaySpeed * 2;
		
	}
	else if (this.trickPlayDirection == 1) {
		// I am in fast forward mode, so decrease
		this.trickPlaySpeed = this.trickPlaySpeed / 2;
		if (this.trickPlaySpeed < 1) {
			this.trickPlaySpeed = 1;
			this.trickPlayDirection = -1;
		}
		
	}
	else
		this.trickPlaySpeed = this.trickPlaySpeed * 2;

	if (Player.isRecording == true) {
		if (this.trickPlayDirection <0 )
			Player.ResetTrickPlay();
			return;
//			this.trickPlayDirection = 1;
	}
		
	if (this.trickPlaySpeed != 1) {
		Display.setTrickplay (this.trickPlayDirection, this.trickPlaySpeed);		
	}
	else {
		Player.ResetTrickPlay();
		return;
	}

	Main.log("Rewind: Direction= " + ((this.trickPlayDirection == 1) ? "Forward": "Backward") + "trickPlaySpeed= " + this.trickPlaySpeed);

	if (this.plugin.SetPlaybackSpeed(this.trickPlaySpeed * this.trickPlayDirection) == false) {
    	Display.showPopup("trick play returns false. Reset Trick-Play" );	
    	Player.ResetTrickPlay();
//    	this.trickPlaySpeed = 1;
//    	this.trickPlayDirection = 1;
	}


	Main.log("Rewind: Direction= " + ((this.trickPlayDirection == 1) ? "Forward": "Backward") + "trickPlaySpeed= " + this.trickPlaySpeed);
	Main.logToServer("Rewind: Direction= " + ((this.trickPlayDirection == 1) ? "Forward": "Backward") + "trickPlaySpeed= " + this.trickPlaySpeed);

	/*	if (this.plugin.SetPlaybackSpeed(this.trickPlaySpeed * this.trickPlayDirection) == false) {
    	Display.showPopup("trick play returns false. Reset Trick-Play" );	
    	this.trickPlaySpeed = 1;
    	this.trickPlayDirection = 1;
	}
*/
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
	if (Player.skipDuration != 30) {
		Display.setSkipDuration(Player.skipDuration );
	}
	else {
		Display.resetStartStop();
	}
};

Player.getState = function() {
    return this.state;
};

// ------------------------------------------------
// Global functions called directly by the player 
//------------------------------------------------

Player.onBufferingStart = function() {
	Main.logToServer("Buffer Start: cpt= " + (Player.curPlayTime/1000.0) +"sec");
	Player.bufferStartTime = new Date().getTime();

	if (this.requestStartTime != 0) {
		Main.logToServer("Player.onBufferingStart Server RTT= " + (Player.bufferStartTime -this.requestStartTime ) + "ms");
		this.requestStartTime  = 0;
	}

	Spinner.show();
	Player.bufferState = 0;
	Display.bufferUpdate();
	// should trigger from here the overlay
	Display.showProgress();
	Display.status("Buffering...");
//	Display.showStatus();
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
	Spinner.hide();

	Main.logToServer("onBufferingComplete cpt= " +(Player.curPlayTime/1000.0) +"sec - Buffering Duration= " + (new Date().getTime() - Player.bufferStartTime) + " ms");

    Player.bufferState = 100;
	Display.bufferUpdate();
	Display.showProgress();
	
//    Player.setFullscreen();
// or I should set it according to the aspect ratio
    Display.hide();   
    
//	Main.logToServer("onBufferingComplete ");
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
//	Main.logToServer("GetCurrentBitrates= " + Player.plugin.GetCurrentBitrates());
	if ((Player.isLive == false) && (Player.isRecording == false)) {
		Player.totalTime = Player.plugin.GetDuration();
	}
//    Player.curPlayTimeStr =  Display.durationString(Player.totalTime / 1000.0);
    Player.totalTimeStr =Display.durationString(Player.totalTime / 1000.0);
    
//    var height = Player.plugin.GetVideoHeight();
//    var width = Player.plugin.GetVideoWidth();
//    Main.logToServer("Resolution= " + width + " x " + height );
};

Player.OnRenderingComplete = function() {
	// Do Something
	Player.stopVideo();
};

Player.OnConnectionFailed = function() {
	// fails to connect to the streaming server
	Main.log ("ERROR: Failed to connect to the streaming server");
	Main.logToServer("ERROR: Failed to connect Url= "+ Player.url);
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
	Server.saveResume();
};

