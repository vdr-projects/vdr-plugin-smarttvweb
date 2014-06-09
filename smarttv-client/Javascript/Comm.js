
var Comm = {
	created: false,
	customMgr : {},
	deviceInstance : []
};

Comm.init = function () {
	if (this.created == true) {
		return;
	}

	this.created = true;
	// >> Register custom manager callback to receive device connect and disconnect events
	if (Config.deviceType != 0)
		return;
	
	try {
		Comm.customMgr = webapis.customdevice || {};
		
		Comm.customMgr.registerManagerCallback(Comm.onDeviceStatusChange);
		
		// >> Initializes custom device profile and gets available devices
		Comm.customMgr.getCustomDevices(Comm.onCustomObtained);    		
	}
	catch (e) {	
	}
	Main.log("curWidget.id= " + curWidget.id);
	Main.logToServer("curWidget.id= (" + curWidget.id+")");
};

//TODO: I should ensure that I take only events from the selected VDR server

Comm.onDeviceStatusChange = function (sParam) {
	switch( Number(sParam.eventType) ) {
		case Comm.customMgr.MGR_EVENT_DEV_CONNECT: 
			Main.logToServer("onDeviceStatusChange - MGR_EVENT_DEV_CONNECT: name= " + sParam.name + " type= " +sParam.deviceType);
			break;
		case Comm.customMgr.MGR_EVENT_DEV_DISCONNECT:
			Main.logToServer("onDeviceStatusChange - MGR_EVENT_DEV_DISCONNECT: name= " + sParam.name + " type= " +sParam.deviceType);
			break;
		default:
			Main.logToServer("onDeviceStatusChange - Unknown event eType= " + sParam.eventType + " name= " + sParam.name+ " dType= "+sParam.deviceType);
			break;
	}
	Comm.customMgr.getCustomDevices(Comm.onCustomObtained);
};

Comm.onCustomObtained = function (customs) {
//	Main.logToServer("onCustomObtained - found " + customs.length + " custom device(s)");
	for(var i=0; i<customs.length; i++) {
        if(customs[i]!=null && customs[i].getType() == Comm.customMgr.DEV_SMART_DEVICE) {
//			Main.logToServer("onCustomObtained - is Comm.custom.DEV_SMART_DEVICE: i=" + i);
			Comm.deviceInstance[i] = customs[i];
			Comm.deviceInstance[i].registerDeviceCallback(Comm.onDeviceEvent);
        }
        else {
			Main.logToServer("ERROR in onCustomObtained: i= " + i + " No CB registered ");		        	
        }
    }
};

Comm.onDeviceEvent = function(sParam) {
	// sParam is CustomDeviceInfo
	switch(Number(sParam.infoType)) {
		case Comm.customMgr.DEV_EVENT_MESSAGE_RECEIVED:
			//CustomDeviceMessageInfo
                Comm.onMessageReceived(sParam.data.message1, sParam.data.message2);
			break;
		case Comm.customMgr.DEV_EVENT_JOINED_GROUP:
			//CustomDeviceGroupInfo
			break;
		case Comm.customMgr.DEV_EVENT_LEFT_GROUP:
			//CustomDeviceGroupInfo
			break;
		default:
				Main.logToServer("onDeviceEvent -1- Unknown event infoType= " + Number(sParam.infoType));
			break;
	}
};


Comm.onMessageReceived = function(message, context) {
    // message -> message body
    // context -> message context (headers and etc)
    Main.logToServer("onMessageReceived:" + message);
	var msg = eval('(' + message + ')');
	switch (msg.type) {
	case "YT":
		if (msg.payload.id == "undefined") {
			Main.logToServer("ERROR: msg.payload.id is not defined");
			return;	    	
		}
		Main.logToServer("Found type YT " + msg.payload.id);
		if (Main.state == Main.eURLS) {
			if (msg.payload.id == "" ) {
				Main.logToServer("ERROR: msg.payload.id is empty");
				return;
			}
			Spinner.show();
			UrlsFetcher.autoplay = msg.payload.id;
			UrlsFetcher.removeWhenStopped = "";
			if (msg.payload.store == false) {
				UrlsFetcher.removeWhenStopped = msg.payload.id;
				Main.logToServer("removeWhenStopped= " + msg.payload.id);				
			}
			UrlsFetcher.appendGuid(msg.payload.id);
		}
		break;
	case "CFGADD":
		if (msg.payload.serverAddr == "undefined") {
			Main.logToServer("ERROR: msg.payload.id is not defined");
			return;	    	
		}
		// TODO: I should change to the new server only if there is no other vdr server defined.
		// Otherwise, check whether the new service is active. If active, add it to the list.
    	Config.updateContext(msg.payload.serverAddr); 
    	if (Config.firstLaunch == true) {
    		Main.state = 1; // ensure, that the cursor is on 1st position        		

			Main.enableKeys();
			Options.hide();
			Main.changeState(0);
		}
		break;
	case "INFO":
		Main.logToServer("INFO: type= " + msg.payload.type + " val= " + msg.payload.name);
		switch(msg.payload.type) {
		case "RECSTART":
			if (Main.state == Main.eREC) {
				Server.updateEntry(msg.payload.guid);
			}		

			if (Config.showInfoMsgs == true)
				Notify.showNotify("Recording started: '" + msg.payload.name +"'", true);
			break;
		case "RECSTOP":
			if (Config.showInfoMsgs == true)
				Notify.showNotify("Recording finished: " + msg.payload.name+"'", true);
			break;
		case "TCADD":
			if (Main.state == Main.eTMR) {
				Timers.resetView();
				Notify.showNotify("Timer added: '" + msg.payload.name+"'", true);
			}
			else
				if (Config.showInfoMsgs == true)
					Notify.showNotify("Timer added: '" + msg.payload.name+"'", true);

			break;
		case "TCMOD":
			if (Main.state == Main.eTMR) {
				Timers.resetView();			
				Notify.showNotify("Timer modified: '" + msg.payload.name+"'", true);
			}
			else if (Config.showInfoMsgs == true)
				Notify.showNotify("Timer modified: '" + msg.payload.name+"'", true);

			break;
		case "TCDEL":
			if (Main.state == Main.eTMR) {
				Timers.resetView();			
				Notify.showNotify("Timer deleted: '" + msg.payload.name+"'", true);
			}
			else if (Config.showInfoMsgs == true)
				Notify.showNotify("Timer deleted: '" + msg.payload.name+"'", true);
			break;

		}
		break;
	case "MESG":
		if (msg.payload != "")
			Notify.showNotify(msg.payload, true);
		break;
	}; // switch

	
};
