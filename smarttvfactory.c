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





SmartTvServer::SmartTvServer(): cStatus(), mRequestCount(0), isInited(false), serverPort(PORT), mServerFd(-1),
  mSegmentDuration(10), mHasMinBufferTime(40),  mLiveChannels(20), 
  clientList(), mConTvClients(), mRecCmds(), mCmdCmds(), mRecMsg(), mCmdMsg(), mActiveSessions(0), mHttpClientId(0), 
  mConfig(NULL), mMaxFd(0),
  mManagedUrls(NULL) {
}


SmartTvServer::~SmartTvServer() {

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
    cRecording* rec = Recordings.GetByName(FileName);
    if (rec == NULL) {
      *(mLog.log()) << mLog.getTimeString() << ": WARNING in SmartTvServer::Recording: No Recording Entry found. Return.  " << endl;
      return;
    }
    name = rec->Name();
  }
  else 
    name = Name;

  string method = (On) ? "RECSTART" : "RECSTOP";
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
  for (uint idx= 0; idx < clientList.size(); idx++) {
    if (clientList[idx] != NULL) {
      close(idx);
      delete clientList[idx];
      clientList[idx] = NULL;
    }
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

  if (clientList.size() < (rfd+1)) {
    clientList.resize(rfd+1, NULL); // Check.
  }
  if (clientList[rfd] == NULL) {
    FD_SET(rfd, &mReadState);       
    FD_SET(rfd, &mWriteState);      
    clientList[rfd] = resource;

    mHttpClientId++;
    if (rfd > mMaxFd) {
      mMaxFd = rfd;
    }    
    mActiveSessions ++;
  }
  else {
    *(mLog.log()) << mLog.getTimeString() << ": Error: clientList idx in use" << endl; 
    // ERROR: 
  }
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

  if (pipe2(pipefd, O_NONBLOCK) == -1) {
    return 0;
  }
  *(mLog.log()) << mLog.getTimeString() << ": SmartTvServer::openPipe pipefd[0]= " << pipefd[0] 
		<< " pipefd[1]= " << pipefd[1] << endl;

  addHttpResource(pipefd[0], new cHttpResourcePipe(pipefd[0], this));
  return pipefd[1];
}


void SmartTvServer::closeHttpResource(int rfd) {
  close(rfd);
  int req_id = clientList[rfd]->mReqId;
  delete clientList[rfd];
  clientList[rfd] = NULL;
  mActiveSessions--;
  *(mLog.log()) << mLog.getTimeString() << ": - Closing Session mReqId= " << req_id << endl;
  logActiveSessionIds();
  FD_CLR(rfd, &mReadState);      /* dead client */
  FD_CLR(rfd, &mWriteState);

}

void SmartTvServer::logActiveSessionIds() {
  *(mLog.log()) << mLog.getTimeString() << ": mActiveSessions= " << mActiveSessions << " Ids= [ ";
  for (uint idx= 0; idx < clientList.size(); idx++) {
    if (clientList[idx] != NULL) {
      *(mLog.log()) << clientList[idx]->mReqId << " ";
    }
  }
  *(mLog.log()) << "]" << endl;
}

void SmartTvServer::acceptHttpResource(int &req_id) {
  int rfd = 0;
  sockaddr_in sadr;
  socklen_t addr_size = 0;

  if((rfd = accept(mServerFd, (sockaddr*)&sadr, &addr_size))!= -1){
    req_id ++;
    
#ifndef DEBUG
    *(mLog.log()) << mLog.getTimeString() << ": fd= " << rfd
		  << " --------------------- Received connection ---------------------" << endl;
#endif

    FD_SET(rfd, &mReadState);       
    FD_SET(rfd, &mWriteState);      
    
    if (rfd > mMaxFd) {
      mMaxFd = rfd;
    }
    
    if (clientList.size() < (rfd+1)) {
      clientList.resize(rfd+1, NULL); // Check.
    }
    clientList[rfd] = new cHttpResource(rfd, req_id, serverPort, this);
    mActiveSessions ++;
    //    *(mLog.log()) << mLog.getTimeString() << ": + mActiveSessions= " << mActiveSessions << endl;
    *(mLog.log()) << mLog.getTimeString() << ": + New Session mReqId= " << req_id << endl;
    logActiveSessionIds();
  }
  else{
    *(mLog.log()) << mLog.getTimeString() << ": Error accepting " <<  errno << endl;
  }    
  
}

