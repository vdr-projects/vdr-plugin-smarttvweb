 /*
 * smarttvfactory.c: VDR on Smart TV plugin
 *
 * Copyright (C) 2012 - 2014 T. Lohmar
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

#ifndef STANDALONE
#include <vdr/recording.h>
#include <vdr/videodir.h>
#endif

#include <iostream>

#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <time.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/select.h>
#include <sys/ioctl.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <net/if.h>
#include <netdb.h>
#include <fcntl.h>
#include <errno.h>
#include <dirent.h>

#include <iostream>
#include <fstream>
#include <sstream>

#include "smarttvfactory.h"
#include "httpresource.h"
#include "httpclient.h"
#include "url.h"

#include "responselive.h"

#ifndef STANDALONE
#define PORT 8000
#else
#define PORT 9000
#endif

#define OKAY 0
#define ERROR (-1)

#define DEBUG


using namespace std;

void SmartTvServerStartThread(void* arg) {
  SmartTvServer* m = (SmartTvServer*)arg;
  m->threadLoop();
  delete m;
  pthread_exit(NULL);
}

cCmd::cCmd(string t) :mTitle(), mCommand(), mConfirm(false) {
  // find column
 
  mTitle = t.substr(0, t.find(':'));
  trim(mTitle);
  if (mTitle[mTitle.size()-1] == '?') {
    mConfirm =true;
    mTitle.erase(mTitle.end()-1);
    trim(mTitle);
  }
  mTitle = cUrlEncode::doXmlSaveEncode(mTitle);

  mCommand = t.substr(t.find(':')+1);
  trim(mCommand);
};

void cCmd::trim(string &t) {
  int m=0;
  for (int i=0; i<t.size(); i++) 
    if (!((t[i] == 32) || (t[i] == 9)) ) {
      m =i;
      break;
    }
  t.erase(0, m);
  
  m = t.size() -1;
  for (int i= t.size()-1; i >=0; i--)
    if (!((t[i] == 32) || (t[i] == 9)) ) {
      m= i;
      break;
    }
  t.erase(m+1);
}


void cRecEntryBase::print(string pref) {
  *(mLog->log()) << pref 
		 << ": l= " << mLevel 
    		 << " B= " << mName 
		 << endl;
};

void cRecEntry::print(string pref) {
  *(mLog->log()) << pref 
		 << ": l= " << mLevel 
		 << " sfs= " << mSubfolders.size()
		 << " E= " << mTitle
		 << endl;
};

void cRecFolder::print(string pref) {
  *(mLog->log()) << pref 
		 << ": l= " << mLevel 
		 << " es= " << mEntries.size()
		 << " F= " << mName 
		 << endl;
  for (list<cRecEntryBase*>::iterator iter = mEntries.begin(); iter != mEntries.end(); ++iter)
    (*iter)->print(pref + "+" + mName);
    
};

cRecEntry::cRecEntry(string n, int l, Log* lg, cRecording* r) : cRecEntryBase(n, l, false, lg), mRec(r), mSubfolders(), 
  mError(false), mTitle(n)  {

  size_t pos = 0;
  size_t l_pos = 0;
  for (int i = 0; i <= l; i++) {
    if (l_pos == string::npos) {
      *(mLog->log()) << mLog->getTimeString()
		     << " ERROR: " 
		     << " Name= " << n
		     << endl;
      mError = true;
      break;
    }
    pos = n.find('~', l_pos);
    string dir = n.substr(l_pos, (pos -l_pos));

    /*
    *(mLog->log()) << " (p= " << pos
		   << " l= " << l_pos
		   << " d= " << dir
		   << ")"; 
*/
    mSubfolders.push_back(dir);
    
    l_pos = pos +1;
  } 
  //  *(mLog->log()) << endl; 

  *(mLog->log()) << mLog->getTimeString()
		 << " L= " << mLevel << " " << l
		 << " SFs= " << mSubfolders.size()
		 << " FName= " << mName
		 << endl;

  int idx = mSubfolders.size() -1;
  if (idx != l) {
    *(mLog->log()) << mLog->getTimeString()
		   << " ERROR: mName= " << mName
		   << " Level (" << l
		   << ") missmatches subfolders (" << mSubfolders.size()
		   << ")"
		   << endl;
  }
  else
    mName = mSubfolders[idx];
}

