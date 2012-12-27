/*
 * smarttvfactory.h: VDR on Smart TV plugin
 *
 * Copyright (C) 2012 Thorsten Lohmar
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


#include "smarttvfactory.h"

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

SmartTvServer::SmartTvServer(): mRequestCount(0), isInited(false), serverPort(PORT), mServerFd(-1),
  mSegmentDuration(10), mHasMinBufferTime(40), mHasBitrate(6000000), mLiveChannels(20), 
  clientList(), mActiveSessions(0), mConfig(NULL) {
}


SmartTvServer::~SmartTvServer() {
  if (mConfig != NULL)
    delete mConfig;
}

void SmartTvServer::cleanUp() {
  mLog.shutdown();
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
  int rfd;
  sockaddr_in sadr;
  int req_id = 0;
  int ret = 0;
  struct timeval timeout;

  int maxfd;

  fd_set read_set;
  fd_set write_set;

  FD_ZERO(&read_set);
  FD_ZERO(&write_set);

  FD_ZERO(&mReadState);
  FD_ZERO(&mWriteState);

  FD_SET(mServerFd, &mReadState);
  maxfd = mServerFd;

  struct ifreq ifr;

  ifr.ifr_addr.sa_family = AF_INET;
  strncpy(ifr.ifr_name, "eth0", IFNAMSIZ-1);
  ioctl(mServerFd, SIOCGIFADDR, &ifr);
  string own_ip = inet_ntoa(((struct sockaddr_in *)&ifr.ifr_addr)->sin_addr);

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

    ret = select(maxfd + 1, &read_set, &write_set, NULL, &timeout);
    
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
      *(mLog.log()) << "ERROR: select error " <<  errno << endl;
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

	FD_SET(rfd, &mReadState);        /* neuen Client fd dazu */
	FD_SET(rfd, &mWriteState);        /* neuen Client fd dazu */

	if (rfd > maxfd) {
	  maxfd = rfd;
	}

	if (clientList.size() < (rfd+1)) {
	  clientList.resize(rfd+1, NULL); // Check.
	}
	clientList[rfd] = new cHttpResource(rfd, req_id, own_ip, serverPort, this);
	mActiveSessions ++;
	
      }
      else{
	*(mLog.log()) << "Error accepting " <<  errno << endl;
      }    
    }

    // Check for data on already accepted connections
    //    for (rfd = mServerFd + 1; rfd <= maxfd; ++rfd) {
    //    for (rfd = 0; rfd <= maxfd; ++rfd) {
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
          FD_CLR(rfd, &mReadState);      /* dead client */
	  FD_CLR(rfd, &mWriteState);
	}
      }
    }

    // Check for write
    //    for (rfd = mServerFd + 1; rfd <= maxfd; ++rfd) {
    //    for (rfd = 0; rfd <= maxfd; ++rfd) {
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
  return (mActiveSessions != 0 ? true : false);
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
  //  mLog.init("/multimedia/video/smartvvweblog.txt");
  esyslog("SmartTvWeb: Logfile created");
  
  *(mLog.log()) << mConfig->getLogFile() << endl;

#else
  mConfig = new cSmartTvConfig("."); 
  mLog.init(mConfig->getLogFile());
  //  mLog.init("/tmp/smartvvweblog-standalone.txt");
  cout << "SmartTvWeb: Logfile created" << endl;
  cout << "SmartTvWeb: Listening on port= " << PORT << endl;

#endif

  mSegmentDuration= mConfig->getSegmentDuration();
  mHasMinBufferTime= mConfig->getHasMinBufferTime();
  mHasBitrate = mConfig->getHasBitrate();
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
  sock.sin_addr.s_addr = htonl(INADDR_ANY);
  sock.sin_port = htons(serverPort);

  ret = bind(mServerFd, (struct sockaddr *) &sock, sizeof(sock));
  if (ret !=0) {
    *(mLog.log()) << "Error: Cannot bind serving socket, exit" << endl;
    exit(1); 
  }

  ret = listen(mServerFd, 5);
  if (ret <0) {
    *(mLog.log()) << "Error: Cannot set listening on serving socket, exit" << endl;
    exit(1); 
  }

  isInited = true;
}




