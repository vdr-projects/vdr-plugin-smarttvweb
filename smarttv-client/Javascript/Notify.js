var Notify = {
	notifyOlHandler : null
};


Notify.init = function () {
    this.notifyOlHandler = new OverlayHandler("NotifyHndl");
	this.notifyOlHandler.init(Notify.handlerShowNotify, Notify.handlerHideNotify);

};


Notify.showNotify = function (msg, timer) {

	$("#notify").text(msg);
	if (timer == true)
		this.notifyOlHandler.show();
	else 
		$("#notify").show();
};

Notify.handlerShowNotify = function () {
	$("#notify").show();
};

Notify.handlerHideNotify = function () {
	$("#notify").hide();
	$("#notify").text("");
};

