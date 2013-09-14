var Server = {
    dataReceivedCallback : null,
    errorCallback : null,
    doSort : false,
    retries : 0,
    curGuid : "",
    tzCorrection : 0,
    XHRObj : null
};


Server.init = function()
{
    var success = true;   

    if (this.XHRObj) {
        this.XHRObj.destroy();  
        this.XHRObj = null;
    }
    
    return success;
};

Server.setSort = function (val) {
	this.doSort = val;
};
//---------------------------------------------
Server.fetchVideoList = function(url) {

	$.ajax({
		url: url,
		type : "GET",
		success : function(data, status, XHR ) {
			Main.log("Server.fetchVideoList Success Response - status= " + status + " mime= " + XHR.responseType + " data= "+ data);

			$(data).find("item").each(function () {
				var title = $(this).find('title').text();
//				var link = $(this).find('link').text();
				var link = $(this).find('enclosure').attr('url');
				var mime = $(this).find('enclosure').attr('type');
				var guid = $(this).find('guid').text();
				var programme = $(this).find('programme').text();
				var description = $(this).find('description').text();
				var startVal = parseInt($(this).find('start').text());
				var durVal = parseInt($(this).find('duration').text());
				var fps = parseFloat($(this).find('fps').text());
				var ispes = $(this).find('ispes').text();
				var isnew = $(this).find('isnew').text();
				var num = parseInt($(this).find('number').text());
//				Main.log("Server.fetchVideoList: title= " + title + " start= " + startVal + " dur= " + durVal + " fps= " + fps);
				
				if (Main.state == Main.eLIVE) {
					Epg.guidTitle[guid] = title;
				}

                var title_list = title.split("~");
                Data.addItem( title_list, {link : link, prog: programme, desc: description, guid : guid, start: startVal, 
                			dur: durVal, ispes : ispes, isnew : isnew, fps : fps, num : num, mime : mime});              	
							
				}); // each

			Data.completed(Server.doSort);

            if (Server.dataReceivedCallback) {
                Server.dataReceivedCallback();
            }
			
		},
		error : function (jqXHR, status, error) {
			Main.logToServer("Server.fetchVideoList Error Response - status= " + status + " error= "+ error);
			Display.showPopup("Error with XML File: " + status);
			Server.retries ++;
		},
		parsererror : function () {
			Main.logToServer("Server.fetchVideoList parserError  " );
			Display.showPopup("Error in XML File");
			Server.retries ++;
            if (Server.errorCallback != null) {
            	Server.errorCallback("XmlError");
            }

		}
	});
};

Server.updateEntry = function(guid) {
	
	Server.curGuid = Data.getCurrentItem().childs[Main.selectedVideo].payload.guid;

	//url is sufficed with ?guid
	var url = Config.serverUrl + "/recordings.xml?guid="+guid;
	Main.logToServer(" Server.updateEntry: guid= " + guid);
	
	$.ajax({
		url: url,
		type : "GET",
		success : function(data, status, XHR ) {
			Main.logToServer("Server.updateEntry Success Response - status= " + status + " mime= " + XHR.responseType + " data= "+ data);

			$(data).find("item").each(function () {
				var title = $(this).find('title').text();
//				var link = $(this).find('link').text();
				var link = $(this).find('enclosure').attr('url');
				var guid = $(this).find('guid').text();
				var programme = $(this).find('programme').text();
				var description = $(this).find('description').text();
				var startVal = parseInt($(this).find('start').text());
				var durVal = parseInt($(this).find('duration').text());
				var fps = parseFloat($(this).find('fps').text());
				var ispes = $(this).find('ispes').text();
				var isnew = $(this).find('isnew').text();
				var num = parseInt($(this).find('number').text());
				Main.logToServer("Server.updateEntry: title= " + title + " start= " + startVal + " dur= " + durVal + " fps= " + fps);
				
                var title_list = title.split("~");
                Data.addItem( title_list, {link : link, prog: programme, desc: description, guid : guid, start: startVal, 
                			dur: durVal, ispes : ispes, isnew : isnew, fps : fps, num : num});              	
							
				}); // each

			Data.assets.sortPayload(Data.sortType);

			// check, whether Main.selectedVideo still points to the entry with guid
			if (Data.getCurrentItem().childs[Main.selectedVideo].payload.guid != Server.curGuid) {
				Main.logToServer("Server.updateEntry: curGuid has changed: curGuid= " + Server.curGuid);
				Main.logToServer("Server.updateEntry: selVid= "+ Data.getCurrentItem().childs[Main.selectedVideo].payload.guid);
				Main.selectedVideo = Main.selectedVideo+1;
				Main.logToServer("Server.updateEntry: curGuid has changed: selVid+1"+ Data.getCurrentItem().childs[Main.selectedVideo].payload.guid);
			}

			var first_item = Main.selectedVideo - Display.currentWindow;
		    if (first_item < 0 )
		    	first_item = 0;

        	Display.setVideoList(Main.selectedVideo, first_item); 
        	// Main.selectedVideo does not fit anymore!!!!!
        	// should do a general reset (jump to 0), when a new element is added
        	// should reset to zero
        	// plus update notif
			Main.logToServer(" done");
			
		},
		error : function (jqXHR, status, error) {
			Main.logToServer("Server.updateEntry Error Response - status= " + status + " error= "+ error);
			Display.showPopup("Error with XML File: " + status);
			Server.retries ++;
		},
		parsererror : function () {
			Main.logToServer("Server.updateEntry parserError  " );
			Display.showPopup("Error in XML File");
			Server.retries ++;
            if (Server.errorCallback != null) {
            	Server.errorCallback("XmlError");
            }

		}
	});
};

