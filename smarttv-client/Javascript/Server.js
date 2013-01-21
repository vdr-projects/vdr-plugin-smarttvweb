var Server =
{
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
	
//    var splashElement = document.getElementById("splashStatus");  
//    Display.putInnerHTML(splashElement, "Creating Video list now" );

	if (this.XHRObj.status != 200) {
//		Display.putInnerHTML(splashElement, "XML Server Error " + this.XHRObj.status);
//        Display.status("XML Server Error " + this.XHRObj.status);
//    	Display.showPopup("XML Server Error " + this.XHRObj.status);
        if (this.errorCallback != null) {
        	this.errorCallback(this.XHRObj.responseText);
        }
    }
    else
    {
    	var xmlResponse = this.XHRObj.responseXML;
    	if (xmlResponse == null) {
            Display.status("xmlResponse == null" );
//            Display.putInnerHTML(splashElement, "Error in XML File ");
        	Display.showPopup("Error in XML File");
            if (this.errorCallback != null) {
            	this.errorCallback("XmlError");
            }
            return;
    	}
    	var xmlElement = xmlResponse.documentElement;
//    	var xmlElement = this.XHRObj.responseXML.documentElement;
        
        if (!xmlElement) {
//        	Display.putInnerHTML(splashElement, "Failed to get valid XML!!!");
            Display.status("Failed to get valid XML");
        	Display.showPopup("Failed to get valid XML");
            return;
        }
        else
        {
//        	Display.putInnerHTML(splashElement, "Parsing ...");
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
            	    fps = parseInt(items[index].getElementsByTagName("fps")[0].firstChild.data);
            	}
            	catch (e) {}
            	var desc = descriptionElement.firstChild.data;

                if (titleElement && linkElement) {
                	var title_list = titleElement.firstChild.data.split("~");
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
//            Display.putInnerHTML(splashElement, "Done...");

            if (this.dataReceivedCallback)
            {
                this.dataReceivedCallback();    /* Notify all data is received and stored */
            }
        }
    }
};



Server.getResume = function (guid) {
	Main.log ("***** getResume *****");
	$.ajax({
		url: Config.serverUrl + "/getResume.xml",
		type : "POST",
		data : "filename:" + guid +"\n", 
		success : function(data, status, XHR ) {
			Main.log("**** Resome Success Response - status= " + status + " mime= " + XHR.responseType + " data= "+ data);
			var xmlResponse = XHR.responseXML;
			if (xmlResponse == null) {
				Main.logToServer("Resume: xmlResponse is null");
	    		Display.hide();
	        	Display.showProgress();
				Player.playVideo();
			}
			var xmlElement = xmlResponse.documentElement;
			if (!xmlElement) {
				Main.logToServer("Resume: Dont get xml");
	    		Display.hide();
	        	Display.showProgress();
				Player.playVideo();

			}
			var xml_str = (new XMLSerializer()).serializeToString(xmlElement);
			Main.logToServer(" XML Response= " + xml_str + " NodeType= " + xmlElement.nodeType);
			Main.logToServer("xmlElement.firstChild.nodeType= " + xmlElement.firstChild.nodeType);
			Main.logToServer("xmlElement.firstChild.nodeName= " + xmlElement.firstChild.nodeName);
			Main.logToServer("xmlElement.firstChild.nodeValue= " + xmlElement.firstChild.nodeValue);
			var resume_val = -1.0;
			try {
				resume_val = parseFloat(xmlElement.firstChild.nodeValue);
				Main.log("resume val= " + resume_val );
				Main.logToServer("resume val= " + resume_val );
				Player.resumePos = resume_val;
				Buttons.show();
//				Player.playVideo( resume_val);
			}
			catch (e) {
				Main.log("Resume Parsing Error: " +e);
	    		Display.hide();
	        	Display.showProgress();
				Player.playVideo();
			}
			
		},
		error : function (jqXHR, status, error) {
			Main.log("**** Resome Error Response - status= " + status + " error= "+ error);
    		Display.hide();
        	Display.showProgress();
			Player.playVideo();
		}
	});
};

