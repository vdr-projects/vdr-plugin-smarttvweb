var ImgViewer = {
	returnCallback : null
};

ImgViewer.init = function () {
	var elem = document.getElementById('iv-anchor');
	elem.setAttribute('onkeydown', 'ImgViewer.onInput();');

	$("#imageViewer").hide();
};

ImgViewer.show = function () {
	Display.hide();
	$("#imageViewer").show();
	
	$("#iv-anchor").focus();

	Main.log ("URL= " + Data.getCurrentItem().childs[Main.selectedVideo].payload.link);

	Spinner.show();

	if (ImgViewer.isImage() == true) {
		ImgViewer.showImage();
	}
	else {
		ImgViewer.showNextImage();
	}
};

ImgViewer.hide = function () {
	Display.show();
	$("#imageViewer").hide();
	Spinner.hide();
	Main.enableKeys();
};

ImgViewer.isImage = function() {
	if ((Data.getCurrentItem().childs[Main.selectedVideo].payload.mime == "image/jpeg") ||
	(Data.getCurrentItem().childs[Main.selectedVideo].payload.mime == "image/png"))
		return true;
	else
		return false;

};

ImgViewer.showNextImage = function () {
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
};

ImgViewer.showPrevImage = function () {
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
};

ImgViewer.showImage = function () {	
	Main.logToServer("showImage: "+ Data.getCurrentItem().childs[Main.selectedVideo].payload.link);

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
		.attr('src', Data.getCurrentItem().childs[Main.selectedVideo].payload.link +"?"+Math.random());
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
//			Buttons.ynShow();
			// Show overlay info

		break;
		case tvKey.KEY_RETURN:
		case tvKey.KEY_EXIT:
		case tvKey.KEY_STOP:
			ImgViewer.hide();
			
			if (this.returnCallback  != null)
				this.returnCallback(); 	    	
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