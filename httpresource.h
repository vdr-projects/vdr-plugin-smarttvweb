/*
 * httpresource.h: VDR on Smart TV plugin
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

#ifndef __HTTPREQUEST_H__
#define __HTTPREQUEST_H__

#include <string>
#include <cstring>
#include <vector>
#include <pthread.h>

#include "log.h"
#include "httpresource_base.h"

//#define MAXLEN 65536 
//#define MAXLEN 524288 
//#define MAXLEN 1048576 
#define MAXLEN 3760000

using namespace std;

struct cRange {
cRange(): isRangeRequest(false), begin(0), end(0) {};
  bool isRangeRequest;
  unsigned long long begin;
  unsigned long long end;
};

struct sQueryAVP {
  string attribute;
  string value;
sQueryAVP(string a, string v) : attribute (a), value(v) {};
};


enum eConnState {
  WAITING,
  READHDR,
  READPAYLOAD,
  SERVING,
  TOCLOSE
};

class SmartTvServer;
class cResponseBase;


class cHttpResource : public cHttpResourceBase {

 public:
  cHttpResource(int, int, int, SmartTvServer*);
  virtual ~cHttpResource();

  int handleRead();
  int handleWrite();
  int checkStatus();


 public:

  Log* mLog;

  time_t mConnTime;
  int mHandleReadCount;
  bool mConnected;
  eConnState mConnState; 

  string mReadBuffer;
  string mMethod;

  /*
  char* mBlkData;
  int mBlkPos;
  int mBlkLen;
*/
  string mRequest;
  string mQuery;
  string mPath;
  string mDir;
  string mVersion;
  string protocol;
  unsigned long long mReqContentLength;
  string mPayload;
  string mUserAgent;
  
  bool mAcceptRanges;
  cRange rangeHdr;

  cResponseBase* mResponse;

  void setNonBlocking();

  int handlePost();
  int handleHeadRequest();
  int processRequest();
  int processHttpHeaderNew();

  int readRequestPayload();

  string getConnStateName();
  int parseRangeHeaderValue(string);
  int parseHttpRequestLine(string);
  int parseHttpHeaderLine (string);
  int parseQueryLine (vector<sQueryAVP> *avps);
  int getQueryAttributeValue(vector<sQueryAVP> *avps, string id, string &val);

  string getOwnIp();
};
#endif
