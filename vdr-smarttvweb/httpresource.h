/*
 * httpresource.h: VDR on Smart TV plugin
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

#ifndef __HTTPREQUEST_H__
#define __HTTPREQUEST_H__

#include <string>
#include <cstring>
#include <pthread.h>
#include "log.h"

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

enum eContentType {
  NYD,   // Not Yet Defined
  VDRDIR,
  SINGLEFILE,
  MEMBLOCK
};

struct sFileEntry {
  string sName;
  string sPath;
  int sStart;

sFileEntry(string n, string l, int s) : sName(n), sPath(l), sStart(s) {
  };
};

class SmartTvServer;
class cResumeEntry;

class cHttpResource {

 public:
  cHttpResource(int, int, string, int, SmartTvServer*);
  virtual ~cHttpResource();

  int handleRead();
  int handleWrite();

  int checkStatus();

  int readFromClient();
  void threadLoop();
  int run();

 private:
  SmartTvServer* mFactory;
  Log* mLog;

  string mServerAddr;
  int mServerPort;
  int mFd;
  int mReqId;

  time_t mConnTime;
  int mHandleReadCount;
  bool mConnected;
  eConnState mConnState;
  eContentType mContentType;

  string mReadBuffer;
  string mMethod;

  string *mResponseMessage;
  int mResponseMessagePos;
  char* mBlkData;
  int mBlkPos;
  int mBlkLen;

  //  string path;
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
  unsigned long long mFileSize;
  uint mRemLength;
  FILE *mFile;
  int mVdrIdx;
  string mFileStructure;
  bool mIsRecording;
  float mRecProgress;

  //  int writeToClient(const char *buf, size_t buflen);
  //  int sendDataChunk();

  void setNonBlocking();
  int fillDataBlk();

  int handlePost();
  int handleHeadRequest();
  int processRequest();
  int processHttpHeaderNew();

  int readRequestPayload();
  //  int processHttpHeader();
  void sendError(int status, const char *title, const char *extra, const char *text);
  int sendDir(struct stat *statbuf);
  int sendVdrDir(struct stat *statbuf);
  int sendRecordingsHtml (struct stat *statbuf);
  int sendRecordingsXml (struct stat *statbuf);
  int sendChannelsXml (struct stat *statbuf);
  int sendEpgXml (struct stat *statbuf);
  int sendMediaXml (struct stat *statbuf);

  //  int sendMPD (struct stat *statbuf);
  int sendManifest (struct stat *statbuf, bool is_hls = true);
  void writeM3U8(float duration, float seg_dur, int end_seg);
  void writeMPD(float duration, float seg_dur, int end_seg);


  int sendMediaSegment (struct stat *statbuf);

  void sendHeaders(int status, const char *title, const char *extra, const char *mime,
		   long long int length, time_t date);

  int sendFile(struct stat *statbuf);

  // Helper Functions
  const char *getMimeType(const char *name);
  string getConnStateName();
  void checkRecording();
  int parseRangeHeaderValue(string);
  int parseHttpRequestLine(string);
  int parseHttpHeaderLine (string);
  int parseQueryLine (vector<sQueryAVP> *avps);
  int parseResume(cResumeEntry &entry, string &id);

  int parseFiles(vector<sFileEntry> *entries, string prefix, string dir_base, string dir_name, struct stat *statbuf);

  int getQueryAttributeValue(vector<sQueryAVP> *avps, string id, string &val);
  int openFile(const char *name);
  int writeXmlItem(string title, string link, string programme, string desc, string guid, time_t start, int dur);
  //  string removeEtChar(string line);
  //  string hexDump(string input);
  //  string convertUrl(string input);
  //  string convertBack(string input);
};
#endif