int cRecEntry::writeXmlItem(string * msg, string own_ip, int own_port) {
  string hdr = "";
  char f[400];

  hdr += "<item>\n";
  hdr += "<title>" + mTitle +"</title>\n";
  hdr += "<isfolder>false</isfolder>\n";
  //  mRec->IsPesRecording();

  snprintf(f, sizeof(f), "http://%s:%d%s", own_ip.c_str(), own_port,
	   cUrlEncode::doUrlSaveEncode(mRec->FileName()).c_str());

  string mime = "video/mpeg";
  string programme = "NA";
  string desc = "NA";
  int no = -1;

  hdr += "<enclosure url=\"";
  hdr += f;
  hdr += "\" type=\""+mime+"\" />\n";

  hdr += "<guid>" + cUrlEncode::doUrlSaveEncode(mRec->FileName()) + "</guid>\n";
  
  snprintf(f, sizeof(f), "%d", no);
  hdr += "<number>";
  hdr += f;
  hdr += "</number>\n";
  hdr += "<programme>" + programme +"</programme>\n";
  hdr += "<description>" + desc + "</description>\n";

  snprintf(f, sizeof(f), "%ld", mRec->Start());
  hdr += "<start>";
  hdr += f;
  hdr += "</start>\n";

  snprintf(f, sizeof(f), "%d", mRec->LengthInSeconds());
  hdr += "<duration>";

  hdr += f;
  hdr += "</duration>\n";

  snprintf(f, sizeof(f), "<fps>%.2f</fps>\n", mRec->FramesPerSecond());
  hdr += f;
  
  if (mRec->IsPesRecording())
    hdr += "<ispes>true</ispes>\n";
  else
    hdr += "<ispes>false</ispes>\n";

  if (mRec->IsNew()) 
    hdr += "<isnew>true</isnew>\n";
  else
    hdr += "<isnew>false</isnew>\n";

  hdr += "</item>\n";

  *msg += hdr;
  return 0;
}

int cRecFolder::writeXmlItem(string * msg, string own_ip, int own_port) {
  string hdr = "";

  hdr += "<item>\n";
  hdr += "<title>" + mName +"</title>\n";
  hdr += "<guid>" + cUrlEncode::doUrlSaveEncode(mPath) + "</guid>\n";

  hdr += "<isfolder>true</isfolder>\n";
  hdr += "</item>\n";

  *msg += hdr;
  return 0;
}

int cRecFolder::writeXmlFolder(string* msg, string own_ip, int own_port) {
  string hdr = "";
  hdr += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  hdr += "<rss version=\"2.0\">\n";
  hdr+= "<channel>\n";
  hdr+= "<title>VDR Recordings List</title>\n";

  *msg += hdr;

  //iter over all items
  for (list<cRecEntryBase*>::iterator iter = mEntries.begin(); iter != mEntries.end(); ++iter) {
    (*iter)->writeXmlItem(msg, own_ip, own_port);
  }

  hdr = "</channel>\n";
  hdr += "</rss>\n";
  
  *msg += hdr;

  //  *(mLog->log())<< DEBUGPREFIX << " Recording Count= " <<item_count<< endl;

  return OKAY;

}

void cRecFolder::appendEntry(cRecFolder* entry) {
  *(mLog->log()) << mLog->getTimeString() << " appendEntry "
		 << " mName= " << mName
		 << " ol= " << mLevel
		 << " Folder" 
		 << " l= " << entry->mLevel
		<< " Name= " << entry->mName  
		<< endl;
  mEntries.push_back(entry);
}


void cRecFolder::appendEntry(cRecEntry* entry) {

  // root: append to mEntries
  if (entry->mLevel == mLevel) {
    *(mLog->log()) << mLog->getTimeString() << " appendEntry "
		   << " mName= " << mName
		   << " ol= " << mLevel
		   << " Entry" 
		   << " l= " << entry->mLevel
		   << " Name= " << entry->mName  
		   << endl;

    mEntries.push_back(entry);
    return;
  }

  *(mLog->log()) << mLog->getTimeString() << " - appendEntry "
		 << " mName= " << mName
		 << " ol= " << mLevel
		 << " Entry" 
		 << " l= " << entry->mLevel
		 << " sf= " << (entry->mSubfolders).size()
		 << " f= " << entry->mSubfolders[mLevel]
		 << " Name= " << entry->mName  
		 << endl;
  
  // find needed subfolder
  bool found = false;
  for (list<cRecEntryBase*>::iterator iter= mEntries.begin(); iter != mEntries.end(); ++iter) {
    if (((*iter)->mName == entry->mSubfolders[mLevel]) && ((*iter)->mIsFolder)) {
      ((cRecFolder*)(*iter))->appendEntry(entry);
      found = true;
      break;
    }
  }
  if (!found) {
    string p = ((mPath == "") ? entry->mSubfolders[mLevel] : mPath + "~" + entry->mSubfolders[mLevel]);
    cRecFolder* folder = new cRecFolder(entry->mSubfolders[mLevel], p, mLevel +1, mLog);
    appendEntry(folder);
    folder->appendEntry(entry);
  }
  // check, if a subfolder is needed
}

