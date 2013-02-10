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
	timeoutObj : null,
	isActive : false,
	guidErrors : {},
	guidTitle : {},
	curGuid : "",
	lastGuid :"",
	sameGuidCount : 0,
	globalCount :0
};

Epg.stopUpdates = function () {
	if (this.isActive == false )
		return;

	window.clearTimeout(this.timeoutObj);
	this.isActive = false;
	this.curGui = "";
};

Epg.startEpgUpdating = function() {
	Main.log("");
	Main.log("**** Epg.startEpgUpdating ****");
	
	if (this.isActive == true)
		return;
		
/*	if (this.globalCount == 30) {
		Main.log ("stopping");
		return;
	}
	*/
	this.globalCount ++;
	if (Main.state != Main.eLIVE) {
		Main.logToServer("ERROR in Epg.startEpgUpdating: I am NOT in state Main.eLive...!!");
		return;
	}
	this.isActive = true;
	var res = Data.findEpgUpdateTime(); 
	
	var now = Display.GetEpochTime();
	var delay = Math.round(res.min - now) *1000;
	this.curGuid = res.guid;

	
	if (this.lastGuid == res.guid) {
		// lastGuid is only changed, when the last response was successful
		// number of repetitive errors are checked in the error response procedure
		this.sameGuidCount ++;
//		Main.logToServer("WARNING in Epg.startEpgUpdating: again same Guid guid= " + res.guid + "(" +Epg.guidTitle[res.guid] +") (sameGuidCount= " +this.sameGuidCount+"). OrgDelay= " + (delay/1000.0) + "sec. Delaying...");
		delay = 1000;
		if (this.sameGuidCount > 60) {
			Epg.insertFakeEntry(res.guid);
			Main.logToServer("WARNING in EPG.updateEPG: insertFakeEntry for guid= " + res.guid + " (" + Epg.guidTitle[res.guid] +")");
			Main.log("WARNING in EPG.updateEPG: insertFakeEntry for guid= " + res.guid + " (" + Epg.guidTitle[res.guid] +")");
			Epg.isActive = false;
			Epg.startEpgUpdating();
//			Main.logToServer("ERROR in EPG.updateEPG: 10x same guid !!! - Please file a bug report! - Bitte eine Fehlermeldung posten");
//			Display.showPopup("EPG.updateEPG: 10x same guid !!!<br>Please file a bug report!<br>Bitte eine Fehlermeldung posten");
			return;
		}
	}
	else {
		Main.log("Epg.startEpgUpdating: Next update for GUID= " + res.guid + " with Min= " + res.min + " delay= " + (delay/1000.0) + "sec"); 
		this.sameGuidCount = 0;
	}

	if (delay <0) {
		delay = 300; //bit delay in msec
	}
	if (!(res.guid in this.guidErrors)) {
		this.guidErrors[res.guid] = 0;
	};

/*	Main.log("Iter over this.guidErrors");
	for (var prop in this.guidErrors) {
		Main.log(" " +prop + " == " + this.guidErrors[prop]);
	}
	Main.log("Iter Done");
*/	
	if (this.guidErrors[res.guid] == 0) {
		Main.log("Epg.startEpgUpdating: next Update for guid= " + res.guid + " (" +Epg.guidTitle[res.guid] +") guidErrors= "+this.guidErrors[res.guid]+ " in " + (delay/1000.0) +"sec");
		Main.logToServer("Epg.startEpgUpdating: next Update for guid= " + res.guid + " (" +Epg.guidTitle[res.guid]+ ") guidErrors= "+this.guidErrors[res.guid]+ " in " + (delay/1000.0) +"sec");
//	Main.logToServer("Epg.startEpgUpdating: next Update for guid= " + res.guid + " in " + (delay/1000.0) +"sec");
	}
	
	this.timeoutObj = window.setTimeout(function() { Epg.updateEpg(res.guid); }, delay);
};

