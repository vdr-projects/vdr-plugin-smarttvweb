/*
 * mgnurls.h: VDR on Smart TV plugin
 *
 * Copyright (C) 2012, 2013 T. Lohmar
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA
 * Or, point your browser to http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 *
 */

//Manage Urls

/*
the object is kept by the factory.
The object is loaded with the first url request (get or post)
The object is then kept.
  The file is updated with every new url entry, so that it does not need to wrte when closing
*/
#ifndef __MANAGEURLS_H__
#define __MANAGEURLS_H__

#include<vector>
#include<fstream>
#include "log.h"

struct sUrlEntry {
  string mType;
  string mEntry;
sUrlEntry(string t,string e): mType(t), mEntry(e) {};
};

class cManageUrls {
 public:
  cManageUrls(string dir) ;
  virtual ~cManageUrls();
  
  void appendEntry (string type, string guid);
  size_t size();
  sUrlEntry* getEntry(int index);

 private:
  void loadEntries(string dir);
  void appendToFile(string);

  Log* mLog;

  ofstream* mFile;
  vector<sUrlEntry*> mEntries;
  
};

#endif