//---------------------------------------------

Server.updateVdrStatus = function (){
	Main.log ("get VDR Status");
	$.ajax({
		url: Config.serverUrl + "/vdrstatus.xml",
		type : "GET",
		success : function(data, status, XHR){
			var ts_vdr = $(data).find('vdrTime').text();
			
			try {
				var ts = ts_vdr.split("T")[1];
				var s = ts.split(":");
				if (s.length == 3) {
					var now = ((new Date).getHours());
					Config.tzCorrection = now - s[0];	
					// if Config.tzCorrection larger zero, then TV is ahead
					// thus, I need to substract Config.tzCorrection from the TV time
//					Config.tzCorrection = 1;	
					Main.logToServer("Server.updateVdrStatus: tzCor= " + Config.tzCorrection);
				}
				else
					Main.logToServer("tzCor WARNING");

			}
			catch (e) {
				Main.log ("ERROR in tzCor (Old plugin?): " + e);
			}

			var free = $(data).find('free').text() / 1024.0;
//			var used = $(data).find('used').text() / 1024.0;
//			var percent = $(data).find('percent').text();
	
			var unit = "GB";
			var free_str = free.toFixed(2);
			if (free_str.length > 6) {
				free = free / 1024.0;
				free_str = free.toFixed(2);
				unit = "TB";
			}
			$("#logoDisk").text("Free: " +free_str + unit);
			$("#selectDisk").text("Free: " +free_str + unit);
			
		},
		error: function(jqXHR, status, error){
			Main.log("VdrStatus: Error");
			}
	});
};


Server.getResume = function (guid) {
//	Main.log ("***** getResume *****");
	$.ajax({
		url: Config.serverUrl + "/getResume.xml",
		type : "POST",
		data : "filename:" + guid +"\n", 
		success : function(data, status, XHR ) {
			Main.log("**** Resome Success Response - status= " + status + " mime= " + XHR.responseType + " data= "+ data);

			var resume_str = $(data).find("resume").text();
			if (resume_str != "") {
				var resume_val = parseFloat(resume_str);
				Main.log("resume val= " + resume_val );
				Main.logToServer("resume val= " + resume_val );
				Player.resumePos = resume_val;
				Player.playVideo( resume_val);
			}
			else {
	    		Display.hide();
	        	Display.showProgress();
				Player.playVideo(-1);
			}

		},
		error : function (jqXHR, status, error) {
			Main.log("**** Resome Error Response - status= " + status + " error= "+ error);
    		Display.hide();
        	Display.showProgress();
			Player.playVideo(-1);
		}
	});
};

