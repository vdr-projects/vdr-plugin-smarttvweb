var Network = {
	plugin : null,
	ownMac : "",
	ownGw : "",
	isInited: false
};

Network.init = function () {
    this.plugin = document.getElementById("pluginNetwork");
    try {
        var nw_type = this.plugin.GetActiveType();
        if ((nw_type == 0) ||  (nw_type == 1)) {
    		this.ownMac = this.plugin.GetMAC(nw_type);
    		this.ownGw = this.plugin.GetGateway(nw_type);
        }
        Main.log( "ownMac= " +  this.ownMac);
        Main.log ("ownGw= " + this.ownGw);
        this.isInited = true;
    }
    catch (e) {
    	// Code for Non Samsung SmartTV here
    }
} ;


Network.getMac = function () {
	return this.ownMac;
};

Network.getGateway = function () {
	return this.ownGw;
};