cRecFolder* cRecFolder::GetFolder(list<string> *folder_list) {
  string name = folder_list->front();
  cRecFolder* dir = NULL;
  *(mLog->log()) << mLog->getTimeString() 
		 << " GetFolder name= " << name << endl;
  for (list<cRecEntryBase*>::iterator iter= mEntries.begin(); iter != mEntries.end(); ++iter) {
    if (((*iter)->mName == name) && ((*iter)->mIsFolder)) {
      dir = (cRecFolder*)(*iter);
      break;
    }
  }  
  if (dir != NULL) {
    folder_list->pop_front();
    if (folder_list->size() != 0)
      return dir->GetFolder(folder_list);
    else 
      return dir;
  }
  return NULL;
}


SmartTvServer::SmartTvServer(): cStatus(), mRequestCount(0), isInited(false), serverPort(PORT), mServerFd(-1),
  mSegmentDuration(10), mHasMinBufferTime(40),  mLiveChannels(20), 
  clientList(), mConTvClients(), mRecCmds(), mCmdCmds(), mRecMsg(), mCmdMsg(), mActiveSessions(0), mHttpClientId(0), 
  mConfig(NULL), mMaxFd(0),
  mManagedUrls(NULL), mActRecordings(), mRecordings(NULL), mRecState(0) {

}


SmartTvServer::~SmartTvServer() {

  delete mRecordings;

  if (mConfig != NULL)
    delete mConfig;

  for (uint i =0; i < mRecCmds.size(); i++)
    delete mRecCmds[i];

  for (uint i =0; i < mCmdCmds.size(); i++)
    delete mCmdCmds[i];
}

// Status methods
void SmartTvServer::Recording(const cDevice *Device, const char *Name, const char *FileName, bool On) {
#ifndef DEBUG
  *(mLog.log()) << getTimeString() << ": SmartTvServer::Recording: Recording"  
		<< ((On) ? " started" : " stopped")
		<< endl;
#endif
  stringstream msg;  
  string name ;
  
  if (Name == NULL) {
    if (FileName == NULL) {
      *(mLog.log()) << mLog.getTimeString() << ": WARNING in SmartTvServer::Recording: Name and FileName are NULL. Return.  " << endl;
      return;
    }
    //    cRecording* rec = Recordings.GetByName(FileName);
#if APIVERSNUM > 20300
    LOCK_RECORDINGS_READ;
    const cRecording* rec = Recordings->GetByName(FileName);
#else
    cThreadLock RecordingsLock(&Recordings);
    cRecording* rec = Recordings.GetByName(FileName);
#endif
    if (rec == NULL) {
      *(mLog.log()) << mLog.getTimeString() << ": WARNING in SmartTvServer::Recording: No Recording Entry found. Return.  " << endl;
      return;
    }
    name = rec->Name();
  }
  else 
    name = Name;

  string method = (On) ? "RECSTART" : "RECSTOP";

  // keep track of active recordings
  if (FileName != NULL) {
    if (On)
      AddActRecording(name, FileName);
    else
      DelActRecording(name, FileName);
  }

  string guid = (FileName == NULL) ? "" : cUrlEncode::doUrlSaveEncode(FileName);

  msg << "{\"type\":\""+method+"\",\"name\":\"" << name << "\",\"guid\":\""+guid+"\"}";

  *(mLog.log()) << mLog.getTimeString()
		<< ": SmartTvServer::Recording: Recording"
		<< ((On) ? " started" : " stopped")
		<< " Msg=  " << msg.str() 
		<< endl;

  
  for (uint i = 0; i < mConTvClients.size(); i ++) {
    if ((mConTvClients[i]->ip).compare("") != 0) {

      int cfd=  connectToClient(mConTvClients[i]->ip, mConTvClients[i]->lastKeepAlive);
      if (cfd < 0) 
	continue;
      addHttpResource(cfd, new cHttpInfoClient(cfd, mHttpClientId, serverPort, this, mConTvClients[i]->ip, msg.str()));
    }
  }
};

  //TODO: Store active recordings in a Database
  // The database should contain only active recordings
  // database for active recordings: entry is FileName (i.e. guid)
  // store only, when FileName is not NULL 

void SmartTvServer::AddActRecording(string n, string fn) {
  mActRecordings.push_back(new cActiveRecording(n, fn));
  *(mLog.log()) << mLog.getTimeString()
		<< " AddActRecording fn= " << fn
		<< " CurListSize= " << mActRecordings.size()
		<< endl;    
}

void SmartTvServer::DelActRecording(string n, string fn) {  
  int del_count =0;
  for (list<cActiveRecording*>::iterator itr = mActRecordings.begin(); itr != mActRecordings.end(); /*nothing*/) {
    if ((*itr)->mFilename == fn) {
        itr = mActRecordings.erase(itr);
	del_count ++;
    }
    else
      ++itr;
  }

  *(mLog.log()) << mLog.getTimeString()
		<< " DelActRecording Deleted " << n
		<< " Occurances= " << del_count
		<< " CurListSize= " << mActRecordings.size()
		<< endl;
}

