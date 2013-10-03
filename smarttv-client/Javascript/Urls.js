var UrlsFetcher = {
	qualities : {17 : "144p", 36 : "240p", 18 : "360p", 22 : "720p", 37 : "1080p" },
	preference : [36, 18, 22, 37],
	usable : [],
	curQuality : 2,
	fv : "",
	urls : {},
	guids : [],
	guidDict :{},
	issuedRequests : 0,
	caughtResponses : 0,
    dataReceivedCallback : null,
	autoplay : ""
	};

UrlsFetcher.resetCurQuality = function () {
	UrlsFetcher.curQuality = 2;
	if ((Config.preferredQuality > 0) && (Config.preferredQuality < UrlsFetcher.preference.length)) {
		UrlsFetcher.curQuality = Config.preferredQuality;
		Main.log("Setting UrlsFetcher.curQuality= " + UrlsFetcher.curQuality);
	}	
};

UrlsFetcher.fetchUrlList = function() {
	Main.log(" --- UrlsFetcher.fetchUrlList --- ");

	UrlsFetcher.resetCurQuality();
	
	Data.sort = true;
	Data.createAccessMap = true;
	UrlsFetcher.issuedRequests = 0;
	UrlsFetcher.caughtResponses = 0;
	UrlsFetcher.guids = [];
	UrlsFetcher.fetchUrls(Config.serverUrl + "/urls.xml"); 
};
	
UrlsFetcher.fetchUrls = function(url) {
	Main.log("UrlsFetcher.fetchUrls url= " + url);
	
	$.ajax({
		url: url,
		type : "GET",
		success : function(data, status, XHR ) {
			Main.log("UrlsFetcher.fetchUrls Success Response - status= " + status + " mime= " + XHR.responseType + " data= "+ data);

			$(data).find("item").each(function () {
				var guid = $(this).find('guid').text();
				Main.log("UrlsFetcher.fetchUrls : guid= " + guid );
				UrlsFetcher.guids.push(guid);				
//				UrlsFetcher.getYtDescription(guid);
				}); // each
			// Done
			 UrlsFetcher.getAllDescription();
		},
		error : function (jqXHR, status, error) {
			Main.log("UrlsFetcher.fetchUrls Error Response - status= " + status + " error= "+ error);
			Main.logToServer("UrlsFetcher.fetchUrls Error Response - status= " + status + " error= "+ error);
		},
		parsererror : function () {
			Main.log("UrlsFetcher.fetchUrls parserError  " );
			Main.logToServer("UrlsFetcher.fetchUrls parserError  " );

		}
	});
		
};

UrlsFetcher.appendGuid = function (guid) {
	Main.log("UrlsFetcher.appendGuid guid= " + guid + " UrlsFetcher.guids.length= " + UrlsFetcher.guids.length);

	UrlsFetcher.guids.push(guid);				
	UrlsFetcher.guidDict[guid] = {};
	UrlsFetcher.guidDict[guid]["num"] = (UrlsFetcher.guids.length);
	UrlsFetcher.guidDict[guid]["start"] = (UrlsFetcher.guids.length);
	UrlsFetcher.getYtDescription(guid);	
	Main.logToServer("Data.getVideoCount= " + Data.getVideoCount());
};



UrlsFetcher.getAllDescription = function () {
	Main.log("UrlsFetcher.getAllDescription guids.length= " + UrlsFetcher.guids.length);
	for (var i = 0; i < UrlsFetcher.guids.length; i++) {
		Main.log("Calling " + UrlsFetcher.guids[i]);
		var guid = UrlsFetcher.guids[i];
		UrlsFetcher.guidDict[guid] = {};
		UrlsFetcher.guidDict[guid]["num"] = (i+1);
		UrlsFetcher.guidDict[guid]["start"] = (i+1);

		UrlsFetcher.getYtDescription(guid);		
//		UrlsFetcher.getYtDescription(UrlsFetcher.guids[i]);		
	}
	Main.log("UrlsFetcher.getAllDescription Done" );
};

UrlsFetcher.handleResponse = function (success) {
	UrlsFetcher.caughtResponses++;
	Main.log("UrlsFetcher.handleResponse caughtResponses= " + UrlsFetcher.caughtResponses);
	
	if (UrlsFetcher.caughtResponses >= UrlsFetcher.issuedRequests) {
		//Done
		Main.logToServer("UrlsFetcher.handleResponse - Done: " + UrlsFetcher.caughtResponses);

		if (UrlsFetcher.autoplay == "") {
			Data.completed(false);
			if (UrlsFetcher.dataReceivedCallback) {
				UrlsFetcher.dataReceivedCallback();
			}
		}
		else {
//			Main.logToServer("UrlsFetcher.handleResponse Autoplay " + UrlsFetcher.autoplay);
			Main.log("UrlsFetcher.handleResponse Autoplay " + UrlsFetcher.autoplay);
			Spinner.hide();
		
			// autoplay: 
			if (success == true) {
//	        	Display.setVideoList(Main.selectedVideo, Main.selectedVideo); 
				
				Main.logToServer("UrlsFetcher.handleResponse play guid= " + UrlsFetcher.autoplay);
				var num = UrlsFetcher.guidDict[UrlsFetcher.autoplay]["num"];
				DirectAccess.selectNewChannel(num);

				var first_idx = (Data.getVideoCount() < Display.getNumberOfVideoListItems()) ?0: Data.getVideoCount() - Display.getNumberOfVideoListItems();
				Display.setVideoList(Main.selectedVideo, first_idx); 
				
			}
			else {
				// remove 
				Main.logToServer("Error - UrlsFetcher.handleResponse: remove guid= " + UrlsFetcher.autoplay);
				delete UrlsFetcher.guidDict[UrlsFetcher.autoplay];
			}
			
			UrlsFetcher.autoplay = "";

		}
	}
};

