var Network = {
	plugin : null,
	ownMac : "",
	ownGw : ""
};

Network.init = function () {
    this.plugin = document.getElementById("pluginNetwork");
    var nw_type = this.plugin.GetActiveType();
    if ((nw_type == 0) ||  (nw_type == 1)) {
		this.ownMac = this.plugin.GetMAC(nw_type);
		this.ownGw = this.plugin.GetGateway(nw_type);
    }
    alert( "ownMac= " +  this.ownMac);
    alert ("ownGw= " + this.ownGw);
} ;


Network.getMac = function () {
	return this.ownMac;
};

Network.getGateway = function () {
	return this.ownGw;
};