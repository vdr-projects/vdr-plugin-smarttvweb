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
    
//    var splashElement = document.getElementById("splashStatus");  
//    Display.putInnerHTML(splashElement, "Starting Up");

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
//	Main.log ("***** getResume *****");
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
//				Main.log("Server.fetchVideoList: title= " + title + " start= " + startVal + " dur= " + durVal + " fps= " + fps);
				
				if (Main.state == Main.eLIVE) {
					Epg.guidTitle[guid] = title;
//					Main.log("Server: Guid= " + guid +" -> " + Epg.guidTitle[guid]);
				}

                var title_list = title.split("~");
//				Main.log("Server.createVideoList: guid= " + guid + " link= " + link);
//				Main.log("Server.createVideoList: guid= " + guid + " startVal= " + startVal + " durVal= " +durVal);
                Data.addItem( title_list, {link : link, prog: programme, desc: description, guid : guid, start: startVal, 
                			dur: durVal, ispes : ispes, isnew : isnew, fps : fps});              	
							
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
/*
Server.fetchVideoList = function(url) {
	Main.log("fetching Videos url= " + url);
    if (this.XHRObj == null) {
        this.XHRObj = new XMLHttpRequest();
    }
    
    if (this.XHRObj) {
        this.XHRObj.onreadystatechange = function()
            {
//            var splashElement = document.getElementById("splashStatus");  
//            Display.putInnerHTML(splashElement, "State" + Server.XHRObj.readyState);

        	if (Server.XHRObj.readyState == 4) {
                    Server.createVideoList();
                }
            };
            
        this.XHRObj.open("GET", url, true);
        this.XHRObj.send(null);
    }
    else {
//        var splashElement = document.getElementById("splashStatus");  
//        Display.putInnerHTML(splashElement, "Failed !!!" );
    	Display.showPopup("Failed to create XHR");

        if (this.errorCallback != null) {
        	this.errorCallback("ServerError");
        }
    }
};

Server.createVideoList = function() {
	Main.log ("creating Video list now");
	Main.logToServer("creating Video list now");
	

	if (this.XHRObj.status != 200) {
        if (this.errorCallback != null) {
        	this.errorCallback(this.XHRObj.responseText);
        }
    }
    else
    {
    	var xmlResponse = this.XHRObj.responseXML;
    	if (xmlResponse == null) {
            Display.status("xmlResponse == null" );
        	Display.showPopup("Error in XML File");
            if (this.errorCallback != null) {
            	this.errorCallback("XmlError");
            }
            return;
    	}
    	var xmlElement = xmlResponse.documentElement;
        
        if (!xmlElement) {
            Display.status("Failed to get valid XML");
        	Display.showPopup("Failed to get valid XML");
            return;
        }
        else
        {
            var items = xmlElement.getElementsByTagName("item");          
            if (items.length == 0) {
            	Display.showPopup("Something wrong. Response does not contain any item");
            	Main.logToServer("Something wrong. Response does not contain any item");
            	
            };
            
            for (var index = 0; index < items.length; index++) {
            	
                var titleElement = items[index].getElementsByTagName("title")[0];
                var progElement = items[index].getElementsByTagName("programme")[0];
                var descriptionElement = items[index].getElementsByTagName("description")[0];
                var linkElement = items[index].getElementsByTagName("link")[0];
//                var startstrVal = "";
                var startVal =0;
                var durVal  =0;
                var guid = "";
                var fps = -1;
                var ispes = "unknown";
                var isnew = "unknown";
                try {
//            	    startstrVal = items[index].getElementsByTagName("startstr")[0].firstChild.data;
            	    startVal = parseInt(items[index].getElementsByTagName("start")[0].firstChild.data);
            	    durVal = parseInt(items[index].getElementsByTagName("duration")[0].firstChild.data);
            	    guid= items[index].getElementsByTagName("guid")[0].firstChild.data;
					Main.log ("guid= " + items[index].getElementsByTagName("guid")[0].firstChild.data);
                }
            	catch (e) {            		
            	    Main.log("ERROR: "+e);
            	}        
            	try {
            	    ispes = items[index].getElementsByTagName("ispes")[0].firstChild.data;
            	}
            	catch (e) {}
            	try {
            	    isnew = items[index].getElementsByTagName("isnew")[0].firstChild.data;
            	}
            	catch (e) {}

            	try {
            	    fps = parseFloat(items[index].getElementsByTagName("fps")[0].firstChild.data);
            	}
            	catch (e) {}
            	var desc = descriptionElement.firstChild.data;

				if (Main.state == Main.eLIVE) {
					Epg.guidTitle[guid] = titleElement.firstChild.data;
//					Main.log("Server: Guid= " + guid +" -> " + Epg.guidTitle[guid]);
				}
                if (titleElement && linkElement) {
                	var title_list = titleElement.firstChild.data.split("~");
					Main.log("Server.createVideoList: guid= " + guid + " startVal= " + startVal + " durVal= " +durVal);
                	Data.addItem( title_list, {link : linkElement.firstChild.data, 
                			prog: progElement.firstChild.data, 
                			desc: desc, 
//                			startstr: startstrVal, 
                			guid : guid,
                			start: startVal, 
                			dur: durVal,
                			ispes : ispes,
                			isnew : isnew,
                			fps : fps});              	
            	}
                
            }
            Data.completed(this.doSort);

            if (this.dataReceivedCallback)
            {
                this.dataReceivedCallback();
            }
        }
    }
};
*/

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
//			Main.log ("free.length= " + free_str.length);
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
//			Buttons.show();
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
    	// 
//    	var msg = "devid:" + Network.getMac() + "\n"; 
//    	Player.curPlayTime = 15.4 * 1000;
	var msg = ""; 
    msg += "filename:" + Data.getCurrentItem().childs[Main.selectedVideo].payload.guid + "\n"; 
    msg += "resume:"+ (Player.curPlayTime/1000) + "\n" ;
    	
	$.post(Config.serverUrl + "/setResume.xml", msg, function(data, textStatus, XHR) {
		Main.logToServer("SaveResume Status= " + XHR.status );
	}, "text");

/*	var XHRObj = new XMLHttpRequest();
    XHRObj.open("POST", Config.serverUrl + "/setResume.xml", true);
    XHRObj.send(msg);
 */   	
};

Server.deleteRecording = function(guid) {
/*	$.post(Config.serverUrl + "/deleteRecording.xml?id=" +guid, "", function(data, textStatus, XHR) {
		Main.logToServer("deleteRecording Status= " + XHR.status );
	}, "text");
*/
	Main.log("Server.deleteRecording guid=" + guid);
	Main.logToServer("Server.deleteRecording guid=" + guid);
	Notify.handlerShowNotify("Deleting...", false);

	$.ajax({
		url: Config.serverUrl + "/deleteRecording.xml?id=" +guid,
		type : "POST",
		success : function(data, status, XHR ) {
			// Show popup
			// delete from data
			//update vdrstatus
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
