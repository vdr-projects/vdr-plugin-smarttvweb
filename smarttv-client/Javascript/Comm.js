
var Comm = {
	customMgr : {},
	deviceInstance : []
};

Comm.init = function () {
	// >> Register custom manager callback to receive device connect and disconnect events
	Comm.customMgr = webapis.customdevice || {};
	
	Comm.customMgr.registerManagerCallback(Comm.onDeviceStatusChange);
	
	// >> Initializes custom device profile and gets available devices
	Comm.customMgr.getCustomDevices(Comm.onCustomObtained);    
	Main.log("curWidget.id= " + curWidget.id);
	Main.logToServer("curWidget.id= (" + curWidget.id+")");
};

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
	Main.logToServer("onCustomObtained - found " + customs.length + " custom device(s)");
	for(var i=0; i<customs.length; i++) {
        if(customs[i]!=null && customs[i].getType() == Comm.customMgr.DEV_SMART_DEVICE) {
			Main.logToServer("onCustomObtained - is Comm.custom.DEV_SMART_DEVICE: i=" + i);
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
//				Main.log("#### onDeviceEvent -1- DEV_EVENT_MESSAGE_RECEIVED:" + sParam.data.message1);
//				Main.logToServer("#### onDeviceEvent -1- DEV_EVENT_MESSAGE_RECEIVED:" + sParam.data.message1);
                Comm.onMessageReceived(sParam.data.message1, sParam.data.message2);
			break;
		case Comm.customMgr.DEV_EVENT_JOINED_GROUP:
			//CustomDeviceGroupInfo
//				Main.log("#### onDeviceEvent -1- DEV_EVENT_JOINED_GROUP ####");
//				Main.logToServer("#### onDeviceEvent -1- DEV_EVENT_JOINED_GROUP ####");
			break;
		case Comm.customMgr.DEV_EVENT_LEFT_GROUP:
			//CustomDeviceGroupInfo
//				Main.log("#### onDeviceEvent -1- DEV_EVENT_LEFT_GROUP ####");
//				Main.logToServer("#### onDeviceEvent -1- DEV_EVENT_LEFT_GROUP ####");
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
	if (msg.type == "YT") {
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
	}
	
};
