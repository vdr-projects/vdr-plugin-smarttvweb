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
    if (this.XHRObj == null) {
        this.XHRObj = new XMLHttpRequest();
    }
    
    if (this.XHRObj) {
        this.XHRObj.onreadystatechange = function()
            {
 //           var splashElement = document.getElementById("splashStatus");  

        	if (Server.XHRObj.readyState == 4) {
                    Server.createVideoList();
                }
            };
            
        this.XHRObj.open("GET", url, true);
        this.XHRObj.send(null);
    }
    else {
    	console.log("Failed to create XHR");

        if (this.errorCallback != null) {
        	this.errorCallback("ServerError");
        }
    }
};

Server.createVideoList = function() {
	console.log ("creating Video list now");
	console.log ("status= " + this.XHRObj.status);
    
	if (this.XHRObj.status != 200) {
            if (this.errorCallback != null) {
        	this.errorCallback(this.XHRObj.responseText);
        }
    }
    else {
    	var xmlResponse = this.XHRObj.responseXML;
    	if (xmlResponse == null) {
            if (this.errorCallback != null) {
            	this.errorCallback("XmlError");
            }
            return;
    	}
    	var xmlElement = xmlResponse.documentElement;
        
        if (!xmlElement) {
        	console.log("Failed to get valid XML");
            return;
        }
        else
        {
            var items = xmlElement.getElementsByTagName("item");          
            if (items.length == 0) {
            	console.log("Something wrong. Response does not contain any item");            	
	        	this.errorCallback("Empty Response");
			};
            
            for (var index = 0; index < items.length; index++) {
            	
                var titleElement = items[index].getElementsByTagName("title")[0];
                var progElement = items[index].getElementsByTagName("programme")[0];
                var descriptionElement = items[index].getElementsByTagName("description")[0];
                var linkElement = items[index].getElementsByTagName("link")[0];
                var startVal =0;
                var durVal  =0;
                try {
            	    startVal = parseInt(items[index].getElementsByTagName("start")[0].firstChild.data);
            	    durVal = parseInt(items[index].getElementsByTagName("duration")[0].firstChild.data);
            	}
            	catch (e) {
					this.errorCallback("XML Parsing Error: " + e);
            	    console.log("ERROR: "+e);
            	}        
           	
            	var desc = descriptionElement.firstChild.data;

                if (titleElement && linkElement) {
                	var title_list = titleElement.firstChild.data.split("~");
                	Data.addItem( title_list, {link : linkElement.firstChild.data, 
                			prog: progElement.firstChild.data, 
                			desc: desc, 
                			start: startVal, 
                			dur: durVal});              	
            	}
                
            }
            Data.completed(this.doSort);

            if (this.dataReceivedCallback)
            {
                this.dataReceivedCallback();    /* Notify all data is received and stored */
            }
        }
    }
};