bool SmartTvServer::IsActRecording(string fn) {
  for (list<cActiveRecording*>::iterator itr = mActRecordings.begin(); itr != mActRecordings.end(); ++itr) {
    if ((*itr)->mFilename == fn) {
      return true;
    }
  }
  return false;
}

//thlo: Try to clean up
void SmartTvServer::pushToClients(cHttpResourceBase* resource) {
  for (uint i = 0; i < mConTvClients.size(); i ++) {
    if ((mConTvClients[i]->ip).compare("") != 0) {
      
      int cfd=  connectToClient(mConTvClients[i]->ip, mConTvClients[i]->lastKeepAlive);
      if (cfd < 0) 
	continue;
      addHttpResource(cfd, resource);
    }
  }
}


void SmartTvServer::TimerChange(const cTimer *Timer, eTimerChange Change) {
 #ifndef DEBUG
  *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::TimerChange" 
		<< endl;
#endif

  stringstream msg;
  string method = "";
  switch (Change) {
  case tcMod:
    method = "TCMOD";
    break;
  case tcAdd:
    method = "TCADD";
    break;
  case tcDel:
    method = "TCDEL";
    break;
  }


  if (Timer == NULL) {
    *(mLog.log()) << mLog.getTimeString() << ": WARNING in SmartTvServer::TimerChange - Timer is NULL. Method= " << method << ", returning" << endl;
    return;
  }

  string name = Timer->File();  
  if (Timer->Event() != NULL) {
    if (Timer->Event()->Title() != NULL)
      name = Timer->Event()->Title();
  }


  msg << "{\"type\":\"" << method << "\",\"name\":\"" << name << "\", \"start\":" << Timer->Start() <<"}";

#ifndef DEBUG
  *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::TimerChange: Msg=  " << msg.str() << endl;
#endif

  for (uint i = 0; i < mConTvClients.size(); i ++) {
    if ((mConTvClients[i]->ip).compare("") != 0) {
      int cfd=  connectToClient(mConTvClients[i]->ip, mConTvClients[i]->lastKeepAlive);
      if (cfd < 0) 
	continue;
      addHttpResource(cfd, new cHttpInfoClient(cfd, mHttpClientId, serverPort, this, mConTvClients[i]->ip, msg.str()));
    }
  } 
}

void SmartTvServer::OsdStatusMessage(const char *Message) {
  *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::OsdStatusMessage: Msg=  " << ((Message != NULL) ? Message : "") << endl;

  if (Message == NULL)
    return;

  string msg = Message;

  for (uint i = 0; i < mConTvClients.size(); i ++) {
    if ((mConTvClients[i]->ip).compare("") != 0) {
      int cfd=  connectToClient(mConTvClients[i]->ip, mConTvClients[i]->lastKeepAlive);
      if (cfd < 0) 
	continue;
      addHttpResource(cfd, new cHttpMesgPushClient(cfd, mHttpClientId, serverPort, this, mConTvClients[i]->ip, msg));
    }
  } 
}

void SmartTvServer::cleanUp() {
  // close listening ports
  
  for (list<cHttpResourceBase*>::iterator iter = clientList.begin(); iter != clientList.end();) {
    close((*iter)->mFd);
    delete *iter;
    iter = clientList.erase(iter);
  }

  // close server port
  close(mServerFd);

  // Leave thread
  pthread_cancel(mThreadId);
  pthread_join(mThreadId, NULL);

  mLog.shutdown();
}


void SmartTvServer::updateTvClient(string ip, string mac, time_t upd) {

  bool found = false;
  for (uint i = 0; i < mConTvClients.size(); i++) {
    if (mConTvClients[i]->mac ==  mac) {
      *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::updateTvClient: Found Entry for Mac= " << mac
		    << endl;
      found = true;
      mConTvClients[i]->ip = ip;
      mConTvClients[i]->lastKeepAlive = upd;
      break;
    }
  }
  if (found == false) {
    *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::updateTvClient: Append Entry for Mac= " << mac
		  << endl;
    sClientEntry * entry = new sClientEntry(mac, ip, upd);
    mConTvClients.push_back(entry);
  }
};

void SmartTvServer::removeTvClient(string ip, string mac, time_t upd) {
  // remove client with mac from list
  bool found = false;
  vector<sClientEntry*>::iterator iter;
  for (iter = mConTvClients.begin() ; iter != mConTvClients.end(); ++iter)
    if ((*iter)->mac == mac) {
      found = true;
      *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::removeTvClient: Found Entry for Mac= " << mac
		    << endl;
      iter = mConTvClients.erase(iter);
      break;
    }
      
  if (!found ) {
    *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::removeTvClient: No entry for Mac= " << mac
		  << " found"
		  << endl;
  }
}

