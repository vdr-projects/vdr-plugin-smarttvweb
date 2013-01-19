var Spinner = 
{ 
	index : 1, 
	run: 0,
 	timeout : 0      
};
    
Spinner.init = function () {
//	var sp_width = 	$("#Spinning").width();
//	var sp_height = $("#Spinning").height();

	// TODO: No Abs Number please
	$("#Spinning").children().eq(0).css({"margin-left": "43px", "margin-top": "37px"});
};

Spinner.show= function() {
	if (this.run == 1)
		return;
	
	if (this.timeout > 0) {
		clearTimeout(this.timeout);
		this.timeout = 0;
	}
	
	this.index=1;

	if (this.run==0) {
		this.run=1;		
		$("#Spinning").show();
		Spinner.step();
	}
};
    
Spinner.hide= function() {
	$("#Spinning").hide();
	this.run=0;
};  

 Spinner.step=function() {
	 $("#Spinning").children().eq(0).attr("src", "Images/spinner/loading_"+this.index+".png");
	
	this.index++;
		
	if (this.index > 12) {
		this.index=1;
	}

	if (this.run) {
		this.timeout = setTimeout("Spinner.step();", 200);
	}
};
