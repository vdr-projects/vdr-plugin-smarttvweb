var Data =
{
	assets : new Item,
	folderList : [],
	createAccessMap : false,
	directAccessMap : {},
	sortType : 0,
	maxSort : 3
};

Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

Data.reset = function() {
	this.assets = null;
	this.assets = new Item;
	this.folderList = [];		
	this.createAccessMap = false;
	this.sortType = Config.sortType;
//	this.folderList.push({item : this.assets, id: 0});
	Main.log("Data.reset: folderList.push. this.folderList.length= " + this.folderList.length);
};

Data.completed= function(sort) {
	if (sort == true) {
		this.assets.sortPayload(Data.sortType);
		if (this.createAccessMap == true) {
			Main.log("ERROR: access map does not match anymore");
		}
	}
	
	this.folderList.push({item : this.assets, id: 0});
    Main.log("---------- completed ------------");    
	Main.log("Data.completed: Data.folderList.length= " + this.folderList.length);
	Main.log("Data.completed(): createAccessMap= " + ((this.createAccessMap == true) ? "true": "false"));
};

Data.nextSortType = function () {
	Data.sortType = (Data.sortType +1) % Data.maxSort;
	this.assets.sortPayload(Data.sortType);	
};

Data.selectFolder = function (idx, first_idx) {
	this.folderList.push({item : this.getCurrentItem().childs[idx], id: idx, first:first_idx});
	Main.log("Data.selectFolder: folderList.push. this.folderList.length= " + this.folderList.length);
};

Data.folderUp = function () {
	itm = this.folderList.pop();
	Main.log("Data.folderUp: folderList.pop. this.folderList.length= " + this.folderList.length);
	return itm;
//	return itm.id;
};

Data.isRootFolder = function() {
	Main.log("Data.isRootFolder: this.folderList.length= " + this.folderList.length);
	if (this.folderList.length == 1)
		return true;
	else
		return false;
};

Data.addItem = function(t_list, pyld) {
	if (this.createAccessMap == true) {
		this.directAccessMap[pyld.num] = [];
	}
    this.assets.addChild(t_list, pyld, 0);
};

Data.dumpFolderStruct = function(){
    Main.log("---------- dumpFolderStruct ------------");    
    this.assets.print(0);
    Main.log("---------- dumpFolderStruct Done -------");    
};

Data.dumpDirectAccessMap = function(){
    Main.log("---------- dumpDirectAccessMap ------------");    
	for(var prop in this.directAccessMap) {
		var s = "";
		for (var i = 0; i < this.directAccessMap[prop].length; i++)
			s = s + "i= " + i + " = " + this.directAccessMap[prop][i] + " ";
		Main.log(prop + ": " + s);
	} 
/*	var i = 1;
	for (i = 1; i < 20; i++)
		Main.log(i + ": " + this.directAccessMap[""+i]);
*/	
	Main.log("---------- dumpDirectAccessMap Done -------");    

};

Data.findEpgUpdateTime = function() {
	return this.assets.findEpgUpdateTime(Display.GetEpochTime() + 10000, "", 0);
	// min, guid, level
};

Data.updateEpg = function (guid, entry) {
	this.assets.updateEpgEntry(guid, entry, 0);
};

Data.getCurrentItem = function () {
	return this.folderList[this.folderList.length-1].item;
};

Data.getVideoCount = function() {
	return this.folderList[this.folderList.length-1].item.childs.length;
};

Data.deleteElm = function (pos) {
	Data.getCurrentItem().childs.remove(pos);
};
//-----------------------------------------
function Item() {
    this.title = "root";
    this.isFolder = true;
    this.childs = [];
    this.payload = {};  // only set, if (isFolder == false)
}

Item.prototype.isFolder = function() {
	return this.isFolder;
};

Item.prototype.getTitle = function () {
	return this.title;
};

Item.prototype.getPayload = function () {
	if (this.isFolder == true) {
		Main.log("WARNING: getting payload on a folder title=" +this.title);
	}
	return this.payload;
};

Item.prototype.getItem = function (title) {
    for (var i = 0; i < this.childs.length; i++) {
    	if (this.childs[i].title == title) {
    		return this.childs[i];
    	}	
    }
    return 0;
};