cManageUrls* SmartTvServer::getUrlsObj() { 
  if (mManagedUrls == NULL)
    mManagedUrls = new cManageUrls(mConfigDir);

  return mManagedUrls;
};

void SmartTvServer::storeYtVideoId(string guid) {
  if (mManagedUrls == NULL)
    mManagedUrls = new cManageUrls(mConfigDir);

  mManagedUrls->appendEntry("YT", guid);
}

bool SmartTvServer::deleteYtVideoId(string guid) {
  if (mManagedUrls == NULL)
    mManagedUrls = new cManageUrls(mConfigDir);

  return mManagedUrls->deleteEntry("YT", guid);
}



void SmartTvServer::pushYtVideoId(string vid_id, bool store) {
  //  time_t now =  time(NULL);
  for (uint i = 0; i < mConTvClients.size(); i ++) {
    if ((mConTvClients[i]->ip).compare("") != 0) {
      //      pushYtVideoIdToClient(vid_id, mConTvClients[i]->ip, store);
      int cfd=  connectToClient(mConTvClients[i]->ip, mConTvClients[i]->lastKeepAlive);
      if (cfd < 0)
	return;
      addHttpResource(cfd, new cHttpYtPushClient(cfd, mHttpClientId, serverPort, this, mConTvClients[i]->ip, vid_id, store));
    }
  }
}



int SmartTvServer::connectToClient(string peer, time_t last_update) {
  if ((time(NULL) - last_update) > 60) {
    *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::connectToClient: expired client= " << peer << endl;
    return -1;
  }
  *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::connectToClient: client= " << peer << endl;

  int cfd; 
  struct sockaddr_in server; 
  cfd = socket(AF_INET, SOCK_STREAM, 0); 

  if (cfd <0) { 
    *(mLog.log()) << mLog.getTimeString() << ": Error: Cannot create client socket" << endl;
    return -1; 
  }
  
  memset((char *) &server, 0, sizeof(server));
  server.sin_family = AF_INET; 
  server.sin_port = htons(80);
  server.sin_addr.s_addr =inet_addr(peer.c_str());

  setNonBlocking(cfd);

  if (connect(cfd, (const struct sockaddr *) &server, sizeof(struct sockaddr_in)) <0) { 
    if (errno != EINPROGRESS) {
      *(mLog.log()) << mLog.getTimeString() << ": Error while connecting" << endl; 
      return -1; 
    }
    else
      *(mLog.log()) << mLog.getTimeString() << ": Connecting" << endl; 
  }
  return cfd;
}


void SmartTvServer::addHttpResource(int rfd, cHttpResourceBase* resource) {

  FD_SET(rfd, &mReadState);       
  FD_SET(rfd, &mWriteState);      
  clientList.push_back(resource);
  
  mHttpClientId++;
  if (rfd > mMaxFd) {
    mMaxFd = rfd;
  }    
  mActiveSessions ++;
}

void SmartTvServer::pushCfgServerAddressToTv( string tv_addr) {
  *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::pushCfgServerAddressToTv TV= " << tv_addr 
		<< endl;
  
  int cfd=  connectToClient(tv_addr, time(NULL));
  if (cfd < 0)
    return;
  addHttpResource(cfd, new cHttpCfgPushClient(cfd, mHttpClientId, serverPort, this, tv_addr));
}

int SmartTvServer::runAsThread() {
  int res = pthread_create(&mThreadId, NULL, (void*(*)(void*))SmartTvServerStartThread, (void *)this);
  if (res != 0) {
    *(mLog.log()) << mLog.getTimeString() << ": Error creating thread. res= " << res 
		  << endl;
    return 0;
  } 
  return 1;
}

void SmartTvServer::threadLoop() {
  *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer Thread Started " << endl;

  loop();

  *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer Thread Stopped "  << endl;
}

//---------------------------------------------------
void SmartTvServer::setNonBlocking(int fd) {
  int oldflags = fcntl(fd, F_GETFL, 0);
  oldflags |= O_NONBLOCK;
  fcntl(fd, F_SETFL, oldflags);
}

void SmartTvServer::clrWriteFlag(int fd) {
  FD_CLR(fd, &mWriteState);
}

void SmartTvServer::setWriteFlag(int fd) {
  FD_SET(fd, &mWriteState);      
}

