var Config = {
	cfgFileName : "",
	XHRObj : null,
	xmlDocument : null,
	vdrServers : null,
	serverUrl : "",  // Will become the main URL for contacting the server. Form "http://<server>:port"
	serverAddr : "",
	serverName : "", 
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
	infoTimeout : 3000,
	preferredQuality : 2,
	widgetVersion : "unknown",
	tzCorrection : 0,
	recSortType : 0,
	playKeyBehavior : 0,
	haveYouTube : false,
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

	this.vdrServers = new VdrServers();
	this.vdrServers.instanceName = " MyObj"; 
	if (this.serverUrl != "") {
		// Hardcoded server URL. Done with config
		Main.log ("Hardcoded server URL. Done with config");
		Config.fetchConfig();
		return;
	}

	
//	if (this.deviceType == 0)
	switch (this.deviceType){
	case 0:
		// This is a Samsung Smart TV
	
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
				Display.showPopup ("WARNING: Cannot create widget folder. Try Config");
//		    	Display.showPopup (Lang[Lang.sel].configInit);    	

//				Main.logToServer("ERROR: Cannot create widget folder curWidget.id= " +curWidget.id);
			}
			return;
		}
		else {
			// ok, there should be some config info 
			Config.readContext();
			return; //thlo: TODO
		}
		break;
	}
	Server.notifyServer("started");
	Config.fetchConfig();
};

Config.doFirstLaunch = function () {
	Config.firstLaunch = true;

	Main.changeState(Main.eOPT);
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

        	Config.infoTimeout = parseInt( $(data).find('infoTimeout').text());
        	Config.infoTimeout = isNaN(Config.infoTimeout) ? 3000 : Config.infoTimeout;
        	
        	Config.preferredQuality = $(data).find('preferredQuality').text();
        	Config.sortType= parseInt($(data).find('sortType').text());
        	if ((Config.sortType < 0) || (Config.sortType > Data.maxSort) || isNaN(Config.sortType)) {
        		Config.sortType = 0;
        	}
        	Config.playKeyBehavior = parseInt($(data).find('playKeyBehavior').text());
        	Config.playKeyBehavior = isNaN(Config.playKeyBehavior) ? 0 : Config.playKeyBehavior;
			Config.haveYouTube = ($(data).find('youtubemenu').text() == "true") ? true : false
			
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
        	Main.log("sortType= " + Config.sortType);
        	Main.log("playKeyBehavior= " + Config.playKeyBehavior);
        	
        	Main.log("**** /Config ****");      	
            Main.init();

		},
		error : function (XHR, status, error) {
	    	Main.log ("Config Server Error");  	
	    	Display.showPopup("Config Server Error " + XHR.status + " " + status);
//	    	Display.showPopup(Lang[Lang.sel].configNoServer + " "+ XHR.status + " " + status);
	    	
	    	Main.logToServer("Config Server Error " + XHR.status + " " + status);

		}
	});
};



Config.deletedFromContext = function(idx) {
	Main.log("Config.deletedFromContext: idx= " + idx);
	Config.vdrServers.serverUrlList.splice(idx, 1);

	Config.writeServerUrlList();
};

Config.updateContext = function (addr) {
	Main.log("Config.updateContext with ("+addr+")");
	Main.logToServer("Config.updateContext with ("+addr+")");
	
	var found = false;
	
	for (var i = 0; i < Config.vdrServers.serverUrlList.length; i++) {
		if (Config.vdrServers.serverUrlList[i] == addr) {
			found = true;
			break;
		}
		
	}
	if (found == true) {
		// don't overwrite, if the address is already there.
		Main.log("Config.updateContext: don't overwrite -> return");
		Notify.showNotify("Server already included -> Ignoring", true);
		
		return;
	}
	Config.vdrServers.serverUrlList.push(addr);
	
	Config.writeServerUrlList();
	/*
	var fileSystemObj = new FileSystem();

	var fd = fileSystemObj.openCommonFile(Config.cfgFileName,"w");

//    fd.writeLine('serverAddr ' + addr); // SHould be overwritten by Options menue
	for (var i = 0; i < Config.vdrServers.serverUrlList.length; i++) {
		Main.log ("Config.updateContext itm= " + Config.vdrServers.serverUrlList[i]);
		Main.logToServer ("Config.updateContext itm= " + Config.vdrServers.serverUrlList[i]);
	    fd.writeLine('serverAddr ' + Config.vdrServers.serverUrlList[i]);		
	}
    
    fileSystemObj.closeCommonFile(fd);
*/
    if (Config.serverAddr == "") {
    	// only change the server, when needed.
        Config.serverAddr = addr;
        Config.serverUrl = "http://" + Config.serverAddr;
    	Config.fetchConfig();    	
    }
};

/*
Config.writeContext = function (addr) {
	var fileSystemObj = new FileSystem();

	var fd = fileSystemObj.openCommonFile(Config.cfgFileName,"w");

    fd.writeLine('serverAddr ' + addr); // SHould be overwritten by Options menue
    fileSystemObj.closeCommonFile(fd);
};
*/
Config.writeServerUrlList = function () {
	var fileSystemObj = new FileSystem();

	var fd = fileSystemObj.openCommonFile(Config.cfgFileName,"w");

	for (var i = 0; i < Config.vdrServers.serverUrlList.length; i++) {
		Main.log ("Config.writeServerUrlList itm= " + Config.vdrServers.serverUrlList[i]);
		Main.logToServer ("Config.writeServerUrlList itm= " + Config.vdrServers.serverUrlList[i]);
	    fd.writeLine('serverAddr ' + Config.vdrServers.serverUrlList[i]);		
	}
    
    fileSystemObj.closeCommonFile(fd);
	
};