/*
Server.saveResume = function() {
	var msg = ""; 
    msg += "filename:" + Data.getCurrentItem().childs[Main.selectedVideo].payload.guid + "\n"; 
    msg += "resume:"+ (Player.curPlayTime/1000) + "\n" ;
    	
	$.post(Config.serverUrl + "/setResume.xml", msg, function(data, textStatus, XHR) {
		Main.logToServer("SaveResume Status= " + XHR.status );
	}, "text");

};

*/

Server.notifyServer = function (state) {
	Main.log("Server.notifyServer state="+state +"&mac=" + Network.ownMac + "&ip=" + Network.ownIp);
	$.ajax({
		url: Config.serverUrl + "/clients?state="+state +"&mac=" + Network.ownMac + "&ip=" + Network.ownIp,
		type : "GET",
		success : function(data, status, XHR ) {
			Main.log("Config.notifyServer OK" ) ;
		},
		error : function (XHR, status, error) {
			Main.log("Config.notifyServer failed" ) ;
		}
	});	
};

Server.fetchRecCmdsList = function() {
	var url = Config.serverUrl + "/reccmds.xml";
	$.ajax({
		url: url,
		type : "GET",
		success : function(data, status, XHR ) {
			Main.logToServer("Server.fetchRecCmdsList Success Response - status= " + status + " mime= " + XHR.responseType + " data= "+ data);

			$(data).find("item").each(function () {
				var title = $(this).text();
				var confirm = (($(this).attr("confirm") == "true") ? true : false);
				var cmd = parseInt($(this).attr("cmd"));

				var title_list = title.split("~");
                RecCmds.addItem( title_list, {cmd : cmd, confirm: confirm });              	
				}); // each

/*            if (Server.dataReceivedCallback) {
                Server.dataReceivedCallback();
            }
*/			
//			RecCmds.dumpFolderStruct();
			RecCmds.completed();
			RecCmdHandler.createRecCmdOverlay();
		},
		error : function (jqXHR, status, error) {
			Main.logToServer("Server.fetchRecCmdsList Error Response - status= " + status + " error= "+ error);
			Display.showPopup("Error with XML File: " + status);
		},
		parsererror : function () {
			Main.logToServer("Server.fetchRecCmdsList parserError  " );
			Display.showPopup("Error in XML File");
/*            if (Server.errorCallback != null) {
            	Server.errorCallback("XmlError");
            }
*/
		}
	});
};

/*
Server.execRecCmd = function (cmd, guid) {
	var url = Config.serverUrl + "/execreccmd?cmd="+cmd+"&guid=" + guid;

	Main.logToServer("Server.execRecCmd cmd="+cmd+" guid=" + guid + " url= " + url);
	$.ajax({
		url: url,
		type : "GET",
		success : function(data, status, XHR ) {
			Main.logToServer("Server.execRecCmd OK" ) ;
			Display.handleDescription(Main.selectedVideo);
		},
		error : function (XHR, status, error) {
			Main.logToServer("Server.execRecCmd failed" ) ;
		}
	});	
};
*/
Server.getErrorText = function (status, input) {
//	var errno_str = input.slice(0, 3);
//	var errno = parseInt(errno_str, 10);
	var errno = Number(input.slice(0, 3));

	var res = "";

	Main.logToServer("Server.getErrorText status= " + status + " Errno= " + errno + " input= " + input );
	switch (status) {
	case 400: // Bad Request
		switch (errno) {
			case 1: 
				res = "Mandatory Line attribute not present.";
				break;
			case 2:
				res= "No guid in query line";
				break;
			case 3:
				res = "Entry not found. Deletion failed";
				break;
			case 6:
				// set resume data
				res = "Failed to find the recording.";
				break;
			case 7:
				// get resume data
				res = "Failed to find the recording.";
				break;
			case 8:
				res = "File is new.";
				break;
			case 9:
				res = "No id in query line";
				break;
			case 10:
				res = "No Timer found.";
				break;

			case 15:
				res = "Mandatory cmd attribute not present.";
				break;
			case 16:
				res = "Command (cmd) value out of range.";
				break;
			case 17:
				res = "Execreccmd disabled.";
				break;
			case 18:
				res = "No such file or directory.";
				break;
			case 19:
				res = "Permission Denied.";
				break;
			case 20:
				res = "Is a directory.";
				break;
			case 21:
				res = "Deletion failed (for some reason).";
				break;

			default:
				res = "Unhandled Errno - Status= " + status + " Errno= "+ errno; 
				break;
		}
		break;
	case 404: // File not found
		switch (errno) {
			case 1:
				res = "Recording not found. Deletion failed.";
				break;
			case 2:
				res = "Media Folder likely not configured.";
				break;
			case 3:
				res = "File not found.";
				break;
			default:
			res = "Unhandled Errno - Status= " + status + " Errno= "+ errno; 
			break;
		};
	case 500: // Internal Server Error
		switch (errno) {
			case 6:
				res = "deletion failed!";
			break;
			default:
			res = "Unhandled Errno - Status= " + status + " Errno= "+ errno; 
			break;
		};
		break;
	case 503: // Service unavailable	
		switch (errno) {
			case 1:
				res = "Timers are being edited.";
			break;
			default:
			res = "Unhandled Errno - Status= " + status + " Errno= "+ errno; 
			break;
		}
		break;
	default:
		res = "Unhandled Status - Status= " + status + " Errno= "+ errno; 
		break;
	};
	return res;
};