int SmartTvServer::openPipe() {
  int pipefd[2];

  //  if (pipe2(pipefd, O_NONBLOCK) == -1) {
  if (pipe(pipefd) == -1) {
    return 0;
  }
  setNonBlocking(pipefd[0]);
  setNonBlocking(pipefd[1]);

  *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::openPipe pipefd[0]= " << pipefd[0] 
		<< " pipefd[1]= " << pipefd[1] << endl;

  addHttpResource(pipefd[0], new cHttpResourcePipe(pipefd[0], this));
  return pipefd[1];
}

list<cHttpResourceBase*>::iterator SmartTvServer::closeHttpResource(list<cHttpResourceBase*>::iterator to_close) {
  int req_id = (*to_close)->mReqId;
  int rfd = (*to_close)->mFd;
  

  close((*to_close)->mFd);
  delete *to_close;
  list<cHttpResourceBase*>::iterator iter = clientList.erase(to_close);
  mActiveSessions--;
  *(mLog.log()) << mLog.getTimeString() << ": - Closing Session mReqId= " << req_id << endl;
  logActiveSessionIds();

  FD_CLR(rfd, &mReadState);     
  FD_CLR(rfd, &mWriteState);
  return iter;
}


void SmartTvServer::logActiveSessionIds() {
  *(mLog.log()) << mLog.getTimeString() << ": mActiveSessions= " << mActiveSessions 
		<< " size= " << clientList.size() << " ReqIds= [ ";

  for (list<cHttpResourceBase*>::iterator iter = clientList.begin(); iter != clientList.end(); ++iter) {
    *(mLog.log()) << (*iter)->mReqId << " ";
  }
  *(mLog.log()) << "]" << endl;
}

void SmartTvServer::acceptHttpResource(int &req_id) {
  int rfd = 0;
  sockaddr_in sadr;
  char ipstr[INET6_ADDRSTRLEN + 1];
  socklen_t addr_size = sizeof(sadr);

  string ip_ver = "ipv6";

  if((rfd = accept(mServerFd, (sockaddr*)&sadr, &addr_size))!= -1){
    req_id ++;

    switch (sadr.sin_family) {
    case AF_INET:
      ip_ver = "ip_v4";
      inet_ntop(AF_INET, &(sadr.sin_addr), ipstr, sizeof ipstr);      
      break;
    case AF_INET6:
      inet_ntop(AF_INET6, &(sadr.sin_addr), ipstr, sizeof ipstr);      
      break;
    default:
      ip_ver = "Unknown";
      break;
    }

    
#ifndef DEBUG
    *(mLog.log()) << mLog.getTimeString() << ": fd= " << rfd
		  << " --------------------- Received connection ---------------------" << endl;
#endif

    FD_SET(rfd, &mReadState);       
    //FD_SET(rfd, &mWriteState);      
    
    if (rfd > mMaxFd) {
      mMaxFd = rfd;
    }
    
    clientList.push_back(new cHttpResource(rfd, req_id, serverPort, ipstr, this));
    mActiveSessions ++;
    *(mLog.log()) << mLog.getTimeString() << ": + New Session mReqId= " << req_id 
		  << " ver= " << ip_ver << " " << sadr.sin_family
		  << " IP= " << ipstr
		  << endl;
    logActiveSessionIds();
  }
  else{
    *(mLog.log()) << mLog.getTimeString() << ": Error accepting " <<  errno << endl;
  }    
  
}


cRecFolder* SmartTvServer::GetRecDb() {
  bool changed = Recordings.StateChanged(mRecState);
  *(mLog.log()) << mLog.getTimeString()
		<< " GetRecDb Changed= " << ((changed) ? "Yes" : "No")
		<< endl;
  if (changed) {
    
    delete mRecordings;
    mRecordings = new cRecFolder(".", "", 0, &mLog);
    CreateRecDb();
  }  
  return mRecordings;
}

void SmartTvServer::CreateRecDb() {
  cRecording *recording = Recordings.First();
  *(mLog.log()) << mLog.getTimeString() << ": CreateRecDb "
		<< " NewState= " << mRecState
		<< endl;
  
  while (recording != NULL) {
    string name = recording->Name();

    //    (mRecordings->mEntries).push_back(new cRecEntry(recording->Name(), recording->HierarchyLevels()));
    cRecEntry* entry = new cRecEntry(recording->Name(), recording->HierarchyLevels(), &mLog, recording);
    mRecordings->appendEntry(entry);
    //    (mRecordings->mEntries).appendEntry(entry, 0);

    /*
    *(mLog.log()) << mLog.getTimeString() 
		  << " L= " << recording->HierarchyLevels()
      		  << " FName= " << recording->Name() 
		  << endl;
*/    
    recording = Recordings.Next(recording);
  }


  *(mLog.log()) << " Summary " << endl;
  mRecordings->print("");
  
  
  *(mLog.log()) << " Summary -done " << endl;

}

