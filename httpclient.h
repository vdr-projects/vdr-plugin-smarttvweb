/*
 * httpclient.h: VDR on Smart TV plugin
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

#ifndef __HTTPCLIENT_H__
#define __HTTPCLIENT_H__

#include "log.h"
#include "httpresource_base.h"
#include <sys/time.h>



class SmartTvServer;
class cHttpClientBase : public cHttpResourceBase {

 public:
  cHttpClientBase(int, int, int, SmartTvServer*, string peer);
  virtual ~cHttpClientBase();

  int handleRead();
  int handleWrite();

  int checkStatus();

 protected:
  void createRequestMessage(string path);
  void processResponseHeader();

  int checkTransactionCompletion();

  virtual string getMsgBody(int ) =0;

  Log* mLog;

  string mRequestMessage;
  int mRequestMessagePos;
  
  int mConnState; 
  // 0: Write Request
  // 1: Read Header
  // 2: Read Payload
  // 3: Wait
  string mResponseHdr;
  int mRespBdyLen;
  int mStatus;
  bool mIsChunked; // only value if state== 2, 
  // if mIsChunked == true, then the chunk length is stored in mRespBdyLen
  string mResponseBdy;

  string mPeer;
  int mTransCount;
  
  timeval mWaitStart;
  int mWaitCount;
};


class cHttpYtPushClient : public cHttpClientBase  {
 public:
  cHttpYtPushClient(int, int, int, SmartTvServer*, string peer, string vid, bool store);
  virtual ~cHttpYtPushClient();

 protected:
  string getMsgBody(int );

  string mVideoId;
  bool mStore;

};

class cHttpCfgPushClient : public cHttpClientBase  {
 public:
  cHttpCfgPushClient(int, int, int, SmartTvServer*, string peer);
  virtual ~cHttpCfgPushClient();

 protected:
  string getMsgBody(int );

  string mServerAddress;
};

class cHttpInfoClient : public cHttpClientBase  {
 public:
  cHttpInfoClient(int, int, int, SmartTvServer*, string peer, string body);
  virtual ~cHttpInfoClient();

 protected:
  string getMsgBody(int );

  string mBody;
};

#endif
