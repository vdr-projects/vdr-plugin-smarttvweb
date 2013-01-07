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


#ifndef __SMARTTVSERVER_H__
#define __SMARTTVSERVER_H__

#include <string>
#include <cstring>
#include <vector>
#include <list>
#include "httpresource.h"
#include "log.h"
#include "stvw_cfg.h"

#ifndef STANDALONE
#include <vdr/recording.h>
#endif

using namespace std;

class SmartTvServer {
  public:
    SmartTvServer();
    virtual ~SmartTvServer();

    void initServer(string c_dir);
    void loop();
    void cleanUp();
    int runAsThread();
    void threadLoop();

    Log mLog;

    void readRecordings();
    int isServing();

    string getConfigDir() { return mConfigDir; };
    cSmartTvConfig* getConfig() { return mConfig; };

 private:
    pthread_t mThreadId;
    int mRequestCount;
    bool isInited;
    int serverPort;
    int mServerFd;
    unsigned int mSegmentDuration;
    int mHasMinBufferTime;
    unsigned int mHasBitrate;
    int mLiveChannels;

    vector<cHttpResource*> clientList;
    //    list<int>mFdList;
    int mActiveSessions;
    string mConfigDir;
    cSmartTvConfig *mConfig;

    int mMaxFd;
    fd_set mReadState;
    fd_set mWriteState;
};


#endif