void SmartTvServer::loop() {
  int req_id = 0;
  int ret = 0;
  struct timeval timeout;

  fd_set read_set;
  fd_set write_set;

  FD_ZERO(&read_set);
  FD_ZERO(&write_set);

  FD_ZERO(&mReadState);
  FD_ZERO(&mWriteState);

  FD_SET(mServerFd, &mReadState);
  mMaxFd = mServerFd;

  *(mLog.log()) << mLog.getTimeString() << ": mServerFd= " << mServerFd << endl;

  int handeled_fds = 0;

  for (;;) {                    
    FD_ZERO(&read_set);
    FD_ZERO(&write_set);
    read_set = mReadState;
    write_set = mWriteState;

    if (ret != handeled_fds) {
      // Only ok, when the server has closed a handing HTTP connection
      *(mLog.log()) << mLog.getTimeString() << ": WARNING: Select-ret= " << ret 
		    << " != handeled_fds= " << handeled_fds << endl;
    }

    handeled_fds = 0;
    timeout.tv_sec = 5;
    timeout.tv_usec = 0;

    ret = select(mMaxFd + 1, &read_set, &write_set, NULL, &timeout);
    
    if (ret == 0) {
      // timeout: Check for dead TCP connections
      for (list<cHttpResourceBase*>::iterator iter = clientList.begin(); iter != clientList.end();) {
	if ((*iter)->checkStatus() == ERROR) {
	    *(mLog.log()) << mLog.getTimeString() << ": WARNING: Timeout - Dead Client fd=" <<  (*iter)->mFd  
			  << " mReqId= " << (*iter)->mReqId << endl;
	    iter = closeHttpResource(iter);
	}
	else
	  ++iter;
      }
      continue;
    } // timeout

    if (ret < 0){
      *(mLog.log()) << mLog.getTimeString() << ": ERROR: select error errno= " <<  errno << endl;
      continue;
    } // Error

    // new accept
    if (FD_ISSET(mServerFd, &read_set)) {
      handeled_fds ++;
      acceptHttpResource(req_id);
    }

    // Check for data on already accepted connections
    for (list<cHttpResourceBase*>::iterator iter = clientList.begin(); iter != clientList.end(); ) {
      if (FD_ISSET((*iter)->mFd, &read_set)) {
	handeled_fds ++;
	int n = 0;
	ioctl((*iter)->mFd, FIONREAD, &n);
	if ( n == 0) {
	  // Nothing to read, so client has killed the connection
	  *(mLog.log()) << mLog.getTimeString() << ": fd= " << (*iter)->mFd << " mReqId= " << (*iter)->mReqId
			<< " ------ Check Read: Closing (n=0)-------" 
			<< endl;
	  
	  iter = closeHttpResource(iter);
	  continue;
	}
	if ( (*iter)->handleRead() < 0){
	  //#ifndef DEBUG
	  *(mLog.log()) << mLog.getTimeString() << ": fd= " << (*iter)->mFd 
			<< " mReqId= " << (*iter)->mReqId 
			<< " --------------------- Check Read: Closing ---------------------" 
			<< endl;
	  //#endif
	  iter = closeHttpResource(iter);
	  continue;
	}

      } // if (FD_ISSET)
      ++iter;
    }

    // Check for write
    for (list<cHttpResourceBase*>::iterator iter = clientList.begin(); iter != clientList.end();) {
      if (FD_ISSET((*iter)->mFd, &write_set)) {
	handeled_fds++;
	// HandleWrite
	if ( (*iter)->handleWrite() < 0){
	  //#ifndef DEBUG
	  *(mLog.log()) << mLog.getTimeString() << ": fd= " << (*iter)->mFd 
			<< " mReqId= " << (*iter)->mReqId 
			<< " --------------------- Check Write: Closing ---------------------" << endl;
	  //#endif
	  iter = closeHttpResource(iter);
	  continue;
	}	
      } // if (FD_ISSET)
      ++iter;
    }

  } // for (;;) 
} // org bracket

int SmartTvServer::isServing() {
  *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::isServing: mActiveSessions= " << mActiveSessions << endl;
  time_t now = time(NULL);
  bool connected_tv = false;
  for (uint i = 0; i < mConTvClients.size(); i++) {
    if ( (now - mConTvClients[i]->lastKeepAlive) < 60) {
      *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::isServing: Found a connected TV: mac= " << mConTvClients[i]->mac 
		    << " ip=" << mConTvClients[i]->ip  << endl;
      connected_tv = true;
      break;
    } 
  }
  return (mActiveSessions != 0 ? true : false) or connected_tv;
}

int SmartTvServer::getActiveHttpSessions() {
  return mActiveSessions;
}

