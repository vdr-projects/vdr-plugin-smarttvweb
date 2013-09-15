var ImgViewer = {
	returnCallback : null
};

ImgViewer.init = function () {
	var elem = document.getElementById('iv-anchor');
	elem.setAttribute('onkeydown', 'ImgViewer.onInput();');

	this.isActive = false;
	
	this.eFullScreen = 0;
	this.eMedIcons = 1;
	
	this.screenMode = this.eFullScreen;
	
	
	$("#imageViewer").hide();
};

ImgViewer.show = function () {
	Display.hide();
	this.isActive = true;
	this.screenMode = this.eFullScreen;
	this.imgList = [];
	this.curImg = 0;

	$("#imageViewer").show();
	
	$("#iv-anchor").focus();

	Main.log ("URL= " + Data.getCurrentItem().childs[Main.selectedVideo].payload.link);

	Spinner.show();
	ImgViewer.createImgArray();
	
	if (this.imgList.length == 0) {
		Notify.showNotify("No Image Found", true);
		ImgViewer.hide();
		return;
	}
	ImgViewer.showImage();

	/*
	if (ImgViewer.isImage() == true) {
		ImgViewer.showImage();
	}
	else {
		ImgViewer.showNextImage();
	}
	*/
};

ImgViewer.hide = function () {
	this.isActive = false;
	this.screenMode = this.eFullScreen;
	Display.show();
	$("#imageViewer").hide();
	Spinner.hide();
	
	Display.setVideoList(Main.selectedVideo, (Main.selectedVideo - Display.currentWindow));

	Main.enableKeys();
};

ImgViewer.createImgArray = function () {
	var max = Data.getVideoCount();
	for (var i = 0; i < Data.getVideoCount() ; i ++) {
		if (ImgViewer.isImage( (Main.selectedVideo + i) % max) == true) {
			this.imgList.push((Main.selectedVideo + i) % max);
		}
	}
	
};

ImgViewer.isImage = function(no) {
	if ((Data.getCurrentItem().childs[no].payload.mime == "image/jpeg") ||
	(Data.getCurrentItem().childs[no].payload.mime == "image/png"))
		return true;
	else
		return false;
};

ImgViewer.isImage = function() {
	if ((Data.getCurrentItem().childs[Main.selectedVideo].payload.mime == "image/jpeg") ||
	(Data.getCurrentItem().childs[Main.selectedVideo].payload.mime == "image/png"))
		return true;
	else
		return false;

};

ImgViewer.showNextImage = function () {
	this.curImg++;
	if (this.curImg >= this.imgList.length)
		this.curImg = 0;

	ImgViewer.showImage();

	/*
	Main.logToServer("ImgViewer.showNextImage curIdx= " +Main.selectedVideo);
	var start_ts = new Date().getTime();

	var start_idx = Main.selectedVideo;
	var found_next = false;
	Main.nextVideo(1) ;
	while ( start_idx != Main.selectedVideo ) {
		Main.logToServer ("ImgViewer.showNextImage: Main.selectedVideo increased to " + Main.selectedVideo);
		if (ImgViewer.isImage() == true) {

			Main.logToServer( "Found idx= " +Main.selectedVideo);
			found_next = true;
			break;
		}
		Main.nextVideo(1);

	}
	var now = new Date().getTime();
	Main.logToServer ("Duration= " + (now-start_ts));

	if (found_next)
		ImgViewer.showImage();
	else {
		Notify.showNotify("No Image Found", true);
		ImgViewer.hide();
	}
	*/
};

ImgViewer.showPrevImage = function () {
	this.curImg--;
	if (this.curImg <0)
		this.curImg = this.imgList.length-1;

	ImgViewer.showImage();

/*
	Main.log("ImgViewer.showPrevImage curIdx= " +Main.selectedVideo);
	var start_ts = new Date().getTime();
	
	var start_idx = Main.selectedVideo;
	var found_next = false;
	Main.previousVideo(1);
	while ( start_idx != Main.selectedVideo ) {
		Main.log ("ImgViewer.showPrevImage: Main.selectedVideo increased to " + Main.selectedVideo);
		if (ImgViewer.isImage() == true) {
			
			Main.log( "Found idx= " +Main.selectedVideo);
			found_next = true;
			break;
		}
		Main.previousVideo(1);

	}
	var now = new Date().getTime();
	Main.logToServer ("Duration= " + (now-start_ts));
	
	if (found_next)
		ImgViewer.showImage();
	else {
		Notify.showNotify("No Image Found", true);
		ImgViewer.hide();
	}
	*/
};