Server.deleteRecording = function(guid) {
	var obj = new execRestCmd(RestCmds.CMD_DelRec, guid);

	/*
	
	Main.log("Server.deleteRecording guid=" + guid);
	Main.logToServer("Server.deleteRecording guid=" + guid);
	Notify.handlerShowNotify("Deleting...", false);

	$.ajax({
		url: Config.serverUrl + "/deleteRecording.xml?id=" +guid,
		type : "POST",
		success : function(data, status, XHR ) {
			Notify.showNotify("Deleted", true);
			Data.deleteElm(Main.selectedVideo);
			if (Main.selectedVideo >= Data.getVideoCount())
				Main.selectedVideo = Data.getVideoCount() -1;
			Server.updateVdrStatus();
			Display.setVideoList(Main.selectedVideo, (Main.selectedVideo - Display.currentWindow));
			Main.logToServer("Server.deleteRecording: Success" );
			},
		error : function (XHR, status, error) {
			Main.logToServer("Server.deleteRecording: Error" );

			// show popup
			Notify.showNotify("Error", true);
		}
	});
	*/
};


Server.deleteUrls = function (guid) {

	var obj = new execRestCmd(RestCmds.CMD_DelYtUrl, guid);

/*	
	Main.log("Server.deleteUrls");
	Main.logToServer("Server.deleteUrls guid=" + guid);
	Notify.handlerShowNotify("Deleting...", false);

	$.ajax({
		url: Config.serverUrl + "/deleteYtUrl?guid=" +guid,
		type : "POST",
		success : function(data, status, XHR ) {
			Notify.showNotify("Deleted", true);
			Data.deleteElm(Main.selectedVideo);
			if (Main.selectedVideo >= Data.getVideoCount())
				Main.selectedVideo = Data.getVideoCount() -1;
			Server.updateVdrStatus();
			Display.setVideoList(Main.selectedVideo, (Main.selectedVideo - Display.currentWindow));
			Main.logToServer("Server.deleteUrls: Success" );
			},
		error : function (XHR, status, error) {
			Main.logToServer("Server.deleteUrls: Error" );
			Notify.showNotify(status, true);

			// show popup
//			Notify.showNotify("Error", true);
		}
	});
*/
};


Server.getResume = function (guid) {
	Main.log ("***** getResume *****");
	var obj = new execRestCmd(RestCmds.CMD_GetResume, guid);
/*
	$.ajax({
		url: Config.serverUrl + "/getResume.xml",
		type : "POST",
		data : "filename:" + guid +"\n", 
		success : function(data, status, XHR ) {
			Main.log("**** Resome Success Response - status= " + status + " mime= " + XHR.responseType + " data= "+ data);

			var resume_str = $(data).find("resume").text();
			if (resume_str != "") {
				var resume_val = parseFloat(resume_str);
				Main.log("resume val= " + resume_val );
				Main.logToServer("resume val= " + resume_val );
				Player.resumePos = resume_val;
				Player.playVideo( resume_val);
			}
			else {
	    		Display.hide();
	        	Display.showProgress();
				Player.playVideo(-1);
			}

		},
		error : function (jqXHR, status, error) {
			Main.log("**** Resome Error Response - status= " + status + " error= "+ error);
    		Display.hide();
        	Display.showProgress();
			Player.playVideo(-1);
		}
	});
	*/
};

