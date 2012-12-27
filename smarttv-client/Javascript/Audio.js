var Audio =
{
    plugin : null
};

Audio.init = function()
{
    var success = true;
    
    this.plugin = document.getElementById("pluginAudio");
    
    if (!this.plugin) {
        success = false;
    }

    return success;
};

Audio.setRelativeVolume = function(delta) {
	if (Config.deviceType == 0)
		this.plugin.SetVolumeWithKey(delta);
	else
		Main.log("Un-supported Audio Device");
    Display.setVolume( this.getVolume() );

};

Audio.getVolume = function() {
	var res = 0;
	if (Config.deviceType == 0) {
		res = this.plugin.GetVolume();
	}
	else {
		Main.log("Un-supported Audio Device");	
	}

    return res;
};
