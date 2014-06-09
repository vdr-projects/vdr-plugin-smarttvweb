/*
 * This module only works with the Samsung Media Players. For other player objects, the code need to be adjusted
 */
var mainPlayer;

var Player =
{
	isLive : false,
	isRecording : false,

	startTime : 0,
    duration : 0, // EpgDuration

	stopCallback : null,    /* Callback function to be set by client */
    errorCallback : null,
    mFormat : 0,

    guid : "unknown",

    trickPlaySpeed : 1, // Multiple of 2 only.    

    curPlayTimeStr : "00:00:00", // millis
    curPlayTime : 0, // millis

    resumePos : -1,  

    skipDuration : 30, // only used by config to set the skipDuration
    bufferState : 0,     // buffer state in %, Used by Display

    
    //state value
    STOPPED : 0,
    PLAYING : 1,
    PAUSED : 2,  
    FORWARD : 3,
    REWIND : 4,

    //mFormat values
    eUND : 0, // undefined
    ePDL : 1,
    eHLS : 2,
    eHAS : 3,
    

	//Player Modules Internal Members
	AVPlayerObj : null,
	screenObj : null,
    
    url : "",
    urlExtension : "",
    
    state : 0,
    cptOffset  : 0,  // millis
    reportCurPlayTime : true, 
    totalTime : -1,  // millis
    
    
    totalTimeStr : "",
    originalSource : null,
        
    trickPlayDirection : 1,
    
    curAudioTrack : 0,
    audioLanguages : [],
    curSubtitleTrack : 0, // Zero means off
    
    effectMode : 0, // 3DEffect Mode value (range from 0 to 7)
	aspectRatio :0,
	
	eASP16to9 :0,
	eASP4to3 :1,
	eASPcrop16to9 :2,
	eASP21to9 : 3,
	
	bufferStartTime : 0,
	requestStartTime :0
};

Player.init = function() {
	this.screenObj = document.getElementById('pluginObjectScreen');
	if (this.AVPlayerObj != null)
		return false; // that prevents Main.init to overwrite the callbacks. 
	
	var success = true;
          Main.log("success vale :  " + success);    
    this.state = this.STOPPED;

	try {
		var custom = webapis.avplay;
		Main.logToServer("webapis.ver= " + webapis.ver);
		custom.getAVPlay(Player.onAVPlayObtained, Player.onGetAVPlayError);
	}
	catch(exp) {
		Main.log('Player.init: getAVplay Exception :[' +exp.code + '] ' + exp.message);
	}             

    
    this.skipDuration = Config.skipDuration; // Use Config default also here
       
    Main.log("success= " + success);       
    return success;
};


Player.deinit = function() {
	Main.log("Player deinit !!! " );       
	Main.logToServer("Player deinit !!! " );       

    if (Player.AVPlayerObj != null) {
		Player.AVPlayerObj.stop();
    }
};

Player.isPdl = function () {
	return (Player.mFormat == Player.ePDL);
};

Player.setPdl = function () {
	Player.mFormat = Player.ePDL;
	Player.urlExtensionurlExtension = "";
	
};

Player.isHls = function () {
	return (Player.mFormat == Player.eHLS);
};

Player.setHls = function () {
	Player.mFormat = Player.eHLS;
	Player.urlExtensionurlExtension = "/manifest-seg.m3u8|COMPONENT=HLS";
};

Player.isHas = function () {
	return (Player.mFormat == Player.eHAS);
};

Player.setHas = function () {
	Player.mFormat = Player.eHAS;
	Player.urlExtensionurlExtension = "/manifest-seg.mpd|COMPONENT=HAS";
};

Player.setVideoURL = function(url) {
    this.url = url + this.urlExtensionurlExtension;
    Main.log("Player.setVideoURL: URL = " + this.url);
};

// for Live and for on-going recordings
Player.setDuration = function () {
	Player.totalTime = Data.getCurrentItem().childs[Main.selectedVideo].payload.dur * 1000;
	Player.totalTimeStr =Display.durationString(Player.totalTime / 1000.0);
};

Player.getDurationStr = function () {
	return Player.totalTimeStr;
};

Player.getDuration = function () {
	return Player.totalTime;
};

// function for live
Player.setCurrentPlayTimeOffset = function(val) {
	// val in milli sec
	this.cptOffset = val;
//	Display.showPopup("CurrentPlayTimeOffset= " + this.cptOffset);
};


Player.getState = function() {
    return this.state;
};

