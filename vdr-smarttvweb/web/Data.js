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
	console.log ("Data.completed()= " +this.folderList.length);

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
    Main.log("---------- dumpFolderStruct ------------");    
    this.assets.print(0);
    Main.log("---------- dumpFolderStruct Done -------");    
};

Data.createDomTree = function () {
	
    return this.assets.createDomTree(0);
};

Data.createJQMDomTree = function () {
    return this.assets.createJQMDomTree(0);
};

Data.getCurrentItem = function () {
	return this.folderList[this.folderList.length-1].item;
};

Data.getVideoCount = function()
{
	return this.folderList[this.folderList.length-1].item.childs.length;
};

Data.getNumString =function(num, fmt) {
        var res = "";

        if (num < 10) {
                for (var i = 1; i < fmt; i ++) {
                        res += "0";
                };
        } else if (num < 100) {
                for (var i = 2; i < fmt; i ++) {
                        res += "0";
                };
        }

        res = res + num;

        return res;
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

Item.prototype.createDomTree = function(level) {
    var prefix= "";
    for (var i = 0; i < level; i++)
    	prefix += "-";
//	var mydiv = $('<div class="folder">' +prefix+this.title+ '</div>');
	var mydiv = $('<ul />');

    for (var i = 0; i < this.childs.length; i++) {
    	if (this.childs[i].isFolder == true) {
//            mydiv.appendChild(this.childs[i].createDomTree());
			var myli = $('<li class="folder">' +prefix +this.childs[i].title + '</li>');					
            myli.append(this.childs[i].createDomTree(level+1));
			mydiv.append(myli);
    	}
	else {
//	var mya = $('<a class="link">' +prefix +this.childs[i].title + '</a>');
		var mya = $('<a>', { text: prefix +this.childs[i].title, href: this.childs[i].payload['link']}  );
		var myli = $('<li class="item"/>');
		myli.append(mya);
		mydiv.append(myli);
		}
    }  
    return mydiv;
};

Item.prototype.createJQMDomTree = function(level) {
	var mydiv = $('<ul />');
//	if (level == 0) {
		mydiv.attr('data-role', 'listview');
		mydiv.attr('data-inset', 'true');
//	};
//, id:'dyncreated'
    for (var i = 0; i < this.childs.length; i++) {
    	if (this.childs[i].isFolder == true) {
			var myh = $('<div>', {text: this.childs[i].title});
			var myli = $('<li>');
			myli.append(myh);
			var mycount = $('<p>', {class: 'ui-li-count', text: this.childs[i].childs.length});
			myli.append(mycount);
            myli.append(this.childs[i].createJQMDomTree(level+1));
			mydiv.append(myli);
    	}
	else {
		// Links
		var digi = new Date(this.childs[i].payload['start'] *1000);
		var mon = Data.getNumString ((digi.getMonth()+1), 2);
        var day = Data.getNumString (digi.getDate(), 2);
        var hour = Data.getNumString (digi.getHours(), 2);
        var min = Data.getNumString (digi.getMinutes(), 2);
		
		var d_str = mon + "/" + day + " " + hour + ":" + min;
 		var mya = $('<a>', { text: d_str +  " - " + this.childs[i].title, 
							 href: this.childs[i].payload['link'], 
							 rel: 'external'}  );
		var myli = $('<li class="item"/>');
		myli.attr('data-icon', 'false');
		myli.attr('data-theme', 'c');
		
		myli.append(mya);
		mydiv.append(myli);
		}
    }  
    return mydiv;
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