ImgViewer.showImage = function () {	
//	Main.logToServer("showImage: "+ Data.getCurrentItem().childs[Main.selectedVideo].payload.link);
	Main.logToServer("showImage: "+ Data.getCurrentItem().childs[this.imgList[this.curImg]].payload.link);

	$("#ivImage")
		.error(function() { 
			Main.log("ERROR"); 
			ImgViewer.hide();
			Spinner.hide();
			Notify.showNotify("Error while loading image.", true);
			})
		.load(function () { 
			Main.logToServer("showImage Loaded");
			Spinner.hide();
			if($(this).height() > $(this).width()) {
				$(this).css({"height": "100%", "width" : "auto"});
			}
			else {
				$(this).css({"width": "100%", "height" : "auto"});
			}})
		.attr('src', Data.getCurrentItem().childs[this.imgList[this.curImg]].payload.link +"?"+Math.random());
//		.attr('src', Data.getCurrentItem().childs[Main.selectedVideo].payload.link +"?"+Math.random());
};

function ImgLoader (url, elm) {
	this.url = url;
	this.elm = elm;

	this.elm
		.error(function() { 
			Main.log("ERROR"); 
			ImgViewer.hide();
			Spinner.hide();
			Notify.showNotify("Error while loading image.", true);
			})
		.load(function () { 
			Main.logToServer("showImage Loaded");
			Spinner.hide();
			if($(this).height() > $(this).width()) {
				$(this).css({"height": "100%", "width" : "auto"});
			}
			else {
				$(this).css({"width": "100%", "height" : "auto"});
			}})
		.attr('src', this.url +"?"+Math.random());
	
	};


ImgViewer.showImageGrid = function () {
	
};

ImgViewer.showGridRow = function (no) {
	var p_width = $("body").outerWidth();
	var elms = p_width / no;
	
	var row = $("<div>");

	var l_elm = $("<div>", {style : "display: inline-block; ", class : "style_hbOverlayLElm"});
	var r_elm = $("<div>", {style : "display: inline-block;"});

};

ImgViewer.onInput = function () {
    var keyCode = event.keyCode;
	Main.log(" ImgViewer key= " + keyCode);
    switch(keyCode) {
		case tvKey.KEY_LEFT:
			Main.log("ImgViewer-Select Left");
			Spinner.show();

			ImgViewer.showPrevImage();
			break;
		case tvKey.KEY_RIGHT:
			Main.log("ImgViewer-Select Right");
			Spinner.show();

			ImgViewer.showNextImage();
		break;
		case tvKey.KEY_ENTER:
			if (this.screenMode == this.eFullScreen) {
				this.screenMode = this.eMedIcons;
			}
			else {
				this.screenMode = this.eFullScreen;
			}
	;

		//			Buttons.ynShow();
			// Show overlay info

		break;
		case tvKey.KEY_RETURN:
		case tvKey.KEY_EXIT:
		case tvKey.KEY_STOP:
			Main.selectedVideo = this.imgList[this.curImg];

			ImgViewer.hide();
			if (this.returnCallback  != null)
				this.returnCallback(); 	    	
			break;
		case tvKey.KEY_BLUE:
			break;
		case tvKey.KEY_YELLOW:
			Main.log("Delete YE Button");
			Buttons.ynShow();
//			Server.deleteMedFile(Data.getCurrentItem().childs[Main.selectedVideo].payload.guid);
		break;
		case tvKey.KEY_TOOLS:
			Helpbar.showHelpbar();
			break;

	}
	try {
		widgetAPI.blockNavigation(event);
	}
	catch (e) {
	};

};
// In need an Image Folder on the server, similar to Media Folder
// All jpg and JPG are found recursively and provided as a Data Structure
// Subfolders are separated through ~

// in need some plugin preceedures to handle, delete, rotate, ...

// The Media Folder should actually already provide the jpgs