Player.toggleAspectRatio = function () {
	/*	var height = Player.plugin.GetVideoHeight();
		var width = Player.plugin.GetVideoWidth();
		Main.logToServer ("Resolution= " + width + " x " + height );
		Main.log ("Resolution= " + width + " x " + height );
	*/
	switch (this.aspectRatio) {
	case this.eASP16to9:
		//it is 16 to 9, so do 4 to 3
		this.aspectRatio = this.eASP4to3;
		Notify.showNotify("4 : 3", true);
		break;
	case this.eASP4to3:
		// it is 4 to 3. do cropped do 16 to 9
		this.aspectRatio = this.eASPcrop16to9;
		Notify.showNotify("Crop 16 : 9", true);
		break;
	case this.eASPcrop16to9:
		// it is cropped 16 to 9
		this.aspectRatio = this.eASP21to9;
		Notify.showNotify("21 : 9", true);
//			Main.logToServer("Player.toggleAspectRatio: 16 by 9 Now");
		break;
	case this.eASP21to9:
		// it is 21 to 9
		this.aspectRatio = this.eASP16to9;
		Notify.showNotify("16 : 9", true);
//			Main.logToServer("Player.toggleAspectRatio: 16 by 9 Now");
		break;
	}
	Player.setFullscreen();
};

Player.toggle3DEffectMode = function () {
	Main.logToServer("Player.toggle3DEffectMode");
	if (Main.isTvSet() == false) {
		if( 1 == Player.screenObj.Flag3DTVConnect() ) {
			Main.logToServer("BDPlayer connected to 3D TV");
			Player.setNew3DEffectMode();
			
		}
		else {
			Main.logToServer("BDPlayer connected to 2D TV");
			Notify.showNotify("No 3DTV connected, sorry", true);		
		}
	}
	else {
		if( 1 == Player.screenObj.Flag3DEffectSupport() ) {
			Main.logToServer("3D TV!");
			Player.setNew3DEffectMode();
		}
		else {
			Main.logToServer("2D TV..;-(");
			Notify.showNotify("No 3DTV, sorry", true);
		}		
	}
};

Player.setNew3DEffectMode = function () {
	this.effectMode ++;
	if (this.effectMode > 7)
		this.effectMode = 0;
	
	Main.logToServer("New 3D Effect effectMode= " + this.effectMode );
	Player.screenObj.Set3DEffectMode(this.effectMode);

	/*	if( 2 == Player.screenObj.Get3DEffectMode() ) {
			Player.screenObj.Set3DEffectMode(0);
		}
		else {
			Player.screenObj.Set3DEffectMode(2);
		};
		*/

	var mode = Player.screenObj.Get3DEffectMode();
		
	Main.logToServer("New 3D Effect effectMode= " + this.effectMode + " plgMode= " + mode);
//		switch (Player.screenObj.Get3DEffectMode()) {
	if (this.effectMode == mode ) {
		switch (this.effectMode) {
		case 0:
			Notify.showNotify("3D Off", true);
			break;
		case 1:
			Notify.showNotify("3D Top Bottom", true);
			break;
		case 2:
			Notify.showNotify("3D Side-By-Side", true);
			break;
		case 3:
			Notify.showNotify("3D Line-by-Line", true);
			break;
		case 4:
			Notify.showNotify("3D Vertical Stripe", true);
			break;
		case 5:
			Notify.showNotify("3D Mode frame sequence", true);
			break;
		case 6:
			Notify.showNotify("3D Checker BD", true);
			break;
		case 7:
			Notify.showNotify("3D: 2D to 3D", true);
			break;
		}
	}
	else {
		Notify.showNotify("3D Issue Wanted= " + this.effectMode + " but got= " + mode +"!!!!", true);		
	}
};

Player.getNumOfAudioTracks = function () {
	return (Player.AVPlayerObj.totalNumOfAudio != null) ? Player.AVPlayerObj.totalNumOfAudio : "Unknown";
};


Player.nextAudioTrack = function () {

	var new_track = (Player.curAudioTrack +1 ) % Player.AVPlayerObj.totalNumOfAudio;
//	Player.curAudioTrack = (Player.curAudioTrack +1 ) % Player.AVPlayerObj.totalNumOfAudio;
	
	try {
//		if (Player.AVPlayerObj.setAudioStreamID(Player.curAudioTrack) == false) {
		if (Player.AVPlayerObj.setAudioStreamID(new_track) == false) {
			Main.logToServer("Player.nextAudioTrack: Failed to set audio track to " + new_track);
			Display.showPopup("Player.nextAudioTrack: Failed to set audio track to " + new_track);
		}
		else {
			Player.curAudioTrack = new_track;
			Main.logToServer("Player.nextAudioTrack: Track= " + Player.curAudioTrack);
			if(Player.audioLanguages[Player.curAudioTrack] == "")
				Notify.showNotify("Audio Track " + Player.curAudioTrack, true);
			else
				Notify.showNotify("Audio Track " + Player.curAudioTrack + ": " + Player.audioLanguages[Player.curAudioTrack], true);
		}
		
	}
	catch (e) {
		Main.logToServer("Player.nextAudioTrack: Caught Error: " + e.message);
		Display.showPopup("Player.nextAudioTrack: Caught Error: " + e.message);
	}	
};

