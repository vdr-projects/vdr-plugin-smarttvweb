var Config = {
	cfgFileName : curWidget.id + "/config.dta",
	XHRObj : null,
	xmlDocument : null,
	serverUrl : "",  // Will become the main URL for contacting the server
	serverAddr : "192.168.1.122:8000",
	format :"has",
	tgtBufferBitrate : 6000, // kbps
	totalBufferDuration : 30, // sec
	initialBuffer : 10, // in percent
	pendingBuffer: 40, // in percent
	initialTimeOut: 3, // sec
	skipDuration : 30, // sec
	noLiveChannels : 30, 
	firstLaunch : false
};


/*
 * Check for First launch
 * Launch Config Menu
 * Write File in Confi Menu
 * Come back here, read the file and continue
 */


Config.init = function () {
    var fileSystemObj = new FileSystem();
	
	if (fileSystemObj.isValidCommonPath(curWidget.id) == 0){
		Display.showPopup ("First Launch of the Widget --> Launching Config Menu");
		alert("First Launch of the Widget");
		// should switch to the config screen here
		var res = fileSystemObj.createCommonDir(curWidget.id);
		if (res == true) {
			Config.firstLaunch = true;
		    
//			Config.writeContext("192.168.1.122:8000");
			Main.changeState(4);
			return;
		}
		else {
			Display.showPopup ("ERROR: Cannot create widget folder");
		}
		return;
	}

	else {
		Config.readContext();
	}

	Config.fetchConfig();
};

Config.fetchConfig = function () {
    if (this.XHRObj == null) {
        this.XHRObj = new XMLHttpRequest();
    }
    
    if (this.XHRObj) {

    	this.XHRObj.onreadystatechange = function() {
    		if (Config.XHRObj.readyState == 4) {
    			Config.processConfig();
                }
            };
            
        this.XHRObj.open("GET", this.serverUrl + "/widget.conf", true);
        this.XHRObj.send(null);
    }
};
	
Config.writeContext = function (addr) {
	var fileSystemObj = new FileSystem();

	var fd = fileSystemObj.openCommonFile(Config.cfgFileName,"w");

    fd.writeLine('serverAddr ' + addr); // SHould be overwritten by Options menue
    fileSystemObj.closeCommonFile(fd);
};

Config.updateContext = function (addr) {
	var fileSystemObj = new FileSystem();

	var fd = fileSystemObj.openCommonFile(Config.cfgFileName,"w");

    fd.writeLine('serverAddr ' + addr); // SHould be overwritten by Options menue
    fileSystemObj.closeCommonFile(fd);

    Config.serverAddr = addr;
    Config.serverUrl = "http://" + Config.serverAddr;
};

Config.readContext = function () {
	var fileSystemObj = new FileSystem();

//	Display.showPopup ("Reading Config file for curWidget.id= " + curWidget.id);  

	try {
		var fd = fileSystemObj.openCommonFile(Config.cfgFileName, "r");

		var line = "";
	    
		while (line = fd.readLine()) {
		    var avp = line.split(" ");
//		    Display.showPopup ("Reading Config: attr= " + avp[0] + " val= " + avp[1]);
		    if (avp.length > 1) {
		    	Config.serverAddr = avp[1];
		    	Config.serverUrl = "http://" + Config.serverAddr;
		    }
		    else {
		    	Display.showPopup ("WARNING: Error in Config File");
		    }
		}
		fileSystemObj.closeCommonFile(fd);		
	}
	catch (e) {
		var res = fileSystemObj.createCommonDir(curWidget.id);
		if (res == true) {
			Display.showPopup ("*** Read Error and Widget Folder successfully created ***");  
			alert("-------------- Error: res = true ------------------------");
		}
		else {
			Display.showPopup ("*** Read Error and Widget Folder creation failed ***");  
			alert("-------------- Error: res = false ------------------------");			
		}

		Config.firstLaunch = true;
		Main.changeState(4);
	}
};


Config.getXmlValue = function (itm) {
	var val = this.xmlDocument.getElementsByTagName(itm);
	var res = 0;
	try {
		res = val[0].firstChild.data;
	}
	catch (e) {
		Main.log("parsing widget.conf: Item= " + itm + " not found" + e);
		alert ("parsing widget.conf: Item= " + itm + " not found e= " + e);
	}
	return res;

};

Config.getXmlString = function (itm) {
	var val = this.xmlDocument.getElementsByTagName(itm);
	
	var res = "";
	try {
		res = val[0].firstChild.data;
	}
	catch (e) {
		Main.log("parsing widget.conf: Item= " + itm + " not found" + e);
		alert ("parsing widget.conf: Item= " + itm + " not found e= " + e);
	};

	return res;
};

Config.processConfig = function () {
	if (this.XHRObj.status != 200) {
    	alert ("Config Server Error");  	
    	Display.showPopup("Config Server Error " + this.XHRObj.status);
    	Main.log("Config Server Error " + this.XHRObj.status);
    }
    else {
    	var xmlResponse = this.XHRObj.responseXML;
    	if (xmlResponse == null) {
    		alert ("xml error");
        	Display.showPopup("Error in XML Config File");
            return;
    	}
    	this.xmlDocument = xmlResponse.documentElement;
        if (!this.xmlDocument ) {
            alert("Failed to get valid Config XML");
        	Display.showPopup("Failed to get valid Config XML");
            return;
        }
        else  {
        	alert ("Paring config XML now");
        	this.format = Config.getXmlString("format");
        	var res = Config.getXmlValue("tgtBufferBitrate");
        	if (res != 0)
        		this.tgtBufferBitrate = 1.0 * res;
        	res = Config.getXmlValue("totalBufferDuration");
        	if (res != 0) this.totalBufferDuration = 1.0 * res;

        	res= Config.getXmlValue("initialBuffer");
        	if (res != 0) this.initialBuffer = 1.0 * res;

        	res = Config.getXmlValue("pendingBuffer");
        	if (res != 0) this.pendingBuffer = 1.0 * res;

        	res = Config.getXmlValue("skipDuration");
        	if (res != 0) this.skipDuration= 1.0 * res;

        	res = Config.getXmlValue("initialTimeOut");
        	if (res != 0) this.initialTimeOut = 1.0 * res;

        	res = Config.getXmlValue("liveChannels");
        	if (res != 0) noLiveChannels = res;
        	
        	alert("**** Config ****");
        	alert("serverUrl= " + Config.serverUrl);
        	alert("format= " + Config.format);
        	alert("tgtBufferBitrate= " + Config.tgtBufferBitrate);
        	alert("totalBufferDuration= " + Config.totalBufferDuration);
        	alert("initialBuffer= " + Config.initialBuffer);
        	alert("pendingBuffer= " + Config.pendingBuffer);
        	alert("skipDuration= " + Config.skipDuration);
        	alert("initialTimeOut= " + Config.initialTimeOut);
        	alert("**** /Config ****");      	
        };
    	
    };

    Main.init();
};

// This function cleans up after un-installation
Config.reset = function () {
	var fileSystemObj = new FileSystem();
	fileSystemObj.deleteCommonFile(curWidget.id + "/config.dta");
};
