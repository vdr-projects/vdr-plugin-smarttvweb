var Config = {
	cfgFileName : "",
	XHRObj : null,
	xmlDocument : null,
	serverUrl : "",  // Will become the main URL for contacting the server. Form "http://<server>:port"
	serverAddr : "",
	serverAddrDefault: "192.168.1.122:8000", 
	format :"has",
	tgtBufferBitrate : 6000, // kbps
	totalBufferDuration : 30, // sec
	initialBuffer : 10, // in percent
	pendingBuffer: 40, // in percent
	initialTimeOut: 3, // sec
	skipDuration : 30, // sec
	liveChannels : 30, 
	firstLaunch : false,
	debug : false,
	usePdlForRecordings : true,
	uploadJsFile : "",
	
	deviceType : 0   // Used to differentiate between browsers and platforms
	// 0: Samsung

};


/*
 * Check for First launch
 * Launch Config Menu
 * Write File in Confi Menu
 * Come back here, read the file and continue
 */

Config.init = function () {


/*	Main.logToServer ("navigator.appCodeName= " + navigator.appCodeName);
	Main.logToServer ("navigator.appName= " + navigator.appName);
	Main.logToServer ("navigator.platform= " + navigator.platform);

	Main.logToServer ("modelName= " + deviceapis.tv.info.getModel());
	Main.logToServer ("productType= " + deviceapis.tv.info.getProduct());
*/
	
	if (this.deviceType == 0) {
		// This is a Samsung Smart TV

		if (this.serverUrl != "") {
			// Hardcoded server URL. Done with config
			Main.log ("Hardcoded server URL. Done with config");
			Config.fetchConfig();
			return;
		}
		
		try {
			this.cfgFileName = curWidget.id + "/config.dta";
		}
		catch (e) {		
			Main.log("curWidget.id does not exists. Is that really a Samsung?");
			return;
		};
		
		var fileSystemObj = new FileSystem();
	    
		if (fileSystemObj.isValidCommonPath(curWidget.id) == 0){
			Main.log("First Launch of the Widget");
			// should switch to the config screen here
			var res = fileSystemObj.createCommonDir(curWidget.id);
			if (res == true) {
				Config.doFirstLaunch();
				return;
			}
			else {
				Config.doFirstLaunch();
//				Main.init();
				Display.showPopup ("WARNING: Cannot create widget folder. Try Config");
//				Main.logToServer("ERROR: Cannot create widget folder curWidget.id= " +curWidget.id);
			}
			return;
		}
		else {
			Config.readContext();
		}		
	}

	Config.fetchConfig();
};

Config.doFirstLaunch = function () {
	Config.firstLaunch = true;
//	Main.init(); // Obsolete? 

	Main.changeState(4);
};

/*
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
*/
Config.fetchConfig = function () {
	$.ajax({
		url: this.serverUrl + "/widget.conf",
		type : "GET",
		success : function(data, status, XHR ) {
        	Main.log ("Parsing config XML now");
        	Main.logToServer("Parsing config XML now");
        	Config.format = $(data).find('format').text();

        	Config.tgtBufferBitrate = parseFloat($(data).find('tgtBufferBitrate').text());
        	Config.totalBufferDuration = parseFloat($(data).find('totalBufferDuration').text());
        	Config.initialBuffer = parseFloat($(data).find('initialBuffer').text());
        	Config.pendingBuffer = parseFloat($(data).find('pendingBuffer').text());
        	Config.skipDuration = parseFloat($(data).find('skipDuration').text());
        	Config.initialTimeOut = parseFloat($(data).find('initialTimeOut').text());
        	Config.liveChannels = parseInt($(data).find('liveChannels').text());

        	Config.debug = ($(data).find('widgetdebug').text() == "true") ? true : false;
        	Config.usePdlForRecordings = ($(data).find('usePdlForRecordings').text() == "false") ? false : true;
        	Config.uploadJsFile = $(data).find('uploadJsFile').text();
        	
        	Player.skipDuration = Config.skipDuration;
        	Main.log("**** Config ****");
        	Main.log("serverUrl= " + Config.serverUrl);
        	Main.log("format= " + Config.format);
        	Main.log("tgtBufferBitrate= " + Config.tgtBufferBitrate);
        	Main.log("totalBufferDuration= " + Config.totalBufferDuration);
        	Main.log("initialBuffer= " + Config.initialBuffer);
        	Main.log("pendingBuffer= " + Config.pendingBuffer);
        	Main.log("skipDuration= " + Config.skipDuration);
        	Main.log("initialTimeOut= " + Config.initialTimeOut);
        	Main.log("liveChannels= " + Config.liveChannels);
        	Main.log("debug= " + Config.debug);
        	Main.log("usePdlForRecordings= " + Config.usePdlForRecordings);
        	
        	Main.log("**** /Config ****");      	
            Main.init();

		},
		error : function (XHR, status, error) {
	    	Main.log ("Config Server Error");  	
	    	Display.showPopup("Config Server Error " + XHR.status + " " + status);
	    	Main.logToServer("Config Server Error " + XHR.status + " " + status);

		}
	});
};


