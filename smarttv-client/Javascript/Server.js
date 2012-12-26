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
    
    var splashElement = document.getElementById("splashStatus");  
    widgetAPI.putInnerHTML(splashElement, "Starting Up");

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
	alert("fetching Videos url= " + url);
    if (this.XHRObj == null) {
        this.XHRObj = new XMLHttpRequest();
    }
    
    if (this.XHRObj) {
        this.XHRObj.onreadystatechange = function()
            {
            var splashElement = document.getElementById("splashStatus");  
            widgetAPI.putInnerHTML(splashElement, "State" + Server.XHRObj.readyState);

        	if (Server.XHRObj.readyState == 4) {
                    Server.createVideoList();
                }
            };
            
        this.XHRObj.open("GET", url, true);
        this.XHRObj.send(null);
    }
    else {
        var splashElement = document.getElementById("splashStatus");  
        widgetAPI.putInnerHTML(splashElement, "Failed !!!" );
    	Display.showPopup("Failed to create XHR");

        if (this.errorCallback != null) {
        	this.errorCallback("ServerError");
        }
    }
};

Server.createVideoList = function() {
	alert ("creating Video list now");
    var splashElement = document.getElementById("splashStatus");  
    widgetAPI.putInnerHTML(splashElement, "Creating Video list now" );

	if (this.XHRObj.status != 200) {
        widgetAPI.putInnerHTML(splashElement, "XML Server Error " + this.XHRObj.status);
        Display.status("XML Server Error " + this.XHRObj.status);
    	Display.showPopup("XML Server Error " + this.XHRObj.status);
        if (this.errorCallback != null) {
        	this.errorCallback("ServerError");
        }
    }
    else
    {
    	var xmlResponse = this.XHRObj.responseXML;
    	if (xmlResponse == null) {
            Display.status("xmlResponse == null" );
            widgetAPI.putInnerHTML(splashElement, "Error in XML File ");
        	Display.showPopup("Error in XML File");
            if (this.errorCallback != null) {
            	this.errorCallback("XmlError");
            }
            return;
    	}
    	var xmlElement = xmlResponse.documentElement;
//    	var xmlElement = this.XHRObj.responseXML.documentElement;
        
        if (!xmlElement) {
            widgetAPI.putInnerHTML(splashElement, "Failed to get valid XML!!!");
            Display.status("Failed to get valid XML");
        	Display.showPopup("Failed to get valid XML");
            return;
        }
        else
        {
            widgetAPI.putInnerHTML(splashElement, "Parsing ...");
            var items = xmlElement.getElementsByTagName("item");          
            
            for (var index = 0; index < items.length; index++) {
            	
                var titleElement = items[index].getElementsByTagName("title")[0];
                var progElement = items[index].getElementsByTagName("programme")[0];
                var descriptionElement = items[index].getElementsByTagName("description")[0];
                var linkElement = items[index].getElementsByTagName("link")[0];
//                var startstrVal = "";
                var startVal =0;
                var durVal  =0;
                try {
//            	    startstrVal = items[index].getElementsByTagName("startstr")[0].firstChild.data;
            	    startVal = parseInt(items[index].getElementsByTagName("start")[0].firstChild.data);
            	    durVal = parseInt(items[index].getElementsByTagName("duration")[0].firstChild.data);
            	}
            	catch (e) {
            		
            	    alert("ERROR: "+e);
            	}        
           	
            	var desc = descriptionElement.firstChild.data;

                if (titleElement && linkElement) {
                	var title_list = titleElement.firstChild.data.split("~");
                	Data.addItem( title_list, {link : linkElement.firstChild.data, 
                			prog: progElement.firstChild.data, 
                			desc: desc, 
//                			startstr: startstrVal, 
                			start: startVal, 
                			dur: durVal});              	
            	}
                
            }
            Data.completed(this.doSort);
            widgetAPI.putInnerHTML(splashElement, "Done...");

            if (this.dataReceivedCallback)
            {
                this.dataReceivedCallback();    /* Notify all data is received and stored */
            }
        }
    }
};