UrlsFetcher.getYtDescription = function (vid) {
	Main.log("UrlsFetcher.getYtDescription vid= " + vid);
	var url = 'http://gdata.youtube.com/feeds/api/videos/'+vid+'?v=2&alt=json';
	Main.log("UrlsFetcher.getYtDescription url= " + url);
	UrlsFetcher.issuedRequests ++;
	
	$.ajax({
		url: url,
		type : "GET",
		dataType: "json",
		success: function(data, status, XHR ) {
			var title = data.entry.title.$t;
			var description = data.entry.media$group.media$description.$t;
			var duration = data.entry.media$group.yt$duration.seconds;
			var guid = data.entry.media$group.yt$videoid.$t;

			var num = UrlsFetcher.guidDict[guid]["num"];
			var start = UrlsFetcher.guidDict[guid]["start"];
			
	        Data.addItem( [title], {link : "", prog: "", desc: description, guid : guid, start: start, 
				dur: duration, ispes : "false", isnew : "false", fps : 0, num : num});     
	        Main.log("UrlsFetcher.getYtDescription: guid= " + guid + "was inserted at= " + Data.directAccessMap[num]);
	        Main.logToServer("UrlsFetcher.getYtDescription: guid= " + guid + "was inserted at= " + Data.directAccessMap[num]);
	        UrlsFetcher.handleResponse(true);
			//insert into data-base
		},
		error : function(jqXHR, status, error) {
			Main.log("UrlsFetcher.getYtDescription: Error");
			Main.logToServer("UrlsFetcher.getYtDescription: Error");
	        UrlsFetcher.handleResponse(false);
		}
	
	});

};

	
	
UrlsFetcher.getYtVideoUrl = function (vid) {
	Main.log("UrlsFetcher.getYtVideoUrl: vid= " + vid);
	Main.logToServer("UrlsFetcher.getYtVideoUrl: vid= " + vid);

	//Reset
	UrlsFetcher.fv = "";
	UrlsFetcher.usable = [];
	UrlsFetcher.urls = {}; // reset
	UrlsFetcher.resetCurQuality();
//	UrlsFetcher.curQuality = 2;
	
	$.get('http://www.youtube.com/get_video_info?video_id=' + vid, function(data) {
		UrlsFetcher.fv = data;
		var status = UrlsFetcher.getQueryAttrib(UrlsFetcher.fv, "status");
		if (status == "fail") {
			var reason = UrlsFetcher.getQueryAttrib(UrlsFetcher.fv, "reason");
			Main.log("reason: " + reason);
			Main.log("fv= "+UrlsFetcher.fv);
			Display.showPopup(reason);
			return;
		}

		UrlsFetcher.extractYtUrl(vid);
		
	});
};
		
		
UrlsFetcher.getQueryAttrib = function (querystring, item) {
	var filter = new RegExp( item + "=([^&]+)" );
	return unescape( querystring.match(filter)[1] );
};

UrlsFetcher.extractYtUrl = function (vid) {
	var stream_map = UrlsFetcher.getQueryAttrib(UrlsFetcher.fv, "url_encoded_fmt_stream_map").split(",");
	var itags = [];
	
	for (var i = 0; i < stream_map.length; i++) {
		var url =
			UrlsFetcher.getQueryAttrib(stream_map[i], "url") + "&signature=" +
			UrlsFetcher.getQueryAttrib(stream_map[i], "sig");
		var itag= url.match(/itag=(\d+)/)[1];
		itags.push(itag);
		if ( itag in UrlsFetcher.qualities) {
			// store only the wanted itags
			UrlsFetcher.urls[itag] = url;
			UrlsFetcher.usable.push(itag);
		}
	};
	if (UrlsFetcher.usable.length == 0) {
		// Nothing to play
		Display.showPopup("No supported format found for this clip.");
		Player.stop();
        Spinner.hide();
		Display.resetAtStop();
		Display.show();
	}
	// Done: Play now
	Main.log(vid+ ": Available Qualities= "+ itags.toString());
	Main.logToServer(vid+ ": Available Qualities= "+ itags.toString());

	if (UrlsFetcher.usable.length == 0) {
		Display.showPopup ("Error: No Suitable Formats founds " );
		return;
	}
	var ok = false;
	
	
	while (!ok) {
		if (UrlsFetcher.preference[UrlsFetcher.curQuality] in UrlsFetcher.urls) {
			Main.logToServer(" YT Url= " + UrlsFetcher.urls[UrlsFetcher.preference[UrlsFetcher.curQuality]]);
			Player.setVideoURL(UrlsFetcher.urls[UrlsFetcher.preference[UrlsFetcher.curQuality]]);
			ok = true;
			Notify.showNotify("Quality: " + UrlsFetcher.qualities[UrlsFetcher.preference[UrlsFetcher.curQuality]], true);
		}
		else
			UrlsFetcher.curQuality --;
		if (UrlsFetcher.curQuality <0) {
			Player.setVideoURL(UrlsFetcher.urls[UrlsFetcher.usable[0]]);
			Main.logToServer(" YT Url= " + UrlsFetcher.urls[UrlsFetcher.preference[UrlsFetcher.curQuality]]);
			Notify.showNotify("Quality: " + UrlsFetcher.qualities[UrlsFetcher.usable[0]], true);
			ok = true;
		}
	}
	Player.playVideo(-1);

};
