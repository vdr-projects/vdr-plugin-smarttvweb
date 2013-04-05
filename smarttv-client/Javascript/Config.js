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
	directAcessTimeout : 1500,
	preferredQuality : 2,
	widgetVersion : "unknown", 
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
//				Display.showPopup ("WARNING: Cannot create widget folder. Try Config");
		    	Display.showPopup (Lang[Lang.sel].configInit);    	

//				Main.logToServer("ERROR: Cannot create widget folder curWidget.id= " +curWidget.id);
			}
			return;
		}
		else {
			Config.readContext();
		}		
	}
	Server.notifyServer("started");
	Config.fetchConfig();
};

Config.doFirstLaunch = function () {
	Config.firstLaunch = true;

	Main.changeState(4);
};


Config.getWidgetVersion = function () {
	$.ajax({
		url: "config.xml",
		type : "GET",
		success : function(data, status, XHR ) {
			Config.widgetVersion = $(data).find('ver').text();
			Main.logToServer("Config.getWidgetVersion= " + Config.widgetVersion) ;
			Display.updateWidgetVersion(Config.widgetVersion);
		},
		error : function (XHR, status, error) {
			Main.log("Config.getVersion ERROR" ) ;
			Main.logToServer("Config.getVersion ERROR" ) ;
		}
	});
};


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
        	Config.directAcessTimeout = $(data).find('directAcessTimeout').text();
        	Config.preferredQuality = $(data).find('preferredQuality').text();
        	
        	Player.skipDuration = Config.skipDuration;
        	if (Config.directAcessTimeout != "") {
        		DirectAccess.delay = Config.directAcessTimeout;
        	}
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
//	    	Display.showPopup("Config Server Error " + XHR.status + " " + status);
	    	Display.showPopup(Lang[Lang.sel].configNoServer + " "+ XHR.status + " " + status);
	    	
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
		    if (avp.length > 1) {
		    	Config.serverAddr = avp[1];
		    	Config.serverUrl = "http://" + Config.serverAddr;
		    }
		    else {
//		    	Display.showPopup ("ERROR: Error in Config File. Try widget re-install.");    	
		    	Display.showPopup (Lang[Lang.sel].configRead1);    	

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
			
//			Display.showPopup ("WARNING: ConfigRead Error and WidgetFolder creation failed. <br> Launching Config-Menu from here");  
	    	Display.showPopup (Lang[Lang.sel].configRead2);    	
			
//			Main.log("-------------- Error: res = false ------------------------");			
		}
		Config.doFirstLaunch();

	}
};


// This function cleans up after un-installation
Config.reset = function () {
	var fileSystemObj = new FileSystem();
	fileSystemObj.deleteCommonFile(curWidget.id + "/config.dta");
};