Server.saveResume = function() {
	var obj = new execRestCmd(RestCmds.CMD_SetResume, Data.getCurrentItem().childs[Main.selectedVideo].payload.guid);
/*
	var msg = ""; 
    msg += "filename:" + Data.getCurrentItem().childs[Main.selectedVideo].payload.guid + "\n"; 
    msg += "resume:"+ (Player.curPlayTime/1000) + "\n" ;
    	
	$.post(Config.serverUrl + "/setResume.xml", msg, function(data, textStatus, XHR) {
		Main.logToServer("SaveResume Status= " + XHR.status );
	}, "text");
*/
};

Server.execRecCmd = function (cmd, guid) {
	var obj = new execRestCmd(RestCmds.CMD_ExecRecCmd, guid, { cmd:cmd });

};

Server.deleteMedFile = function(guid) {
	var obj = new execRestCmd(RestCmds.CMD_DelMedFile, guid);
};

var RestCmds = {
	CMD_AddTimer : 0,
	CMD_DelMedFile : 1,
	CMD_DelYtUrl : 2,
	CMD_DelRec : 3,
	CMD_SetResume : 4,
	CMD_GetResume : 5,
	CMD_GetRecCmds : 6,
	CMD_ExecRecCmd : 7,
	CMD_ActTimer : 8,
	CMD_DelTimer : 9
};