void SmartTvServer::loop() {
  unsigned int rfd;
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
      for (uint idx= 0; idx < clientList.size(); idx++) {
	if (clientList[idx] != NULL)
	  if (clientList[idx]->checkStatus() == ERROR) {
	    *(mLog.log()) << mLog.getTimeString() << ": WARNING: Timeout - Dead Client fd=" <<  idx  
			  << " mReqId= " << clientList[idx]->mReqId << endl;
	    closeHttpResource(idx);
	  }
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
    for (rfd = 0; rfd < clientList.size(); rfd++) {
      if (clientList[rfd] == NULL)
	continue;
      if (FD_ISSET(rfd, &read_set)) {
	handeled_fds ++;
	// HandleRead
	if (clientList[rfd] == NULL) {
	  *(mLog.log()) << mLog.getTimeString() << ": ERROR in Check Read: oops - no cHttpResource anymore fd= " << rfd << endl;
	  close(rfd);
          FD_CLR(rfd, &mReadState);      /* remove dead client */
	  FD_CLR(rfd, &mWriteState);
	  continue;
	}

	int n = 0;
	ioctl(rfd, FIONREAD, &n);
	if ( n == 0) {
	  //	  int req_id = clientList[rfd]->mReqId;
	  closeHttpResource(rfd);
	  /*	  *(mLog.log()) << mLog.getTimeString() << ": fd= " << rfd << " mReqId= " << req_id
			<< " ------ Check Read: Closing (n=0)-------" 
			<< endl;
	  */
	  continue;
	}
	if ( clientList[rfd]->handleRead() < 0){
#ifndef DEBUG
	  *(mLog.log()) << mLog.getTimeString() << ": fd= " << rfd 
			<< " mReqId= " << clientList[rfd]->mReqId 
			<< " --------------------- Check Read: Closing ---------------------" 
			<< endl;
#endif
	  closeHttpResource(rfd);
	}
      }
    }

    // Check for write
    for (rfd = 0; rfd < clientList.size(); rfd++) {
      if (clientList[rfd] == NULL)
	continue;
      if (FD_ISSET(rfd, &write_set)) {
	handeled_fds++;
	// HandleWrite
	if (clientList[rfd] == NULL) {
	  close(rfd);
          FD_CLR(rfd, &mReadState);     
	  FD_CLR(rfd, &mWriteState);
	  continue;
	}
	if ( clientList[rfd]->handleWrite() < 0){
#ifndef DEBUG
	  *(mLog.log()) << mLog.getTimeString() << ": fd= " << rfd 
			<< " mReqId= " << clientList[rfd]->mReqId 
			<< " --------------------- Check Write: Closing ---------------------" << endl;
#endif
	  closeHttpResource(rfd);
	}
      }
    }

    // selfcheck
    /*    *(mLog.log()) << "Select Summary: ret= " << ret
      		  << " handeled_fds=" << handeled_fds 
		  << " mActiveSessions= " << mActiveSessions
		  << " clientList.size()= " << clientList.size() 
		  << endl;
*/
    //Check for active sessions
    /*
    *(mLog.log()) << "checking number of active sessions clientList.size()= " << clientList.size() << endl;

    int act_ses = 0;
    for (uint idx= 0; idx < clientList.size(); idx++) {
      if (clientList[idx] != NULL)
	act_ses++;
    } 
    if (act_ses != mActiveSessions) {
      *(mLog.log()) << "ERROR: Lost somewhere a session: "
		    << "mActiveSessions= " << mActiveSessions
		    << "act_ses= " << act_ses
		    << endl;
      mActiveSessions = act_ses;
    }
    *(mLog.log()) << "checking number of active sessions - done mActiveSessions= " << mActiveSessions << endl;
*/
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


void SmartTvServer::initServer(string dir) {
  /* This function initialtes the listening socket for the server
   * and sets isInited to true
   */
  mConfigDir = dir;
  int ret;
  struct sockaddr_in sock;
  int yes = 1;

#ifndef STANDALONE
  mConfig = new cSmartTvConfig(dir); 
  serverPort = mConfig->getServerPort();
  mLog.init(mConfig->getLogFile());

  if (mConfig->getLogFile() != "") {
    string msg = "SmartTvWeb: Logfile created File= " + mConfig->getLogFile();
    esyslog("%s", msg.c_str());
  }
  *(mLog.log()) << mLog.getTimeString() << ": LogFile= " << mConfig->getLogFile() << endl;

  initRecCmds();
  initCmdCmds();
 
#else
  mConfig = new cSmartTvConfig("."); 
  mLog.init(mConfig->getLogFile());
  cout << "SmartTvWeb: Logfile created" << endl;
  cout << "SmartTvWeb: Listening on port= " << PORT << endl;

#endif
  
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


