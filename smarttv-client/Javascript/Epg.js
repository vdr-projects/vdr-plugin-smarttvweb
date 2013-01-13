/*
 * Principle: One monitor for each channel
 * Nur max 20
 *  Oder einer:
 *  Search once through all entries and look for the lowest expiry.
 *  Set a timer to update the entry
 *  check, whether the entry is "on screen"
 * 
*/

var Epg = {
	restfulUrl : ""	
	
};

// Should be called after initial config
Epg.init = function () {
	if (Config.serverUrl == "")
		return;
	if (Config.serverUrl.indexOf(':') != -1) {
		Main.log ("Epg: Serverurl= " + Config.serverUrl);
		this.restfulUrl = Config.serverUrl.splice(0, Config.serverUrl.indexOf(':')) + ":8002";	
	}
	
	Main.log ("Restful API Url= "+ this.restfulUrl);
	
	$.ajax({
        type: "HEAD",
        async: true,
        url: this.restfulUrl + "channels.xml",
        success: function(message,text,response){
        	Main.log("AJAX Response: MSG= " + message + " txt= " + text + " resp= " + response);
        }
    });
};

Epg.startEpgUpdating = function() {

	var res = Data.findEpgUpdateTime(); 
	Main.log("GUID= " + res.guid + " Min= " + res.min); 
};