Config.writeContext = function (addr) {
	var fileSystemObj = new FileSystem();

	var fd = fileSystemObj.openCommonFile(Config.cfgFileName,"w");

    fd.writeLine('serverAddr ' + addr); // SHould be overwritten by Options menue
    fileSystemObj.closeCommonFile(fd);
};

Config.updateContext = function (addr) {
	Main.log("Config.updateContext with ("+addr+")");
	var fileSystemObj = new FileSystem();

	var fd = fileSystemObj.openCommonFile(Config.cfgFileName,"w");

    fd.writeLine('serverAddr ' + addr); // SHould be overwritten by Options menue
    fileSystemObj.closeCommonFile(fd);

    Config.serverAddr = addr;
    Config.serverUrl = "http://" + Config.serverAddr;
	Config.fetchConfig();
};

Config.readContext = function () {
	var fileSystemObj = new FileSystem();

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
		    	Display.showPopup ("ERROR: Error in Config File. Try widget re-install.");    	
		    	// TODO: I should re-write the config file
		    }
		}
		fileSystemObj.closeCommonFile(fd);	
	}
	catch (e) {
		Main.log("Config.readContext: Error while reading: e= " +e);
		var res = fileSystemObj.createCommonDir(curWidget.id);
		if (res == true) {
			Main.log("WARNING: ConfigRead Error. Launching Config-Menu from here");
			//			Display.showPopup ("Config Read Error:  Try widget restart");  
			
		}
		else {
			Main.log("Config.readContext: Widget Folder creation failed");
			
			Display.showPopup ("WARNING: ConfigRead Error and WidgetFolder creation failed. <br> Launching Config-Menu from here");  
//			Main.log("-------------- Error: res = false ------------------------");			
		}
		Config.doFirstLaunch();

	}
};

/*
Config.getXmlValue = function (itm) {
	var val = this.xmlDocument.getElementsByTagName(itm);
	var res = 0;
	try {
		res = val[0].firstChild.data;
	}
	catch (e) {
		Main.logToServer("parsing widget.conf: Item= " + itm + " not found" + e);
		Main.log ("parsing widget.conf: Item= " + itm + " not found e= " + e);
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
		Main.logToServer("parsing widget.conf: Item= " + itm + " not found" + e);
		Main.log ("parsing widget.conf: Item= " + itm + " not found e= " + e);
	};

	return res;
};
*/
/*
Config.processConfig = function () {
	if (this.XHRObj.status != 200) {
    	Main.log ("Config Server Error");  	
    	Display.showPopup("Config Server Error " + this.XHRObj.status);
    	Main.logToServer("Config Server Error " + this.XHRObj.status);
    }
    else {
    	var xmlResponse = this.XHRObj.responseXML;
    	if (xmlResponse == null) {
    		Main.log ("xml error");
        	Display.showPopup("Error in XML Config File");
        	Main.logToServer("Error in XML Config File");
            return;
    	}
    	this.xmlDocument = xmlResponse.documentElement;
        if (!this.xmlDocument ) {
            Main.log("Failed to get valid Config XML");
        	Display.showPopup("Failed to get valid Config XML");
        	Main.logToServer("Failed to get valid Config XML");
            return;
        }
        else  {
    		Config.firstLaunch = false;

        	Main.log ("Parsing config XML now");
        	Main.logToServer("Parsing config XML now");
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
        	if (res != 0) this.liveChannels = res;
        	
        	Player.skipDuration = Config.skipDuration;
        	Main.log("**** Config ****");
        	Main.log("serverUrl= " + Config.serverUrl);
        	Main.log("format= " + Config.format);
        	Main.log("tgtBufferBitrate= " + Config.tgtBufferBitrate);
        	Main.log("totalBufferDuration= " + Config.totalBufferDuration);
        	Main.log("initialBuffer= " + Config.initialBuffer);
        	Main.log("pendingBuffer= " + Config.pendingBuffer);
        	Main.log("skipDuration= " + Config.skipDuration);
        	Main.log("initialTimeOut= " + Config.initialTimeOut);
        	Main.log("liveChannels= " + Config.liveChannels);
        	
        	Main.log("**** /Config ****");      	
        };
    	
    };

    Main.init();
};
*/
// This function cleans up after un-installation
Config.reset = function () {
	var fileSystemObj = new FileSystem();
	fileSystemObj.deleteCommonFile(curWidget.id + "/config.dta");
};
