
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

enum eConnState {
  WAITING,
  SERVING,
  TOCLOSE
};

class cHttpResource {

 public:
  cHttpResource(int, int, string, int);
  virtual ~cHttpResource();

  int readFromClient();
  //  int sendNextChunk();
  void threadLoop();
  int run();

 private:
  Log* mLog;
  pthread_t mThreadId;
  pthread_mutex_t mSendLock;
  string mServerAddr;
  int mServerPort;
  int mFd;
  int mReqId;

  bool mConnected;
  eConnState mConnState;
  string mMethod;
  char *mDataBuffer;
  bool mBlkData;
  int mBlkPos;
  int mBlkLen;

  //  string path;
  string mPath;
  string mVersion;
  string protocol;

  bool mAcceptRanges;
  cRange rangeHdr;
  unsigned long long mFileSize;
  uint mRemLength;
  FILE *mFile;


  //  int tcpServerWrite(const char buf[], int buflen);
  int writeToClient(const char *buf, size_t buflen);
  int sendDataChunk();

  void setNonBlocking();

  int processHttpHeaderNew();
  //  int processHttpHeader();
  void sendError(int status, const char *title, const char *extra, const char *text);
  int sendDir(struct stat *statbuf);
  int sendVdrDir(struct stat *statbuf);
  int sendRecordingsHtml (struct stat *statbuf);
  int sendRecordingsXml (struct stat *statbuf);
  string removeEtChar(string line);

  void sendHeaders(int status, const char *title, const char *extra, const char *mime,
		   off_t length, time_t date);

  int sendFirstChunk(struct stat *statbuf);

  // Helper Functions
  char *getMimeType(const char *name);
  string getConnStateName();
  int parseRangeHeaderValue(string);
  int openFile(const char *name);
  string hexDump(string in);
  string iso8859ToUtf8 (string);

};
#endif
