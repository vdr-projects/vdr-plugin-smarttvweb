/*
 * smarttvfactory.h: VDR on Smart TV plugin
 *
 * Copyright (C) 2012 T. Lohmar
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

SmartTvServer::SmartTvServer(): cStatus(), mRequestCount(0), isInited(false), serverPort(PORT), mServerFd(-1),
  mSegmentDuration(10), mHasMinBufferTime(40),  mLiveChannels(20), 
  clientList(), mConTvClients(), mActiveSessions(0), mHttpClientId(0), mConfig(NULL), mMaxFd(0),
  mManagedUrls(NULL){
}


SmartTvServer::~SmartTvServer() {

  if (mConfig != NULL)
    delete mConfig;
}

// Status methods
void SmartTvServer::Recording(const cDevice *Device, const char *Name, const char *FileName, bool On) {
#ifndef DEBUG
  *(mLog.log()) << "SmartTvServer::Recording: Recording"  
		<< ((On) ? " started" : " stopped")
		<< endl;
#endif
  stringstream msg;  
  string name ;
  
  if (Name == NULL) {
    if (FileName == NULL) {
      *(mLog.log()) << "WARNING in SmartTvServer::Recording: Name and FileName are NULL. Return.  " << endl;
      return;
    }
    cRecording* rec = Recordings.GetByName(FileName);
    if (rec == NULL) {
      *(mLog.log()) << "WARNING in SmartTvServer::Recording: No Recording Entry found. Return.  " << endl;
      return;
    }
    name = rec->Name();
  }
  else 
    name = Name;

  string method = (On) ? "RECSTART" : "RECSTOP";
  string guid = (FileName == NULL) ? "" : cUrlEncode::doUrlSaveEncode(FileName);

  msg << "{\"type\":\""+method+"\",\"name\":\"" << name << "\",\"guid\":\""+guid+"\"}";

  *(mLog.log()) << "SmartTvServer::Recording: Recording"
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
  *(mLog.log()) << "SmartTvServer::TimerChange" 
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
    *(mLog.log()) << "WARNING in SmartTvServer::TimerChange - Timer is NULL. Method= " << method << ", returning" << endl;
    return;
  }

  string name = Timer->File();  
  if (Timer->Event() != NULL) {
    if (Timer->Event()->Title() != NULL)
      name = Timer->Event()->Title();
  }


  msg << "{\"type\":\"" << method << "\",\"name\":\"" << name << "\", \"start\":" << Timer->Start() <<"}";

#ifndef DEBUG
  *(mLog.log()) << "SmartTvServer::TimerChange: Msg=  " << msg.str() << endl;
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
  *(mLog.log()) << "SmartTvServer::OsdStatusMessage: Msg=  " << ((Message != NULL) ? Message : "") << endl;

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

void SmartTvServer::setNonBlocking(int fd) {
  int oldflags = fcntl(fd, F_GETFL, 0);
  oldflags |= O_NONBLOCK;
  fcntl(fd, F_SETFL, oldflags);
}

void SmartTvServer::updateTvClient(string ip, string mac, time_t upd) {

  bool found = false;
  for (uint i = 0; i < mConTvClients.size(); i++) {
    if (mConTvClients[i]->mac ==  mac) {
      *(mLog.log()) << "SmartTvServer::updateTvClient: Found Entry for Mac= " << mac
		    << endl;
      found = true;
      mConTvClients[i]->ip = ip;
      mConTvClients[i]->lastKeepAlive = upd;
      break;
    }
  }
  if (found == false) {
      *(mLog.log()) << "SmartTvServer::updateTvClient: Append Entry for Mac= " << mac
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
      *(mLog.log()) << "SmartTvServer::removeTvClient: Found Entry for Mac= " << mac
		    << endl;
      iter = mConTvClients.erase(iter);
      break;
    }
      
  if (!found ) {
    *(mLog.log()) << "SmartTvServer::removeTvClient: No entry for Mac= " << mac
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
  time_t now =  time(NULL);
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
    *(mLog.log()) << " SmartTvServer::connectToClient: expired client= " << peer << endl;
    return -1;
  }
  *(mLog.log()) << " SmartTvServer::connectToClient: client= " << peer << endl;

  int cfd; 
  struct sockaddr_in server; 
  cfd = socket(AF_INET, SOCK_STREAM, 0); 

  if (cfd <0) { 
    *(mLog.log()) << "Error: Cannot create client socket" << endl;
    return -1; 
  }
  
  memset((char *) &server, 0, sizeof(server));
  server.sin_family = AF_INET; 
  server.sin_port = htons(80);
  server.sin_addr.s_addr =inet_addr(peer.c_str());

  setNonBlocking(cfd);

  if (connect(cfd, (const struct sockaddr *) &server, sizeof(struct sockaddr_in)) <0) { 
    if (errno != EINPROGRESS) {
      *(mLog.log()) << "Error while connecting" << endl; 
      return -1; 
    }
    else
      *(mLog.log()) << "Connecting" << endl; 
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
    *(mLog.log()) << "Error: clientList idx in use" << endl; 
    // ERROR: 
  }
}

/* // obsolete
void SmartTvServer::pushYtVideoIdToClient(string vid_id, string peer, bool store) {
  *(mLog.log()) << " SmartTvServer::pushYtVideoIdToClient vid_id= " << vid_id 
		<< " client= " << peer << endl;
  
  int cfd=  connectToClient(peer);
  if (cfd < 0)
    return;
  addHttpResource(cfd, new cHttpYtPushClient(cfd, mHttpClientId, serverPort, this, peer, vid_id, store));

}
*/
void SmartTvServer::pushCfgServerAddressToTv( string tv_addr) {
  *(mLog.log()) << " SmartTvServer::pushCfgServerAddressToTv TV= " << tv_addr 
		<< endl;
  
  int cfd=  connectToClient(tv_addr, time(NULL));
  if (cfd < 0)
    return;
  addHttpResource(cfd, new cHttpCfgPushClient(cfd, mHttpClientId, serverPort, this, tv_addr));
}