Player.getNumOfSubtitleTracks = function () {
	return (Player.AVPlayerObj.totalNumOfSubtitle != null) ? Player.AVPlayerObj.totalNumOfSubtitle : "Unknown";
};

Player.nextSubtitleTrack = function () {
	if (!Player.AVPlayerObj.getSubtitleAvailable() ) {
		return;
	}

	Player.curSubtitleTrack = (Player.curSubtitleTrack +1 ) % (Player.AVPlayerObj.totalNumOfSubtitle +1);

	try {
		if (Player.AVPlayerObj.setSubtitleStreamID(Player.curSubtitleTrack) == false) {
			Main.logToServer("Player.nextSubtitleTrack: Failed to set subtitle track to " + Player.curSubtitleTrack);
			Display.showPopup("Player.nextSubtitleTrack: Failed to set subtitle track to " + Player.curSubtitleTrack);
		}
		else {
			Main.logToServer("Player.nextSubtitleTrack: Track= " + Player.curSubtitleTrack);
			Notify.showNotify("Subtitle " + Player.curSubtitleTrack, true);
		}
			
	}
	catch (e) {
		Main.logToServer("Player.nextSubtitleTrack: Caught Error: " + e.message);
		Display.showPopup("Player.nextSubtitleTrack: Caught Error: " + e.message);
	}	
	
};


Player.numKeyJump = function (key) {
	Display.showProgress();

	switch (Config.playKeyBehavior) {
	case 1:
		var cur_skip_duration = this.skipDuration;
		this.skipDuration = key * 60;
		this.skipForwardVideo();
		this.skipDuration = cur_skip_duration;
		break;
	default:
		Player.jumpToVideo(key * 10);
	break;
	}
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
    	Player.AVPlayerObj.show();

    	Main.logToServer("Player.playVideo - Spinner.show()");
    	Spinner.show();

    	Display.updatePlayTime();

        Display.status("Play");
    	Display.hideStatus();

    	Display.showProgress();
        this.state = this.PLAYING;
        
        Player.ResetTrickPlay();
        Player.skipDuration = Config.skipDuration; // reset

        Main.log ("Player.playVideo: StartPlayback for " + this.url);

        this.requestStartTime = Display.GetUtcTime();
//        this.requestStartTime = new MyDate().getTime();
        if (Player.isRecording == false) {
        	if (resume_pos == -1) 
        		resume_pos = 0;

        	try {
				Main.logToServer("Player.play Start playback of url= " + this.url + " resume= " + resume_pos + " sec");

				if (Config.useDefaultBuffer || ( !Player.isLive && !Config.usePdlForRecordings)) {
					Main.logToServer("Player.play using default buffer!");					
					Player.AVPlayerObj.open (this.url);
				}
				else
					Player.AVPlayerObj.open (this.url, Player.getBuffer());
				Player.AVPlayerObj.play(Player.onPlaySuccess, Player.onError, resume_pos);
			}
			catch (e) {
				Main.log("Player.play: Error caught " + e.msg);
				Main.logToServer("Player.play: Error caught " + e.msg);
				Display.showPopup("Player.play: Error caught " + e.msg);
			}

        }
        else {
        	if (resume_pos == -1) 
        		resume_pos = 0;
			Player.setCurrentPlayTimeOffset(resume_pos * 1000.0);
			try {
				Main.logToServer("Player.play Start playback of url= " + this.url + " time= " + resume_pos + " sec");

				if (Config.usePdlForRecordings) {				
					if (Config.useDefaultBuffer) 
						Player.AVPlayerObj.open(this.url+ "?time=" + resume_pos);
					else
						Player.AVPlayerObj.open(this.url+ "?time=" + resume_pos, Player.getBuffer() );
				}
				else {
					Player.AVPlayerObj.open (this.url);					
				}
				Player.AVPlayerObj.play(Player.onPlaySuccess , Player.onError);
			}
			catch(e) {
				Main.log("Player.play: Error: " + e.message);
				Main.logToServer("Player.play: Error: " + e.message);
				Display.showPopup("Player.play: Error: " + e.message);
			};
			Main.logToServer("Player.play with ?time=" + resume_pos);        
        }
		Main.logToServer("Player.play Started");					

        if ((this.mFormat == this.eHLS) && (this.isLive == false)){
        	Notify.showNotify("No Trickplay", true);
        }
//        pluginObj.setOffScreenSaver();
    }
};

