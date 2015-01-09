/*
 * smarttvfactory.h: VDR on Smart TV plugin
 *
 * Copyright (C) 2012 - 2015 T. Lohmar
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


#ifndef __SMARTTVSERVER_H__
#define __SMARTTVSERVER_H__

#include <string>
#include <cstring>
#include <vector>
#include <list>
#include <ctime>
#include <sys/select.h>
#include "httpresource_base.h"
#include "log.h"
#include "stvw_cfg.h"
#include "mngurls.h"

#ifndef STANDALONE
#include <vdr/recording.h>
#include <vdr/config.h>
#include <vdr/status.h>

#else
class cStatus {
};
#endif

using namespace std;

#define PLG_VERSION "1.0.2"
#define SERVER "SmartTvWeb/1.0.2" 
class cLiveRelay;

struct sClientEntry {
  string mac;
  string ip;
  time_t lastKeepAlive;
sClientEntry(string m, string i, time_t t ): mac(m), ip(i), lastKeepAlive(t) {};
};

class cCmd {
 public:
  cCmd(string t);
  void trim(string& t);

  string mTitle;
  string mCommand;
  bool mConfirm;
};

class SmartTvServer : public cStatus {

  public:
    SmartTvServer();
    virtual ~SmartTvServer();

    void initServer(string c_dir);
    void loop();
    void cleanUp();
    int  runAsThread();
    void threadLoop();

    Log mLog;

    void readRecordings();
    int  isServing();

    string getConfigDir() { return mConfigDir; };
    cSmartTvConfig* getConfig() { return mConfig; };

    void updateTvClient(string ip, string mac, time_t upd);
    void removeTvClient(string ip, string mac, time_t upd);

    void storeYtVideoId(string guid);
    bool deleteYtVideoId(string guid);

    cManageUrls* getUrlsObj();

    void pushYtVideoId(string, bool);
    void pushCfgServerAddressToTv( string tv_addr);

    string getRecCmdsMsg() { return mRecMsg; };
    string getCmdCmdsMsg() { return mCmdMsg; };
    vector<cCmd*>* getRecCmds() { return &mRecCmds; };
    vector<cCmd*>* getCmdCmds() { return &mCmdCmds; };

    void OsdStatusMessage(const char *Message);

    void clrWriteFlag(int fd);
    void setWriteFlag(int fd);
    int openPipe();

 private:
    void addHttpResource(int fd, cHttpResourceBase* resource);
    void pushToClients(cHttpResourceBase* resource);
    
    int connectToClient(string peer, time_t last_update);
    void setNonBlocking(int fd);

    void initRecCmds();
    void initCmdCmds();
    // status callbacks
    void Recording(const cDevice *Device, const char *Name, const char *FileName, bool On);
    void TimerChange(const cTimer *Timer, eTimerChange Change);

    string processNestedItemList(string, cList<cNestedItem> *, vector<cCmd*>*);

    list<cHttpResourceBase*>::iterator closeHttpResource(list<cHttpResourceBase*>::iterator);
    void acceptHttpResource(int &req_id);

    void logActiveSessionIds() ;

    pthread_t mThreadId;
    int mRequestCount;
    bool isInited;
    int serverPort;
    int mServerFd;
    unsigned int mSegmentDuration;
    int mHasMinBufferTime;
    int mLiveChannels;

    /* vector<cHttpResourceBase*> clientList; */
    list<cHttpResourceBase*> clientList;
    vector<sClientEntry*> mConTvClients;
    //    list<sClientEntry*> mConTvClients;

    vector<cCmd*> mRecCmds;
    vector<cCmd*> mCmdCmds;
    string mRecMsg;
    string mCmdMsg;

    int mActiveSessions;
    int mHttpClientId;

    string mConfigDir;
    cSmartTvConfig *mConfig;

    int mMaxFd;
    fd_set mReadState;
    fd_set mWriteState;

    cManageUrls* mManagedUrls;

    string mRecCmdMsg;
    string mCmdCmdMsg;
    vector<string> mRecCmdList;
    vector<string> mCmdCmdList;
};


#endif
