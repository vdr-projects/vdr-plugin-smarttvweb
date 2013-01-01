var Options = {
	imeBox : null
};

Options.init = function() {
	_g_ime.Recog_use_YN = false;
	_g_ime.keySet = '12key';

	this.imeBox = new IMEShell("widgetServerAddr", Options.onImeCreated, 'de');
};

Options.onComplete = function () {
	Main.log("Completed");
};

Options.onEnter = function () {
	Main.log("Enter: " + document.getElementById("widgetServerAddr").value );

	Config.updateContext(document.getElementById("widgetServerAddr").value);
	

	document.getElementById('widgetServerAddr').blur();

	document.getElementById("optionsScreen").style.display="none";

	if (Config.firstLaunch == true)
		Main.state = 1;
	Main.changeState(0);
	
	Config.fetchConfig();
	if(_g_ime.pluginMouse_use_YN){
		this.imeBox._blur();
	};

	//	Main.enableKeys();
};

Options.onBlue = function () {
	var val = document.getElementById("widgetServerAddr").value + ".";
	Options.imeBox.setString(val);
};

Options.onImeCreated = function(obj) {
//	_g_ime.keySet ("12key");
//	obj.setKeySetFunc('12key');
	Main.logToServer ("Options.onImeCreated()");

	Main.logToServer ("[IME] ============================================ imeobj.IsSupportXT9:"+obj.IsSupportXT9);
	var strKeySet = obj.getKeySet();
	Main.logToServer ("[IME] ============================================ strKeySet:"+strKeySet);

	
	obj.setKeyFunc(tvKey.KEY_RETURN, function(keyCode) { widgetAPI.sendReturnEvent(); return false; } );
	obj.setKeyFunc(tvKey.KEY_EXIT, function(keyCode) { widgetAPI.sendExitEvent(); return false; } );

	obj.setKeypadPos(650, 135);
	obj.setWordBoxPos(18, 6);
	obj.setKeyFunc(tvKey.KEY_BLUE, Options.onBlue);

	obj.setString(Config.serverAddrDefault);
	obj.setEnterFunc(Options.onEnter);

	if (obj.setMode("_num") == false) {
		Main.logToServer("obj.setMode(\"_num\") returns false"); 
	}

	Options.imeBox.setOnCompleteFunc(Options.onComplete);

	if(_g_ime.pluginMouse_use_YN){
		obj._focus();
	};
	document.getElementById('widgetServerAddr').focus();
	Main.logToServer ("Options.onReady()");
	Main.logToServer ("KeySet= " + Options.imeBox.getKeySet());
	
	Options.onReady ();
};

Options.onReady = function () {
	
};