string SmartTvServer::processNestedItemList(string pref, cList<cNestedItem> *cmd, vector<cCmd*> *cmd_list) {
  char f[400];
  string msg ="";

  for (cNestedItem *c = cmd->First(); c; c = cmd->Next(c)) {
    if (c->SubItems()) {
      cCmd *itm = new cCmd(c->Text());
      msg += processNestedItemList( pref+itm->mTitle+"~", c->SubItems(), cmd_list);
      delete itm;
    }
    else {
      cCmd *itm = new cCmd(c->Text());

      cmd_list->push_back(itm);
      snprintf(f, sizeof(f), "<item cmd=\"%d\" confirm=\"%s\">%s</item>\n", cmd_list->size()-1, ((itm->mConfirm)?"true":"false"), 
	       (pref + itm->mTitle).c_str());
      msg += f;
    }
  }

  return msg;
}

void SmartTvServer::initRecCmds() {
  mRecMsg = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  mRecMsg += "<reccmds>\n";
  mRecMsg += processNestedItemList("", &RecordingCommands, &mRecCmds);
  mRecMsg += "</reccmds>\n";

  *(mLog.log()) << mLog.getTimeString() << ": reccmds.conf parsed" << endl;
}

void SmartTvServer::initCmdCmds() {
  mCmdMsg = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  mCmdMsg += "<cmdcmds>\n";
  mCmdMsg += processNestedItemList("", &Commands, &mCmdCmds);
  mCmdMsg += "</cmdcmds>\n";

  *(mLog.log()) << mLog.getTimeString() << ": commands.conf parsed" << endl;
}


void SmartTvServer::initServer(string dir, cSmartTvConfig* cfg) {
  /* This function initialtes the listening socket for the server
   * and sets isInited to true
   */
  esyslog("SmartTvWeb: initServer dir= %s", dir.c_str());
  mConfigDir = dir;
  int ret;
  struct sockaddr_in sock;
  int yes = 1;

#ifndef STANDALONE
  //  mConfig = new cSmartTvConfig(dir); 
  mConfig = cfg;
  mConfig->Initialize(dir);
  serverPort = mConfig->getServerPort();
  mLog.init(mConfig->getLogFile());

  *(mLog.log()) << mLog.getTimeString() << ": LogFile= " << mConfig->getLogFile() << endl;

  initRecCmds();
  initCmdCmds();
 
#else
  mConfig = new cSmartTvConfig("."); 
  mLog.init(mConfig->getLogFile());
  esyslog ("SmartTvWeb: Logfile created");
  esyslog ("SmartTvWeb: Listening on port= %d", PORT);

#endif

  mRecordings = new cRecFolder(".", "", 0, &mLog);

  mConfig->printConfig();

  mSegmentDuration= mConfig->getSegmentDuration();
  mHasMinBufferTime= mConfig->getHasMinBufferTime();
  mLiveChannels = mConfig->getLiveChannels();

  *(mLog.log()) << mLog.getTimeString() <<": HTTP server listening on port " <<  serverPort << endl;

  mServerFd = socket(PF_INET, SOCK_STREAM, 0);
  if (mServerFd <0) {
    *(mLog.log()) << mLog.getTimeString() << ": Error: Cannot create serving socket, exit" << endl;
    exit(1); 
  }

  ret = setsockopt(mServerFd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(int));
  if (ret <0) {
    *(mLog.log()) << mLog.getTimeString() << ": Error: Cannot set sockopts on serving socket, exit" << endl;
    exit(1); 
  }

  memset((char *) &sock, 0, sizeof(sock));
  sock.sin_family = AF_INET;

  if (mConfig->getServerAddress() == "")
    sock.sin_addr.s_addr = htonl(INADDR_ANY);
  else {
    *(mLog.log()) << mLog.getTimeString() << ": Binding Server to " << mConfig->getServerAddress() << endl;
    sock.sin_addr.s_addr = inet_addr(mConfig->getServerAddress().c_str());
  }
  sock.sin_port = htons(serverPort);

  ret = bind(mServerFd, (struct sockaddr *) &sock, sizeof(sock));
  if (ret !=0) {
    *(mLog.log()) << mLog.getTimeString() << ": Error: Cannot bind serving socket, exit" << endl;
    exit(1); 
  }
  
  /*
  struct ifreq ifr;

  ifr.ifr_addr.sa_family = AF_INET;
  strncpy(ifr.ifr_name, "eth0", IFNAMSIZ-1);
  ioctl(mServerFd, SIOCGIFADDR, &ifr);
  string own_ip = inet_ntoa(((struct sockaddr_in *)&ifr.ifr_addr)->sin_addr);
  *(mLog.log()) << " own if ip= " << own_ip << endl; 
*/

  ret = listen(mServerFd, 5);
  if (ret <0) {
    *(mLog.log()) << mLog.getTimeString() << ": Error: Cannot set listening on serving socket, exit" << endl;
    exit(1); 
  }

  isInited = true;
}


