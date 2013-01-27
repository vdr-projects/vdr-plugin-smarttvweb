var Data =
{
	assets : new Item,
	folderList : [],
};

Data.reset = function() {
	this.assets = null;
	this.assets = new Item;
	
	this.folderList = [];		

//	this.folderList.push({item : this.assets, id: 0});
	Main.log("Data.reset: folderList.push. this.folderList.length= " + this.folderList.length);
};

Data.completed= function(sort) {
	if (sort == true)
		this.assets.sortPayload();
	
	this.folderList.push({item : this.assets, id: 0});
	Main.log("Data.completed: folderList.push. this.folderList.length= " + this.folderList.length);
	Main.log ("Data.completed()= " +this.folderList.length);

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
    this.assets.addChild(t_list, pyld, 0);
};

Data.dumpFolderStruct = function(){
    Main.log("---------- dumpFolderStruct ------------");    
    this.assets.print(0);
    Main.log("---------- dumpFolderStruct Done -------");    
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


//-----------------------------------------
function Item() {
    this.title = "root";
    this.isFolder = true;
    this.childs = [];
    this.payload = "";  // only set, if (isFolder == false)
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
		var folder = new Item;
//		folder.title = pyld.startstr + " - " + key;
		folder.title = key[0];
		folder.payload = pyld;
		folder.isFolder = false;
		this.childs.push(folder);
//	this.titles.push({title: pyld.startstr + " - " + key , pyld : pyld});
    }
    else {
    	if (level > 10) {
    		Main.log(" too many levels");
    		return;
    	}
    	var t = key.shift();
    	var found = false;
    	for (var i = 0; i < this.childs.length; i++) {
    		if (this.childs[i].title == t) {
    			this.childs[i].addChild(key, pyld, level +1);
    			found = true;
    			break;
    		}
    	}
    	if (found == false) {
    		var folder = new Item;
    		folder.title = t;
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
    			Main.log(prefix + "New Min= " + min + " new id= " + guid + " title= " + this.childs[i].title);
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
    	Main.log(prefix + this.childs[i].title);
    	if (this.childs[i].isFolder == true) {
    		Main.log(prefix+"Childs:");
        	this.childs[i].print(level +1);
    	}
    }
};

Item.prototype.sortPayload = function() {
    for (var i = 0; i < this.childs.length; i++) {
    	if (this.childs[i].isFolder == true) {
        	this.childs[i].sortPayload();
    	}
    }
    this.childs.sort(function(a,b) { 
    	if (a.title == b.title) {
    		return (b.payload.start - a.payload.start);
    	}
    	else {
    		return ((a.title < b.title) ? -1 : 1);
    	}		
    });
};

