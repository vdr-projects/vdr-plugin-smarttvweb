var Server = {
    dataReceivedCallback : null,
    errorCallback : null,
    doSort : false,
    retries : 0,

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
                			dur: durVal, ispes : ispes, isnew : isnew, fps : fps, num : num});              	
							
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


//---------------------------------------------

Server.updateVdrStatus = function (){
	Main.log ("get VDR Status");
	$.ajax({
		url: Config.serverUrl + "/vdrstatus.xml",
		type : "GET",
		success : function(data, status, XHR){
			var free = $(data).find('free').text() / 1024.0;
			var used = $(data).find('used').text() / 1024.0;
			var percent = $(data).find('percent').text();
	
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
}


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

Server.saveResume = function() {
	var msg = ""; 
    msg += "filename:" + Data.getCurrentItem().childs[Main.selectedVideo].payload.guid + "\n"; 
    msg += "resume:"+ (Player.curPlayTime/1000) + "\n" ;
    	
	$.post(Config.serverUrl + "/setResume.xml", msg, function(data, textStatus, XHR) {
		Main.logToServer("SaveResume Status= " + XHR.status );
	}, "text");

};

Server.deleteRecording = function(guid) {
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
};