Player.pauseVideo = function() {
	Display.showProgress();
	Main.logToServer("pauseVideo");
	
    this.state = this.PAUSED;
    Display.status("Pause");
	Display.showStatus();
	var res = false;
	try {
		res = Player.AVPlayerObj.pause();
	}
	catch(e) {
		Main.log("Player.pause: Error " + e.message);
		Main.logToServer("Player.pause: Error " + e.message);
		Display.showPopup("Player.pause: Error " + e.message);  
	}
	if (res == false)
		Display.showPopup("pause ret= " +  ((res == true) ? "True" : "False"));  
//	pluginObj.setOnScreenSaver();
};

Player.stopVideo = function() {
	if (this.state != this.STOPPED) {
		
		this.state = this.STOPPED;
        Display.status("Stop");
        Display.hideStatus();
    	Player.AVPlayerObj.hide();

		try {
			Player.AVPlayerObj.stop();
        }
		catch (e) {
		}
        if (this.stopCallback) {
        	Main.log(" StopCallback");
            this.stopCallback();
        }
        
        // Cleanup
		Display.resetAtStop();
        
        Spinner.hide();
//		pluginObj.setOnScreenSaver();
    }
    else {
        Main.log("Ignoring stop request, not in correct state");
    }
};

//This function is called when Stop was pressed
Player.resetAtStop = function () {
	// the default is for plain on-demand recording
	// should be called with the Diplayer overlay Reset
	
	if (this.state != Player.STOPPED) {
		Main.log("ERROR in Player.reset: should not be here");
		return;
	}
	this.aspectRatio = this.eASP16to9;
	if (this.effectMode != 0) {
		Player.screenObj.Set3DEffectMode(0);
	}
	this.effectMode = 0;
	this.bufferState = 0;
	
	Player.ResetTrickPlay(); // is the GUI resetted as well?
	Player.adjustSkipDuration (0);

	this.cptOffset  = 0;
	this.curPlayTime = 0;
	this.reportCurPlayTime = true;
	this.totalTime = -1;  // negative on purpose
	this.totalTimeStr = "0:00:00";
	this.curPlayTimeStr = "0:00:00";

	this.isLive =false;
    this.isRecording = false;
    this.mFormat =Player.eUND;	
    this.urlExtensionurlExtension = "";
    this.curAudioTrack =0;
    this.audioLanguages = [];
    this.curSubtitleTrack = 0;
};