//--------------------------------------------------------------------
//--------------------------------------------------------------------
//----------------- execRestCmd --------------------------------------
//--------------------------------------------------------------------
//--------------------------------------------------------------------
function execRestCmd(cmd, guid, parms) {
	this.successCallback = null;
	this.errorCallback = null;
	this.guid = guid;
	this.parms = parms;
	
	this.url = "";
	this.cmd = -1;
	this.method = "";
	
	switch(cmd) {
		case RestCmds.CMD_AddTimer:
			// add a timer
			
			this.url =Config.serverUrl + "/addTimer.xml?guid="+this.guid;
			this.cmd = cmd;
			this.method = "GET";
			
			this.successCallback = function(data, status, XHR ) {
				Notify.showNotify("Timer added", true);
				Main.log ("addTimer for Inst= " + this.guid +" status: " + ((status != null) ? status : "null"));  	
			};
		break;
		case RestCmds.CMD_DelMedFile:
			// delete a file from media folder
			
			Main.log("Server.deleteMedFile guid=" + guid);
			Main.logToServer("Server.deleteMedFile guid=" + guid);

			this.url =Config.serverUrl + "/deleteFile?guid=" +guid;
			this.cmd = cmd;
			this.method = "GET";
			
			this.successCallback = function(data, status, XHR ) {
				Notify.showNotify("Deleted", true);
				Data.deleteElm(Main.selectedVideo);
				if (Main.selectedVideo >= Data.getVideoCount())
				Main.selectedVideo = Data.getVideoCount() -1;
			};
		break;
		case RestCmds.CMD_DelYtUrl:
			// delete a YouTube URL
			
			Main.log("Server.deleteUrls");
			Main.logToServer("Server.deleteUrls guid=" + guid);
			Notify.handlerShowNotify("Deleting...", false);

			this.url =Config.serverUrl + "/deleteYtUrl?guid=" +guid;
			this.cmd = cmd;
			this.method = "POST";

			this.successCallback = function(data, status, XHR ) {
				Notify.showNotify("Deleted", true);
				Data.deleteElm(Main.selectedVideo);
				if (Main.selectedVideo >= Data.getVideoCount())
					Main.selectedVideo = Data.getVideoCount() -1;
				Server.updateVdrStatus();
				Display.setVideoList(Main.selectedVideo, (Main.selectedVideo - Display.currentWindow));
				Main.logToServer("Server.deleteUrls: Success" );

			};
			break;
		case RestCmds.CMD_DelRec:
			// Delete a Recording
			
			Main.log("Server.deleteRecording guid=" + guid);
			Main.logToServer("Server.deleteRecording guid=" + guid);
			Notify.handlerShowNotify("Deleting...", false);

			this.url =Config.serverUrl + "/deleteRecording.xml?id=" +guid;
			this.cmd = cmd;
			this.method = "POST";

			this.successCallback = function(data, status, XHR ) {
				Notify.showNotify("Deleted", true);
				Data.deleteElm(Main.selectedVideo);
				if (Main.selectedVideo >= Data.getVideoCount())
					Main.selectedVideo = Data.getVideoCount() -1;
				Server.updateVdrStatus();
				Display.setVideoList(Main.selectedVideo, (Main.selectedVideo - Display.currentWindow));
				Main.logToServer("Server.deleteRecording: Success" );
			};
			
		break;
		
		case RestCmds.CMD_SetResume :
			// Send Resume Data
			
			Main.log("Server.GetResume guid=" + guid);
			Main.logToServer("Server.GetResume guid=" + guid);
			this.url =Config.serverUrl + "/setResume.xml?guid=" +guid + "&resume=" + (Player.curPlayTime/1000);
			this.cmd = cmd;
			this.method = "POST";
			this.successCallback = function(data, status, XHR ) {
				Main.logToServer("SaveResume Status= " + XHR.status );
			};

			break;
		case RestCmds.CMD_GetResume :
			// Request Resume Data from VDR
			
			Main.log("Server.GetResume guid=" + guid);
			Main.logToServer("Server.GetResume guid=" + guid);

			this.url =Config.serverUrl + "/getResume.xml?guid=" +guid;
			this.cmd = cmd;
			this.method = "POST";
			
			this.successCallback = function(data, status, XHR ) {
				Main.log("**** Resome Success Response - status= " + status + " mime= " + XHR.responseType + " data= "+ data);

				var resume_str = $(data).find("resume").text();
				if (resume_str != "") {
					var resume_val = parseFloat(resume_str);
					Main.log("resume val= " + resume_val );
					Main.logToServer("resume val= " + resume_val );
					Player.resumePos = resume_val;
					Player.playVideo( resume_val);
				}
				else {
					Main.logToServer("ERROR: No resume data in response " );

		    		Display.hide();
		        	Display.showProgress();
					Player.playVideo(-1);
				}
			};

			this.errorCallback = function() {
				Display.hide();
				Display.showProgress();
				Player.playVideo(-1);
			};
			
			
			break;
			
		case RestCmds.CMD_ExecRecCmd :
			// Execute a recording command
		
			Main.logToServer("Server.execRecCmd cmd="+parms.cmd+" guid=" + guid );

			this.url = Config.serverUrl + "/execreccmd?cmd="+parms.cmd+"&guid=" + guid;
			this.cmd = cmd;
			this.method = "GET";

			this.successCallback = function(data, status, XHR ) {
				Main.logToServer("Server.execRecCmd OK" ) ;
				Display.handleDescription(Main.selectedVideo);
			};
			break;

		case RestCmds.CMD_ActTimer :
			// Activate or Deactivate a timer
		
			Main.logToServer("Server.ActTimer index=" + guid + " setActive= " + ((parms.setActive == true) ? "true" : "false" ));

			this.url = Config.serverUrl + "/activateTimer?index=" +guid + "&activate=" + ((parms.setActive == true) ? "true" : "false"),
			this.cmd = cmd;
			this.method = "GET";

			this.successCallback = function(data, status, XHR ) {
				Main.logToServer("Timers.activateTimer: Success" );
				Main.log("Timers.activateTimer: Success" );

				Timers.resetView();
			};
			break;

		case RestCmds.CMD_DelTimer :
			// Delete a timer
		
			Main.logToServer("Server.DelTimer index=" + guid );

			this.url = Config.serverUrl + "/deleteTimer?index=" +guid,
			this.cmd = cmd;
			this.method = "GET";

			this.successCallback = function(data, status, XHR ) {
				Main.logToServer("Timers.deleteTimer: Success" );
				Main.log("Timers.deleteTimer: Success" );

				Timers.resetView();
				// remove index from database
			};
			break;

		default:
			Main.log("execRestCmd - ERROR: CMD= " + cmd + " is not supported");
			Main.logToServer("execRestCmd - ERROR: CMD= " + cmd + " is not supported");
			break;
	};

	if (this.cmd > 0) 
		this.request();
	else {
		Main.logToServer("execRestCmd - CMD (" + cmd + ") Not found");
	}

};

