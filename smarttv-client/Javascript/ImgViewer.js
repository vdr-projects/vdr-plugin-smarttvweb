var ImgViewer = {
	returnCallback : null,
	imgOlHandler : null
};

ImgViewer.init = function () {
	var elem = document.getElementById('iv-anchor');
	elem.setAttribute('onkeydown', 'ImgViewer.onInput();');

	this.isActive = false;
	
	this.eFullScreen = 0;
	this.eMedIcons = 1;
	
	this.screenMode = this.eFullScreen;
	
//	this.imgOlHandler = new OverlayHandler("ImgHndl");
//    this.imgOlHandler.init(Display.handlerShowImgInfo, Display.handlerHideImgInfo);

	$("#imageViewer").hide();
};

ImgViewer.show = function () {
	Display.hide();
	this.isActive = true;
	this.screenMode = this.eFullScreen;
	this.imgList = [];
	this.curImg = 0;

	$("#imageViewer").show();
	
	ImgViewer.focus ();
	
	Main.log ("URL= " + Data.getCurrentItem().childs[Main.selectedVideo].payload.link);

	Spinner.show();
	ImgViewer.createImgArray();
	
	if (this.imgList.length == 0) {
		Notify.showNotify("No Image Found", true);
		ImgViewer.hide();
		return;
	}

//	ImgViewer.showImageGrid();

	ImgViewer.showImage();
};

ImgViewer.focus = function () {
	Main.log("ImgViewer.focus ");
	$("#iv-anchor").focus();
	
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
	this.imgList = [];

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
};

ImgViewer.showPrevImage = function () {
	this.curImg--;
	if (this.curImg <0)
		this.curImg = this.imgList.length-1;

	ImgViewer.showImage();
};

ImgViewer.showImage = function () {	
	Main.log("showImage: "+ Data.getCurrentItem().childs[this.imgList[this.curImg]].payload.link);
	Main.logToServer("showImage: "+ Data.getCurrentItem().childs[this.imgList[this.curImg]].payload.link);
	var p_width = $("#imageViewer").width();
	var p_height = $("#imageViewer").height();

	var img_name = Data.getCurrentItem().childs[this.imgList[this.curImg]].payload.link.split("/");
	Notify.showNotify( img_name[img_name.length -1], true);
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
			/*
			if($(this).height() > $(this).width()) {
				$(this).css({"height": "100%", "width" : "auto"});
			}
			else {
				$(this).css({"width": "100%", "height" : "auto"});
			}*/
			})
		.attr('src', Data.getCurrentItem().childs[this.imgList[this.curImg]].payload.link +"?"+Math.random())
		.css({"max-width": p_width + "px", "max-height" :p_height  + "px" });
};

ImgViewer.ImgLoader = function(url, w, h) {
//	this.url = url;
	var elm = $("<div>", {style : "display: inline-block; width: " + w + "px; height: "+ h + "px;" });
	var img = $("<img>", {style : "max-width: " + w + "px; max-height: "+ h + "px;" });
	elm.append(img);
	
	img
		.error(function() { 
			Main.log("ERROR while loading"); 
			})
		.load(function () { 
//			Main.logToServer("showImage Loaded");
			Spinner.hide();
/*			if($(this).height() > $(this).width()) {
				$(this).css({"height": "100%", "width" : "auto"});
			}
			else {
				$(this).css({"width": "100%", "height" : "auto"});
			}
			*/
			})
		.attr('src', url +"?"+Math.random());

	return elm;
};


ImgViewer.showImageGrid = function () {
	var p_width = $("#imageViewer").width();
	var p_height = $("#imageViewer").height();
	
	var no_elms = 5;

	for (var y = 0; y < no_elms; y++) {
		var row = $("<div>");
		
		for (var i = 0; i < no_elms; i ++) {
			row.append(ImgViewer.ImgLoader("http://192.168.1.122:8000/hd2/mpeg/Bilder/PANA-IMG_130803-110113.jpg" , p_width / no_elms, p_height / no_elms));
		};
		$("#imageViewer").append(row);
	};
	
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
			Main.selectedVideo = this.imgList[this.curImg];
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