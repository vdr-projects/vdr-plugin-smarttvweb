/*
 * mgnurls.c: VDR on Smart TV plugin
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

#include "mngurls.h"


cManageUrls::cManageUrls(string dir): mLog(), mFilename(), mFile(NULL), mEntries() {
  mLog = Log::getInstance();

  loadEntries(dir);
  mFilename = dir +"/urls.txt"; 
  mFile = new ofstream(mFilename.c_str(), ios::out | ios::app);  
  mFile->seekp(ios_base::end);
};

cManageUrls::~cManageUrls() {
  if (mFile != NULL) {
    mFile->close();
    delete mFile;
  }
  //TODO: delete entries
};


//called from outside to add an entry
void cManageUrls::appendEntry(string type, string url) {
  // iter through entries
  *(mLog->log()) << " cManageUrls::appendEntry: type= " << type << "url= " << url << endl;

  bool found = false;
  if (type.compare("YT") !=0) {
    return;
  }
  for (size_t i = 0; i < mEntries.size(); i ++) {
    if (url.compare(mEntries[i]->mEntry) == 0) {
      found = true;
      break;
    }
  }
  if (!found) {
    *(mLog->log()) << " cManageUrls::appendEntry: Appending... " << endl;
    mEntries.push_back (new sUrlEntry (type, url));
    appendToFile(type+"|"+url);
  }
}


bool cManageUrls::deleteEntry(string type, string url) {
  *(mLog->log()) << " cManageUrls::deleteEntry: type= " << type << "guid= " << url << endl;

  bool found = false;
  if (type.compare("YT") !=0) {
    *(mLog->log()) << " cManageUrls::deleteEntry: Not a YT Url "  << endl;
    return false;
  }
  
  for (size_t i = 0; i < mEntries.size(); i ++) {
    if (url.compare(mEntries[i]->mEntry) == 0) {
      // delete the entry here
      *(mLog->log()) << " cManageUrls::deleteEntry ... " << endl;
      mEntries.erase(mEntries.begin() +i);
      found = true;
      break;
    }
  }

  if (found) {
    *(mLog->log()) << " cManageUrls::deleteEntry - rewriting urls.txt file ... " << endl;
    if (mFile != NULL) {
      mFile->close();
      delete mFile;
    }
    mFile = new ofstream(mFilename.c_str(), ios::out);  
    
    for (size_t i = 0; i < mEntries.size(); i ++) {
      appendToFile(mEntries[i]->mType+"|"+mEntries[i]->mEntry);
    }

    // close the file
    mFile->close();
    delete mFile;
    
    // open for append
    mFile = new ofstream(mFilename.c_str(), ios::out | ios::app);  
    mFile->seekp(ios_base::end);
  }
  return found;
}



size_t cManageUrls::size() { 
  return mEntries.size(); 
} 

sUrlEntry* cManageUrls::getEntry( int index)  { 
  return mEntries[index]; 
};

void cManageUrls::loadEntries(string dir) {
  ifstream myfile ((dir +"/urls.txt").c_str());
  string line;

  string type;

  while ( myfile.good() ) {
    getline (myfile, line);

    if ((line == "") or (line[0] == '#'))
      continue;

    size_t pos = line.find('|');
    string type = line.substr(0, pos);
    string value = line.substr(pos+1);

    //    sUrlEntry* entry = new sUrlEntry(type, value);
    mEntries.push_back(new sUrlEntry(type, value));
  }
  myfile.close();
};

void cManageUrls::appendToFile(string s_line) {
  if (mFile == NULL) {
    *(mLog->log()) << " ERROR in cManageUrls::appendToFile: no file open... " << endl;
    return;
  }
  *(mLog->log()) << " cManageUrls::appendToFile: writing  " << s_line << endl;
  *mFile << s_line << endl;
  //  mFile->write(s_line.c_str(), s_line.size());

  mFile->flush();

}