execRestCmd.prototype.request = function () {
	Main.log("execRestCmd request url= " + this.url);

	$.ajax({
		url: this.url,
		type : this.method,
		context : this,
		timeout : 500,
		success : this.successCallback,
/*		function(data, status, XHR ) {
			if (this.successCallback != null)
				this.successCallback();
			switch (this.cmd) {
				case RestCmds.CMD_AddTimer:
					Notify.showNotify("Timer added", true);
					Main.log ("addTimer for Inst= " + this.guid +" status: " + ((status != null) ? status : "null"));  	
				break;

				case RestCmds.CMD_DelMedFile:
					Notify.showNotify("Deleted", true);
					Data.deleteElm(Main.selectedVideo);
					if (Main.selectedVideo >= Data.getVideoCount())
						Main.selectedVideo = Data.getVideoCount() -1;

					break;
				
				case RestCmds.CMD_DelYtUrl:
					Notify.showNotify("Deleted", true);
					Data.deleteElm(Main.selectedVideo);
					if (Main.selectedVideo >= Data.getVideoCount())
						Main.selectedVideo = Data.getVideoCount() -1;
					Server.updateVdrStatus();
					Display.setVideoList(Main.selectedVideo, (Main.selectedVideo - Display.currentWindow));
					Main.logToServer("Server.deleteUrls: Success" );
				break;

				case RestCmds.CMD_DelRec:
					Notify.showNotify("Deleted", true);
					Data.deleteElm(Main.selectedVideo);
					if (Main.selectedVideo >= Data.getVideoCount())
						Main.selectedVideo = Data.getVideoCount() -1;
					Server.updateVdrStatus();
					Display.setVideoList(Main.selectedVideo, (Main.selectedVideo - Display.currentWindow));
					Main.logToServer("Server.deleteRecording: Success" );
			
				break;

				default:
					Main.logToServer("execRestCmd - Success for cmd= " + this.cmd);
			};
		},*/
		error : function (XHR, status, error) {
			
			Main.logToServer("ERROR received for guid= " + this.guid + " status= " + status);
			if (status == "timeout") {
				Notify.showNotify( "Timeout.", true);
				
			}
			else {
				Main.log("ERROR= " + XHR.status + " text= " + XHR.responseText);
				var res = Server.getErrorText(XHR.status, XHR.responseText); 
		    	Main.log ("execRestCmd for Error Inst= " + this.guid+ " res= " + res); 
				Notify.showNotify( res, true);

				if (this.errorCallback != null)
					this.errorCallback();
				
			}
    		
		}
	});

};



function addTimer(guid) {
	this.successCallback = null;
	this.errorCallback = null;
	this.guid = guid;
	this.request();
};

addTimer.prototype.request = function () {
	var url =Config.serverUrl + "/addTimer.xml?guid="+this.guid;
	Main.log("addTimer request url= " + url);

	$.ajax({
		url: url,
		type : "GET",
		context : this,
		timeout : 400,
		success : function(data, status, XHR ) {
			Main.log ("addTimer for Inst= " + this.guid +" status: " + ((status != null) ? status : "null"));  	
		},
		error : function (XHR, status, error) {
	    	Main.log ("addTimer for Error Inst= " + this.guid+" status: " + ((status != null) ? status : "null")); 
	    	if (XHR.status == 400) {
	    		
	    		Display.showPopup("Timer creation failed channel= "+this.guid + " Text= " + XHR.responseText, true);	    		
	    	}
	    	else
	    		Display.showPopup("Timer creation failed channel= "+this.guid + " code= " + XHR.status, true);	    		
    		
		}
	});

};

var HeartbeatHandler = {
	timeoutObj : null,
	isActive : false
};


HeartbeatHandler.start = function(){
	if (this.isActive ==true)
		window.clearTimeout(this.timeoutObj);
		
	this.isActive = true;
	HeartbeatHandler.update();
};

HeartbeatHandler.update = function() {
	Server.notifyServer("running");
	this.timeoutObj = window.setTimeout(function() {HeartbeatHandler.update(); }, (60*1000)); // once every 1min
};

HeartbeatHandler.stop = function(){
	if (this.isActive == false )
		return;

	window.clearTimeout(this.timeoutObj);
	this.isActive = false;
};