Config.readContext = function () {
	// readConfig is only called once, at start-up.
	// an array of server addresses should be read.
	var fileSystemObj = new FileSystem();

	
	try {
		var fd = fileSystemObj.openCommonFile(Config.cfgFileName, "r");
		var line = "";
	    
		while (line = fd.readLine()) {
		    var avp = line.split(" ");
		    if (avp.length > 1) {
		    	Config.vdrServers.serverUrlList.push(avp[1]);
		    	Main.log("Config.readContext avp[1]= " + avp[1]);
		    	Config.serverAddr = avp[1];
		    	Config.serverUrl = "http://" + Config.serverAddr;
		    }
		    else {
		    	Display.showPopup ("ERROR: Error in Config File. Try widget re-install.");    	
//		    	Display.showPopup (Lang[Lang.sel].configRead1);    	

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
//	    	Display.showPopup (Lang[Lang.sel].configRead2);    	
			
//			Main.log("-------------- Error: res = false ------------------------");			
		}
		Config.doFirstLaunch();

	}
	
//	Config.vdrServers.serverUrlList.push("192.168.1.142:8000");
	this.vdrServers.checkServers();
	if (Config.vdrServers.serverUrlList.length > 1) {
		// Now I should show the popup to select the server.
		// 1: Check whether more than one server is active
		//	- I need a new plugin method (getServerName)
		// 2: If more than one server is active, show server menu
	}

};


// This function cleans up after un-installation
Config.reset = function () {
	var fileSystemObj = new FileSystem();
	fileSystemObj.deleteCommonFile(curWidget.id + "/config.dta");
};

//**************************************************
function VdrServers() {
	this.serverUrlList = [];
	this.activeServers = [];
	this.responses = 0;
	this.retries = 0;
	this.instanceName = "";
};

VdrServers.prototype.checkServers = function () {

	Main.log ("check active VDR servers " );
	this.responses = 0;
	this.activeServers = [];
	
	for (var i = 0; i < this.serverUrlList.length; i++) {
		var obj = new VdrServerChecker(this, i);
		obj.checkServer(this.serverUrlList[i]);
	}
};

VdrServers.prototype.handleResponse = function () {
	Main.log ("handle responses: Response " + this.responses + " of " + this.serverUrlList.length);  	
	this.responses ++;
	if (this.responses == this.serverUrlList.length) {
		Main.log ("handle responses: Done. Active Servers= " + this.activeServers.length); 
		
		SelectScreen.resetElements();

		switch (this.activeServers.length) {
		case 0:
			this.retries ++;
			if (this.retries <2) {
				this.checkServers();
			}
			else
				Display.showPopup("Please start your VDR server");

			break;
		case 1:
	    	Config.serverAddr = this.activeServers[0].addr;
	    	Config.serverUrl = "http://" + Config.serverAddr;
	    	Config.serverName = this.activeServers[0].name;
			Notify.showNotify("Only " + Config.serverName + " found", true);

	    	$("#selectTitle").text(Config.serverName  );
	    	$("#logoTitle").text(Config.serverName  );

	    	Config.fetchConfig(); 
			break;
		default:
			OverlayMenu.menu = [];		
			for (var i = 0; i < this.activeServers.length; i++) {
				var self = this;
				OverlayMenu.menu.push ({title: this.activeServers[i].name, func : function (idx) { self.selectCallback(idx); } });
			}
			OverlayMenu.show();

			break;
		}
	}
	
};


VdrServers.prototype.selectCallback = function (idx) {
	Config.serverAddr = this.activeServers[idx].addr;
	Config.serverUrl = "http://" + Config.serverAddr;
	Config.serverName = this.activeServers[idx].name;

	Main.log ("vdrServers.selectCallback idx= " + idx + " Config.serverUrl= " + Config.serverUrl); 
	
	$("#selectTitle").text(Config.serverName  );
	$("#logoTitle").text(Config.serverName  );
	
	Config.fetchConfig(); 
	

};

//**************************************************
function VdrServerChecker(parent, i) {
	this.ipaddr = "";
	this.idx = i;
	this.parent = parent;
};

VdrServerChecker.prototype.checkServer = function (addr) {
	this.ipaddr = addr;
	var url ="http://"+ addr + "/serverName.xml";
	$.ajax({
		url: url,
		type : "GET",
		context : this,
		timeout : 400,
		success : function(data, status, XHR ) {
        	var name =  $(data).find('hostname').text();
        	var ip = $(data).find('ipaddress').text();
	    	Main.log ("checkServer Success Inst= " + this.ipaddr + " "  + name + " " + ip);
	    	this.parent.activeServers.push({name : name, addr : ip});
	    	this.parent.handleResponse();
		},
		error : function (XHR, status, error) {
	    	Main.log ("checkServer Error Inst= " + this.ipaddr +" status: " + ((status != null) ? status : "null"));  	
	    	if (status != null)
	    		if (status == "error") {
	    	    	this.parent.activeServers.push({name : "Unnamed " + this.idx, addr : this.ipaddr});
	    		}
	    	this.parent.handleResponse();
		}
	});
	
};