Item.prototype.addChild = function (key, pyld, level) {
	if (key.length == 1) {
		if (Data.createAccessMap == true) {
			Data.directAccessMap[pyld.num].push(this.childs.length);
		//	this.titles.push({title: pyld.startstr + " - " + key , pyld : pyld});
		}
		var folder = new Item;
		folder.title = key[0];
		folder.payload = pyld;
		folder.isFolder = false;
		this.childs.push(folder);
	}
    else {
    	if (level > 20) {
    		Main.log(" too many levels");
    		return;
    	}
    	var t = key.shift();
    	var found = false;
    	for (var i = 0; i < this.childs.length; i++) {
    		if (this.childs[i].title == t) {
				if (Data.createAccessMap == true) {
					Data.directAccessMap[pyld.num].push(i); // should start from 1
				}
    			this.childs[i].addChild(key, pyld, level +1);
    			found = true;
				break;
    		}
    	}
    	if (found == false) {
    		var folder = new Item;
			if (Data.createAccessMap == true) {
				Data.directAccessMap[pyld.num].push(this.childs.length); // should start from 1
			}
    		folder.title = t;
    		folder.payload['start'] = 0;
    		folder.addChild(key, pyld, level+1);
    		this.childs.push(folder);
    	}
    }
};

Item.prototype.findEpgUpdateTime = function (min, guid, level) {
    var prefix= "";
    for (var i = 0; i < level; i++)
    	prefix += "-";

    for (var i = 0; i < this.childs.length; i++) {
    	if (this.childs[i].isFolder == true) {
    		var res = this.childs[i].findEpgUpdateTime(min, guid, level+1);
    		min = res.min;
    		guid = res.guid;
    	}
    	else {
    		var digi =new Date(this.childs[i].payload['start']  * 1000);
    		var str = digi.getHours() + ":" + digi.getMinutes();
   		
//			Main.log(prefix + "min= " + min+ " start= " + this.childs[i].payload['start'] + " (" + str+ ") title= " + this.childs[i].title);
    		
    		if ((this.childs[i].payload['start'] != 0) && ((this.childs[i].payload['start'] + this.childs[i].payload['dur']) < min)) {
    			min = this.childs[i].payload['start'] + this.childs[i].payload['dur'];
    			guid = this.childs[i].payload['guid'] ;
//    			Main.log(prefix + "New Min= " + min + " new id= " + guid + " title= " + this.childs[i].title);
//    			Main.logToServer(prefix + "New Min= " + min + " new id= " + guid + " title= " + this.childs[i].title);
    		}
    	}
    }  

    return { "min": min, "guid" : guid};
};

Item.prototype.updateEpgEntry = function (guid, entry, level) {
    var prefix= "";
    for (var i = 0; i < level; i++)
    	prefix += "-";
    for (var i = 0; i < this.childs.length; i++) {
    	if (this.childs[i].isFolder == true) {
    		var res = this.childs[i].updateEpgEntry(guid, entry, level+1);
			if (res == true)
				return true;
    	}
		else {
			if (this.childs[i].payload['guid'] == guid) {
				Main.log("updateEpgEntry: Found " + this.childs[i].title);
				this.childs[i].payload.prog = entry.prog;
				this.childs[i].payload.desc = entry.desc;
				this.childs[i].payload.start = entry.start;
				this.childs[i].payload.dur = entry.dur;
				return true;
			}
		}
	}
	return false;
};

Item.prototype.print = function(level) {
    var prefix= "";
    for (var i = 0; i < level; i++)
    	prefix += " ";
    
    for (var i = 0; i < this.childs.length; i++) {
    	Main.log(prefix + this.childs[i].payload.start + "\t" + this.childs[i].title + " isFolder= " + this.childs[i].isFolder);
    	if (this.childs[i].isFolder == true) {
    		Main.log(prefix+"Childs:");
        	this.childs[i].print(level +1);
    	}
    }
};

Item.prototype.sortPayload = function(sel) {
	for (var i = 0; i < this.childs.length; i++) {
		if (this.childs[i].isFolder == true) {
			this.childs[i].sortPayload(sel);
		}
	}

	switch (sel) {
	case 1:
		// Dy Date
		this.childs.sort(function(a,b) { 
			if (a.payload.start == b.payload.start) {
				return ((a.title < b.title) ? -1 : 1);
			}
			else {
				return (a.payload.start - b.payload.start);
			}
		});
		break;
	case 2:
		// Dy Date
		this.childs.sort(function(a,b) { 
			if (a.payload.start == b.payload.start) {
				return (a.title >= b.title);
			}
			else {
				return (b.payload.start - a.payload.start);
			}
		});
		break;
	case 3:
	    this.childs.sort(function(a,b) { 
	    	if (a.title == b.title) {
	    		return (b.payload.start -a.payload.start);
	    	}
	    	else {
	    		return ((a.title < b.title) ? -1 : 1);

	    	}		
	    });
	    break;
	case 0:
	default:
	    this.childs.sort(function(a,b) { 
	    	if (a.title == b.title) {
	    		return (a.payload.start - b.payload.start);
	    	}
	    	else {
	    		return ((a.title < b.title) ? -1 : 1);

	    	}		
	    });

		break;
	}
};
