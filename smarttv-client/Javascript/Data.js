var Data =
{
	assets : new Item,
	folderList : [],
};

Data.reset = function() {
	this.assets = null;
	this.assets = new Item;
	
	this.folderList = [];		

	this.folderList.push({item : this.assets, id: 0});
};

Data.completed= function(sort) {
	if (sort == true)
		this.assets.sortPayload();
	
	this.folderList.push({item : this.assets, id: 0});
	alert ("Data.completed()= " +this.folderList.length);

};

Data.selectFolder = function (idx) {
	this.folderList.push({item : this.getCurrentItem().childs[idx], id: idx});
};

Data.isRootFolder = function() {
	if (this.folderList.length == 1)
		return true;
	else
		return false;
};

Data.folderUp = function () {
	itm = this.folderList.pop();
	return itm.id;
};

Data.addItem = function(t_list, pyld) {
    this.assets.addChild(t_list, pyld, 0);
};

Data.dumpFolderStruct = function(){
    alert("---------- dumpFolderStruct ------------");    
    this.assets.print(0);
    alert("---------- dumpFolderStruct Done -------");    
};

Data.getCurrentItem = function () {
	return this.folderList[this.folderList.length-1].item;
};

Data.getVideoCount = function()
{
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
		alert("WARNING: getting payload on a folder title=" +this.title);
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
    		alert(" too many levels");
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

Item.prototype.print = function(level) {
    var prefix= "";
    for (var i = 0; i < level; i++)
    	prefix += " ";
    
    for (var i = 0; i < this.childs.length; i++) {
    	alert(prefix + this.childs[i].title);
    	if (this.childs[i].isFolder == true) {
    		alert(prefix+"Childs:");
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