Epg.updateEpg = function (guid) {
	var url = Config.serverUrl + "/epg.xml?id=" + guid;
	
	if (Epg.guidErrors[guid] >2) {
//		Main.logToServer("WARNING in Epg.updateEpg: guid= " + guid + " uses mode=nodesc" );
		url = url +"&mode=nodesc";
	}
	Main.log("Epg.updateEpg: Prep for guid= " + guid + " with ErrorCount= " + Epg.guidErrors[guid] +" and url= " + url);
	$.ajax({
        type: "GET",
        async: true,
        url: url,
        success: Epg.parseResponse,
		error: Epg.handleError
    });	
};

Epg.handleError = function (XHR, textStatus, errorThrown) {
	
	Epg.guidErrors[Epg.curGuid] += 1;
//	Main.log("EPG.updateEPG Error ("+XHR.status +": " +XHR.responseText+")EPG.curGuid= "+Epg.curGuid +" Epg.guidErrors[Epg.curGuid]= " +Epg.guidErrors[Epg.curGuid]);
//	Main.logToServer("EPG.updateEPG Error Response("+ XHR.status + ") EPG.curGuid= "+Epg.curGuid +" Epg.guidErrors[Epg.curGuid]= " +Epg.guidErrors[Epg.curGuid]);

	Epg.isActive = false;
//	Main.log("--------------------------------------------");
	if (Epg.guidErrors[Epg.curGuid] < 6) {
		Epg.startEpgUpdating();
	}
	else {
		Epg.insertFakeEntry(Epg.curGuid);
		Main.logToServer("ERROR in EPG.updateEPG: insertingFakeEntry for guid= " + Epg.curGuid + " (" + Epg.guidTitle[Epg.curGuid] +") with Epg.guidErrors= " +Epg.guidErrors[Epg.curGuid]);
		Epg.startEpgUpdating();
//		Display.showPopup("EPG.updateEPG: stop updating !!!<br>Please file a bug report!<br>Bitte eine Fehlermeldung posten");
	}
	return;
};

Epg.insertFakeEntry = function (guid) {
//	Main.logToServer("Epg.insertFakeEntry for guid= " + guid + " (" + Epg.guidErrors[guid] +")");
	var now = Display.GetEpochTime();

	entry={};
	entry.prog = "Unknown";
	entry.desc = "Empty";
	entry.start = now;
	entry.dur = 120;

	Data.updateEpg(guid, entry);
};

Epg.parseResponse = function (message,text, XHR) {

	$(message).find("programme").each(function(){
		var guid = $(this).find("guid").text();
		if (guid != Epg.curGuid) {
			Main.logToServer("ERROR in Epg.parseResponse : Guid (="+ guid + ") != Epg.curGuid (=" + Epg.curGuid+ ") " );
		}
		
		Epg.guidErrors[Epg.curGuid] = 0;
		
		entry={};
		entry.prog = $(this).find("title").text();
		entry.desc = $(this).find("desc").text();
		entry.start = parseInt($(this).find("start").text());
		entry.dur = (parseInt($(this).find("end").text()) - parseInt($(this).find("start").text()));

		Main.log("Epg.parseResponse : Guid= "+ guid + " title= " + entry.prog+ " start= " +entry.start + " dur= " + entry.dur);
//		Main.logToServer("Epg.parseResponse : Guid= "+ guid + " title= " + entry.prog+ " start= " +entry.start + " dur= " + entry.dur);

		Data.updateEpg(guid, entry);
		
		//trigger Display refresh
		if (Data.getCurrentItem().childs[Main.selectedVideo].payload.guid == guid) {
			// the updated record is either playing or in Menu
			if (Player.state != Player.STOPPED) {
				Main.logToServer("Updating Progress Bar");
				Display.updateOlForLive (entry.start, entry.dur, Display.GetEpochTime()); // Updates the progress bar
			}
			else {
				Main.logToServer("Updating Right Half");
				Display.handleDescription(Main.selectedVideo);
			}
		}

		Epg.lastGuid = guid;
		Epg.isActive = false;
//		Main.log("--------------------------------------------");
		Epg.startEpgUpdating();
	});
};