int SmartTvServer::runAsThread() {
  int res = pthread_create(&mThreadId, NULL, (void*(*)(void*))SmartTvServerStartThread, (void *)this);
  if (res != 0) {
    *(mLog.log()) << " Error creating thread. res= " << res 
		  << endl;
    return 0;
  } 
  return 1;
}

void SmartTvServer::threadLoop() {
  *(mLog.log()) << " SmartTvServer Thread Started " << endl;

  loop();

  *(mLog.log()) << " SmartTvServer Thread Stopped "  << endl;
}


void SmartTvServer::loop() {
  socklen_t addr_size = 0;
  unsigned int rfd;
  sockaddr_in sadr;
  int req_id = 0;
  int ret = 0;
  struct timeval timeout;

  //  int maxfd;

  fd_set read_set;
  fd_set write_set;

  FD_ZERO(&read_set);
  FD_ZERO(&write_set);

  FD_ZERO(&mReadState);
  FD_ZERO(&mWriteState);

  FD_SET(mServerFd, &mReadState);
  mMaxFd = mServerFd;

  *(mLog.log()) << "mServerFd= " << mServerFd << endl;

  int handeled_fds = 0;

  for (;;) {                    
    FD_ZERO(&read_set);
    FD_ZERO(&write_set);
    read_set = mReadState;
    write_set = mWriteState;

    if (ret != handeled_fds) {
      // Only ok, when the server has closed a handing HTTP connection
      *(mLog.log()) << "WARNING: Select-ret= " << ret 
		    << " != handeled_fds= " << handeled_fds << endl;
      /*      FD_ZERO(&mReadState);
      FD_ZERO(&mWriteState);
      FD_SET(mServerFd, &mReadState);
      maxfd = mServerFd;

      read_set = mReadState;
      write_set = mWriteState;
      for (uint idx= 0; idx < clientList.size(); idx++) {
	if (clientList[idx] != NULL) {
	  close(idx);
	  delete clientList[idx];
	  clientList[idx] = NULL;
	}
      }
      mActiveSessions = 0;
*/
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
	    close(idx);
	    delete clientList[idx];
	    clientList[idx] = NULL;
	    mActiveSessions--;
	    FD_CLR(idx, &mReadState);      /* dead client */
	    FD_CLR(idx, &mWriteState);
	    *(mLog.log()) << "WARNING: Timeout - Dead Client fd=" <<  idx  << endl;
	  }
      } 
      continue;
    } // timeout

    if (ret < 0){
      *(mLog.log()) << "ERROR: select error errno= " <<  errno << endl;
      continue;
    } // Error

    // new accept
    if (FD_ISSET(mServerFd, &read_set)) {
      handeled_fds ++;
      if((rfd = accept(mServerFd, (sockaddr*)&sadr, &addr_size))!= -1){
	req_id ++;

#ifndef DEBUG
	*(mLog.log()) << "fd= " << rfd
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
	*(mLog.log()) << " + mActiveSessions= " << mActiveSessions << endl;
      }
      else{
	*(mLog.log()) << "Error accepting " <<  errno << endl;
      }    
    }

    // Check for data on already accepted connections
    for (rfd = 0; rfd < clientList.size(); rfd++) {
      if (clientList[rfd] == NULL)
	continue;
      if (FD_ISSET(rfd, &read_set)) {
	handeled_fds ++;
	// HandleRead
	if (clientList[rfd] == NULL) {
	  *(mLog.log()) << "ERROR in Check Read: oops - no cHttpResource anymore fd= " << rfd << endl;
	  close(rfd);
          FD_CLR(rfd, &mReadState);      /* remove dead client */
	  FD_CLR(rfd, &mWriteState);
	  continue;
	}
	if ( clientList[rfd]->handleRead() < 0){
#ifndef DEBUG
	  *(mLog.log()) << "fd= " << rfd << " --------------------- Check Read: Closing ---------------------" << endl;
#endif
	  close(rfd);
	  delete clientList[rfd];
	  clientList[rfd] = NULL;
	  mActiveSessions--;
	  *(mLog.log()) << " - Check Read: mActiveSessions= " << mActiveSessions << endl;
          FD_CLR(rfd, &mReadState);      /* dead client */
	  FD_CLR(rfd, &mWriteState);
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
	  *(mLog.log()) << "fd= " << rfd << " --------------------- Check Write: Closing ---------------------" << endl;
#endif
	  close(rfd);
	  delete clientList[rfd];
	  clientList[rfd] = NULL;
	  mActiveSessions--;
	  *(mLog.log()) << " - Check Write: mActiveSessions= " << mActiveSessions << endl;
          FD_CLR(rfd, &mReadState);     
	  FD_CLR(rfd, &mWriteState);
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
  *(mLog.log()) << "SmartTvServer::isServing: mActiveSessions= " << mActiveSessions << endl;
  time_t now = time(NULL);
  bool connected_tv = false;
  for (uint i = 0; i < mConTvClients.size(); i++) {
    if ( (now - mConTvClients[i]->lastKeepAlive) < 60) {
      *(mLog.log()) << "SmartTvServer::isServing: Found a connected TV: mac= " << mConTvClients[i]->mac << " ip=" << mConTvClients[i]->ip  << endl;
      connected_tv = true;
      break;
    } 
  }
  return (mActiveSessions != 0 ? true : false) or connected_tv;
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
  mLog.init(mConfig->getLogFile());
  esyslog("SmartTvWeb: Logfile created");
  
  *(mLog.log()) << mConfig->getLogFile() << endl;

#else
  mConfig = new cSmartTvConfig("."); 
  mLog.init(mConfig->getLogFile());
  cout << "SmartTvWeb: Logfile created" << endl;
  cout << "SmartTvWeb: Listening on port= " << PORT << endl;

#endif
  
  //  mConfig->printConfig();

  mSegmentDuration= mConfig->getSegmentDuration();
  mHasMinBufferTime= mConfig->getHasMinBufferTime();
  mLiveChannels = mConfig->getLiveChannels();

  *(mLog.log()) <<"HTTP server listening on port " <<  serverPort << endl;

  mServerFd = socket(PF_INET, SOCK_STREAM, 0);
  if (mServerFd <0) {
    *(mLog.log()) << "Error: Cannot create serving socket, exit" << endl;
    exit(1); 
  }

  ret = setsockopt(mServerFd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(int));
  if (ret <0) {
    *(mLog.log()) << "Error: Cannot set sockopts on serving socket, exit" << endl;
    exit(1); 
  }

  memset((char *) &sock, 0, sizeof(sock));
  sock.sin_family = AF_INET;

  if (mConfig->getServerAddress() == "")
    sock.sin_addr.s_addr = htonl(INADDR_ANY);
  else {
    *(mLog.log()) << "Binding Server to " << mConfig->getServerAddress() << endl;
    sock.sin_addr.s_addr = inet_addr(mConfig->getServerAddress().c_str());
  }
  sock.sin_port = htons(serverPort);

  ret = bind(mServerFd, (struct sockaddr *) &sock, sizeof(sock));
  if (ret !=0) {
    *(mLog.log()) << "Error: Cannot bind serving socket, exit" << endl;
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
    *(mLog.log()) << "Error: Cannot set listening on serving socket, exit" << endl;
    exit(1); 
  }

  isInited = true;
}




