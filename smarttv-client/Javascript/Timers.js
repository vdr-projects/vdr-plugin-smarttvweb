var Timers = {
	haveRapi : false,
	timerList : {}
};

Timers.init = function() {
	var url = "http://192.168.1.122:8002/info.xml";
	$.ajax({
		url: url,
		type : "GET",
		success : function(data, status, XHR ) {
			Timers.haveRapi = true;
			Main.log ("Timers: Got response");
			Timers.readTimers();

		},
		error : function (jqXHR, status, error) {
			Timers.haveRapi = false;
			Main.log ("Timers: Not found!!!");
		}
		});		
};

Timers.readTimers = function () {
	if (Timers.haveRapi == false) {
		Main.log ("Timers.readTimers: no restful API!!!");
		return;
	}
	var url = "http://192.168.1.122:8002/timers.xml";
	$.ajax({
		url: url,
		type : "GET",
		success : function(data, status, XHR ) {
			Main.log ("Timers.readTimer: Success");
			Main.log(" Count= " + $(data).find("count").text());
			$(data).find("timer").each(function () {
				Main.log("timer: ");
				Timers.curItem = {};
				$(this).find("param").each(function () {
					Main.log(" + " + $(this).attr("name") + " val= " +$(this).text());
					Timers.curItem[$(this).attr("name")] = $(this).text();
				});
/*				for (var prop in Timers.curItem) {
					Main.log (" -" + prop + " : " + Timers.curItem[prop]);
				}
				*/
				Main.log("Adding id " +Timers.curItem["id"]);
				Timers.timerList[Timers.curItem["id"]] = Timers.curItem;
				Timers.curItem = {};
			});
			Main.log("Summary");
			for (var id in Timers.timerList) {
				Main.log (id + " : ");
				for (var prop in Timers.timerList[id]) {
				Main.log (" - " + prop + " : " + Timers.timerList[id][prop]);
				}

			}
		},
		error : function (jqXHR, status, error) {
			Main.log ("Timers.readTimer: Failure");
		}
		});		
};