Player.resumeVideo = function() {
	Main.logToServer("resumeVideo");
	Display.showProgress();
    this.state = this.PLAYING;
    Display.status("Play");
	Display.hideStatus();
	var res = false;
	try {
		res = Player.AVPlayerObj.resume();
	}
	catch (e){
	}
	if (res == false)
		Display.showPopup("resume ret= " +  ((res == true) ? "True" : "False"));  
//	pluginObj.setOffScreenSaver();
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

Player.skipForwardVideo = function() {
	Main.logToServer ("Player.skipForwardVideo: cpt= " + (Player.curPlayTime / 1000.0) + " sec skipDur= " + Player.skipDuration + " isRec= " + ((Player.isRecording == true) ? "true" : "false"));

    this.requestStartTime = Display.GetUtcTime();;
//	this.requestStartTime = new MyDate().getTime();
	Display.showProgress();
	var res = false;
	if (Player.isRecording == false || !Config.usePdlForRecordings)
		res = Player.AVPlayerObj.jumpForward(Player.skipDuration);
	else {
		Spinner.show();
		this.bufferState = 0;
		Player.AVPlayerObj.stop();
		var old = Player.curPlayTime;
		var tgt = (Player.curPlayTime/1000.0) + Player.skipDuration;
		Player.setCurrentPlayTimeOffset(tgt * 1000.0);

		if (Config.useDefaultBuffer) 
			Player.AVPlayerObj.open(this.url+ "?time=" + tgt);
		else
			Player.AVPlayerObj.open(this.url+ "?time=" + tgt, Player.getBuffer());

    	res = Player.AVPlayerObj.play(Player.onPlaySuccess , Player.onError);
		
		Main.logToServer("Player.skipForwardVideo with ?time=" + tgt);
		if (res == false)
			Player.setCurrentPlayTimeOffset(old);			
	}
    if (res == false) {
    	Display.showPopup("Jump Forward ret= " +  ((res == true) ? "True" : "False"));    	
    }
};

Player.skipBackwardVideo = function() {
	Main.logToServer ("Player.skipBackwardVideo: cpt= " + (Player.curPlayTime / 1000.0) + " sec skipDur= " + Player.skipDuration + " isRec= " + ((Player.isRecording == true) ? "true" : "false"));

    this.requestStartTime = Display.GetUtcTime();;
//	this.requestStartTime = new MyDate().getTime();
	Display.showProgress();
	var res = false;
	if (Player.isRecording == false || !Config.usePdlForRecordings)
		res = Player.AVPlayerObj.jumpBackward(Player.skipDuration);
	else {
		Spinner.show();
		this.bufferState = 0;
		Player.AVPlayerObj.stop();
		var tgt = (Player.curPlayTime/1000.0) - Player.skipDuration;
		if (tgt < 0)
			tgt = 0;
		Player.setCurrentPlayTimeOffset(tgt * 1000.0);
		if (Config.useDefaultBuffer) 
			Player.AVPlayerObj.open(this.url+ "?time=" + tgt);
		else
			Player.AVPlayerObj.open(this.url+ "?time=" + tgt, Player.getBuffer());

    	res = Player.AVPlayerObj.play(Player.onPlaySuccess , Player.onError);

		Main.logToServer("Player.skipBackwardVideo with ?time=" + tgt);
		if (res == false)
			Player.setCurrentPlayTimeOffset(old);

	}
    if (res == false) {
    	Display.showPopup("Jump Backward ret= " +  ((res == true) ? "True" : "False"));    	
    }
};



Player.ResetTrickPlay = function() {
	if (this.trickPlaySpeed != 1) {
		this.trickPlaySpeed = 1;
		this.trickPlayDirection = 1;
		Main.log("Reset Trickplay " );
		if (Player.AVPlayerObj.setSpeed(this.trickPlaySpeed * this.trickPlayDirection) == false) {
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
	if (Player.AVPlayerObj.setSpeed(this.trickPlaySpeed * this.trickPlayDirection) == false) {
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
	}
		
	if (this.trickPlaySpeed != 1) {
		Display.setTrickplay (this.trickPlayDirection, this.trickPlaySpeed);		
	}
	else {
		Player.ResetTrickPlay();
		return;
	}

	Main.log("Rewind: Direction= " + ((this.trickPlayDirection == 1) ? "Forward": "Backward") + "trickPlaySpeed= " + this.trickPlaySpeed);

	if (Player.AVPlayerObj.setSpeed(this.trickPlaySpeed * this.trickPlayDirection) == false) {
    	Display.showPopup("trick play returns false. Reset Trick-Play" );	
    	Player.ResetTrickPlay();
	}


	Main.log("Rewind: Direction= " + ((this.trickPlayDirection == 1) ? "Forward": "Backward") + "trickPlaySpeed= " + this.trickPlaySpeed);
	Main.logToServer("Rewind: Direction= " + ((this.trickPlayDirection == 1) ? "Forward": "Backward") + "trickPlaySpeed= " + this.trickPlaySpeed);

};



// used to reset ProgressBar
Player.OnCurrentPlayTime = function(time) {
	Main.log ("Player.OnCurrentPlayTime " + time.millisecond);
		
	if (typeof time == "number")
		Player.curPlayTime = parseInt(time) + parseInt(Player.cptOffset);
	else
		Player.curPlayTime = parseInt(time.millisecond) + parseInt(Player.cptOffset);

	if (Player.reportCurPlayTime == true) {
		Player.reportCurPlayTime = false;
		Main.logToServer ("Player.OnCurrentPlayTime cpt= " + (Player.curPlayTime/1000.0) + "sec dur= " + (Player.getDuration() /1000.0) + "sec");
		
	}

    // Update the Current Play Progress Bar 
    Display.updateProgressBar();
    
    if (Player.isRecording == true) {
    	Display.updateRecBar(Player.startTime, Player.duration);
    }
    Main.log ("Player.OnCurrentPlayTime: curPlayTimeStr= " + Player.curPlayTimeStr);
    Player.curPlayTimeStr =  Display.durationString(Player.curPlayTime / 1000.0);

    Display.updatePlayTime();
};


// ------------------------------------------------------
// Player Internal Functions
//------------------------------------------------------


Player.setWindow = function() {
//  this.plugin.SetDisplayArea(458, 58, 472, 270);
};

Player.setFullscreen = function() {
//  this.plugin.SetDisplayArea(0, 0, 960, 540);

	var resolution = Player.AVPlayerObj.getVideoResolution().split("|");
	
	var w = resolution[0];
	var h =  resolution[1];
	Main.logToServer ("Player.setFullscreen: Resolution= " + w + " x " + h );
	Main.log ("Resolution= " + w + " x " + h );

	switch (this.aspectRatio) {
	case this.eASP16to9:
//		this.plugin.SetDisplayArea(0, 0, 960, 540);
//		this.plugin.SetCropArea(0, 0, w, h);
		Player.AVPlayerObj.setDisplayArea({left: 0, top:0, width:960, height:540 });
		Player.AVPlayerObj.setCropArea(Player.onCropSuccess, Player.onError, {left: 0, top:0, width:w, height:h });

		Main.logToServer("Player.setFullscreen: 16 by 9 Now");
		break;
	case this.eASP4to3:
		// it is 4 to 3. do cropped do 16 to 9
//		this.plugin.SetDisplayArea(120, 0, 720, 540);
//		this.plugin.SetCropArea(0, 0, w, h);
		Player.AVPlayerObj.setDisplayArea({left: 120, top:0, width:720, height:540 });
		Player.AVPlayerObj.setCropArea(Player.onCropSuccess, Player.onError, {left: 0, top:0, width:w, height:h });
		// 4/3 = x/540
		Main.logToServer("Player.setFullscreen: 4 by 3 Now");
		break;
	case this.eASPcrop16to9:
		// it is cropped 16 to 9
		var z = Math.ceil(w*w*27 /(h*64));
		Main.logToServer("Player.setFullscreen: Crop 16 by 9 Now: z= " + z);
//		this.plugin.SetDisplayArea(0, 0, 960, 540);
//		this.plugin.SetCropArea(0, Math.round((h-z)/2), w, z);
		Player.AVPlayerObj.setDisplayArea({left: 0, top:0, width:960, height:540 });
		Player.AVPlayerObj.setCropArea(Player.onCropSuccess, Player.onError, {left: 0, top:Math.round((h-z)/2), width:w, height:z });
		break;
	case this.eASP21to9:
		Player.AVPlayerObj.setDisplayArea({left: 0, top:64, width:960, height:412 });
		Player.AVPlayerObj.setCropArea(Player.onCropSuccess, Player.onError, {left: 0, top:0, width:w, height:h });
		Main.logToServer("Player.setFullscreen: 21 by 9 Now");

		break;
	}
};

//successcallback
//function onAVPlayObtained(avplay) {             
Player.onAVPlayObtained = function (avplay) {             
	Player.AVPlayerObj = avplay;
	Player.AVPlayerObj.hide();
	Main.logToServer("onAVPlayObtained: sName= " + avplay.sName+ " sVersion: " + avplay.sVersion);
	var cb = new Object();
	cb.containerID = 'webapiplayer';
	cb.zIndex = 0;
	cb.bufferingCallback = new Object();
	cb.bufferingCallback.onbufferingstart= Player.onBufferingStart;
    cb.bufferingCallback.onbufferingprogress = Player.onBufferingProgress;
    cb.bufferingCallback.onbufferingcomplete = Player.onBufferingComplete;           
	
	cb.playCallback = new Object;
    cb.playCallback.oncurrentplaytime = Player.OnCurrentPlayTime;
	cb.playCallback.onresolutionchanged = Player.onResolutionChanged;
	cb.playCallback.onstreamcompleted = Player.OnRenderingComplete;
	cb.playCallback.onerror = Player.onError;

	cb.displayRect= new Object();
	cb.displayRect.top = 0;
	cb.displayRect.left = 0;
	cb.displayRect.width = 960;
	cb.displayRect.height = 540;
	cb.autoRatio = false;                   // thlo: Test Aspect ratio

	try {
		Player.AVPlayerObj.init(cb);
	}
	catch (e) {
		Main.log("Player: Error during init: " + e.message);
		Main.logToServer("Player: Error during init: " + e.message);
	};
};

//errorcallback
//function onGetAVPlayError(error) {
Player.onGetAVPlayError = function (error) {
  Main.log('Player.onGetAVPlayError: ' + error.message);
  Main.logToServer('Player.onGetAVPlayError: ' + error.message);
};

Player.getBuffer = function () {
	var res = {};
	/*
	var buffer_byte = (Config.totalBufferDuration * Config.tgtBufferBitrate) / 8.0;
	var initial_buf = Config.initialBuffer;
//	if (Player.isLive == true)
//		initial_buf = initial_buf *4;
	
	res.totalBufferSize = Math.round(buffer_byte);
	res.initialBufferSize = Math.round( buffer_byte * initial_buf/ 100.0);
	res.pendingBufferSize = Math.round(buffer_byte * Config.pendingBuffer /100.0); 
*/
	if (Player.isLive == true) {
		res.totalBufferSize = Config.totalBufferSize;
		res.initialBufferSize = Config.initialBufferSize;
		res.pendingBufferSize = Config.pendingBufferSize; 
	}
	else {
		res.totalBufferSize = (Config.totalBufferSize );
		res.initialBufferSize = (Config.initialBufferSize /2);
		res.pendingBufferSize = (Config.pendingBufferSize ); 
	}
	Main.logToServer("Setting Buffer " + ((Player.isLive == true)? "Live" : "VOD") + " total= " + res.totalBufferSize +" Byte initial= " +res.initialBufferSize + " Byte pending= " +res.pendingBufferSize +" Byte " );
	
	return res;
};



Player.jumpToVideo = function(percent) {	
	if (this.isLive == true) {
		return;
	}

	if (this.state != this.PLAYING) {
    	Main.logToServer ("Player.jumpToVideo: Player not Playing");
    	return;
    }

	Main.logToServer ("Player.jumpToVideo: cpt= " + (Player.curPlayTime / 1000.0) + " sec target= " + percent + "% isRec= " + ((Player.isRecording == true) ? "true" : "false"));
	Spinner.show();

	Player.bufferState = 0;
	Display.showProgress();

	//TODO: the totalTime should be set already
	if (this.totalTime == -1 && this.isLive == false) 
		this.totalTime = Player.AVPlayerObj.getDuration();
	var tgt = Math.round(((percent-2)/100.0) *  this.totalTime/ 1000.0);
	var res = false;

    this.requestStartTime = Display.GetUtcTime();;
//	this.requestStartTime = new MyDate().getTime();

	if (Player.isRecording == false || !Config.usePdlForRecordings) {
		if (tgt > (Player.curPlayTime/1000.0)) 
			res = Player.AVPlayerObj.jumpForward(tgt - (Player.curPlayTime/1000.0));
		else 
			res = Player.AVPlayerObj.jumpBackward( (Player.curPlayTime/1000.0)- tgt);
	}
	else {
		Player.AVPlayerObj.stop();
		var old = Player.curPlayTime;

		Player.setCurrentPlayTimeOffset(tgt * 1000.0);
	
			if (Config.useDefaultBuffer) 	
				Player.AVPlayerObj.open(this.url+ "?time=" + tgt);
			else
		    	Player.AVPlayerObj.open(this.url+ "?time=" + tgt, Player.getBuffer());
		
    	res = Player.AVPlayerObj.play(Player.onPlaySuccess , Player.onError);

		Main.logToServer("Player.play with ?time=" + tgt);
		if (res == false)
			Player.setCurrentPlayTimeOffset(old);
	}
	Main.logToServer("Player.jumpToVideo: jumpTo= " + percent + "% of " + (this.totalTime/1000) + "sec tgt = " + tgt + "sec cpt= " + (this.curPlayTime/1000) +"sec" + " res = " + res);	

	if (res == false)
		Display.showPopup("ResumePlay ret= " +  ((res == true) ? "True" : "False"));  
};




// ------------------------------------------------
// Global functions called directly by the player 
//------------------------------------------------
Player.onResolutionChanged = function () {
	Main.log('Player.onResolutionChanged : ');
	Main.logToServer('Player.onResolutionChanged : ');
};

Player.onError = function (error) {
	Main.log('Player.onError: ' + error.name);
	Main.logToServer('Player.onError: ' + error.name);
};


Player.onPlaySuccess = function () {
	Player.OnStreamInfoReady();
};

Player.onCropSuccess = function () {
	Main.log('Player.onCropSuccess: ');
//	Main.logToServer('Player.onCropSuccess: ');
};


Player.onBufferingStart = function() {
	Main.logToServer("Buffer Start: cpt= " + (Player.curPlayTime/1000.0) +"sec");
	Main.log("Buffer Start: cpt= " + (Player.curPlayTime/1000.0) +"sec");
	Player.reportCurPlayTime = true;

//	Player.bufferStartTime = new MyDate().getTime();
	Player.bufferStartTime = Display.GetUtcTime();

	if (this.requestStartTime != 0) {
		this.requestStartTime  = 0;
	}

	
	Spinner.show();
	Player.bufferState = 0;
	Display.bufferUpdate();

	Display.showProgress();
	Display.status("Buffering...");

	Main.logToServer("BufferSize: total= " + Player.AVPlayerObj.totalBufferSize + " initial= " 
				+ Player.AVPlayerObj.initialBufferSize + " pending= " + Player.AVPlayerObj.pendingBufferSize);

};

Player.onBufferingProgress = function(percent) {
	Main.logToServer("Player.onBufferingProgress: " +percent +" %");

    Player.bufferState = percent;
	Display.bufferUpdate();
	Display.showProgress();
};

Player.onBufferingComplete = function() {
    Display.status("Play");
	Display.hideStatus();
	Spinner.hide();

	
	Main.logToServer("onBufferingComplete cpt= " +(Player.curPlayTime/1000.0) +"sec - Buffering Duration= " + (Display.GetUtcTime() - Player.bufferStartTime) + " ms");
	Main.log("onBufferingComplete cpt= " +(Player.curPlayTime/1000.0) +"sec - Buffering Duration= " + (Display.GetUtcTime() - Player.bufferStartTime) + " ms");
//	Main.logToServer("onBufferingComplete cpt= " +(Player.curPlayTime/1000.0) +"sec - Buffering Duration= " + (new MyDate().getTime() - Player.bufferStartTime) + " ms");
//	Main.log("onBufferingComplete cpt= " +(Player.curPlayTime/1000.0) +"sec - Buffering Duration= " + (new MyDate().getTime() - Player.bufferStartTime) + " ms");

    Player.bufferState = 100;
	Display.bufferUpdate();
	Display.showProgress();
	
//    Player.setFullscreen();
// or I should set it according to the aspect ratio
    Display.hide();   
	Main.logToServer("BufferSize: total= " + Player.AVPlayerObj.totalBufferSize + " initial= " 
			+ Player.AVPlayerObj.initialBufferSize + " pending= " + Player.AVPlayerObj.pendingBufferSize);
    
};



Player.langCodeToString = function (code) {
	if (code <0)
		return "";
	
	var code_str = code.toString(16);
	var res = "";

	if ((code_str.length % 2) != 0)
		res = "0" + res;
	
	// even chars
	while (code_str.length >= 2) {
		res += String.fromCharCode(parseInt(code_str.substring(0, 2), 16));
		code_str = code_str.substring(2, code_str.length);
	}

	return res;	
};

Player.OnStreamInfoReady = function() {
    Main.log("*** OnStreamInfoReady ***");
//    Main.logToServer("*** OnStreamInfoReady ***");
    Player.setFullscreen();
	if ((Player.isLive == false) && (Player.isRecording == false)) {
		Player.totalTime = Player.AVPlayerObj.getDuration();
	}
    Player.totalTimeStr =Display.durationString(Player.totalTime / 1000.0);
    Main.log("Player.totalTimeStr= " + Player.totalTimeStr);
	  
    if (Player.audioLanguages.length == 0) {
    	for (var i = 0; i < Player.AVPlayerObj.totalNumOfAudio; i++) {
    		var lang_no = Player.AVPlayerObj.getStreamLanguageInfo(1,i);
    		Player.audioLanguages.push(Player.langCodeToString(lang_no));
    	};    	
    }
    
	// here I am 
	var no_audio = Player.AVPlayerObj.totalNumOfAudio;
	for (var i = 0; i < no_audio; i++) {
		var lang_no = Player.AVPlayerObj.getStreamLanguageInfo(1,i);
		var extra_no = Player.AVPlayerObj.getStreamExtraData(1,i);
		Main.logToServer( "Audio lang ("+i+") lang= " + lang_no.toString(16) + "h -> \"" + Player.langCodeToString(lang_no) + "\" extra= " + extra_no.toString(16) + "h -> \"" + Player.langCodeToString(extra_no) + "\"");
	};
	
	var no_sub = Player.AVPlayerObj.totalNumOfSubtitle;
	for (var i = 0; i < no_sub; i++) {
		var lang_no = Player.AVPlayerObj.getStreamLanguageInfo(5,i);
		var extra_no = Player.AVPlayerObj.getStreamExtraData(5,i);
		Main.logToServer( "Audio lang ("+i+") lang= " + lang_no.toString(16) + "h -> \"" + Player.langCodeToString(lang_no) + "\" extra= " + extra_no.toString(16) + "h -> \"" + Player.langCodeToString(extra_no) + "\"");
	};    
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

