var Options = {
	imeBox : null
};

Options.init = function() {
	_g_ime.Recog_use_YN = false;
	_g_ime.keySet = '12key';

	this.imeBox = new IMEShell("widgetServerAddr", Options.onImeCreated, 'de');
	alert ("Options Initiated");
};

Options.onComplete = function () {
	alert("Colpleted");
};

Options.onEnter = function () {
	alert("Enter: " + document.getElementById("widgetServerAddr").value );
	Config.updateContext(document.getElementById("widgetServerAddr").value);
	
	document.getElementById('widgetServerAddr').blur();

	document.getElementById("optionsScreen").style.display="none";

	if (Config.firstLaunch == true)
		Main.state = 1;
	Main.changeState(0);
	
	Config.fetchConfig();
//	Main.enableKeys();
};

Options.onBlue = function () {
	var val = document.getElementById("widgetServerAddr").value + ".";
	Options.imeBox.setString(val);
};

Options.onImeCreated = function(obj) {
//	_g_ime.keySet ("12key");
//	obj.setKeySetFunc('12key');

	obj.setKeyFunc(tvKey.KEY_RETURN, function(keyCode) { widgetAPI.sendReturnEvent(); return false; } );
	obj.setKeyFunc(tvKey.KEY_EXIT, function(keyCode) { widgetAPI.sendExitEvent(); return false; } );

	obj.setKeypadPos(650, 135);
	obj.setWordBoxPos(18, 6);
	obj.setKeyFunc(tvKey.KEY_BLUE, Options.onBlue);

	obj.setString(Config.serverAddr);
	obj.setEnterFunc(Options.onEnter);

	if (obj.setMode("_num") == false) {
		Main.log("obj.setMode(\"_num\") returns false"); 
	}

	Options.imeBox.setOnCompleteFunc(Options.onComplete);

	Options.onReady ();
};

Options.onReady = function () {
	document.getElementById('widgetServerAddr').focus();
	alert ("KeySet= " + this.imeBox.getKeySet());
};


