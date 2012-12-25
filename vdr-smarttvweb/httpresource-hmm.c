#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <time.h>
#include <sys/socket.h>
#include <netdb.h>
#include <sys/stat.h>
#include <sys/select.h>
#include <fcntl.h>
#include <errno.h>
#include <dirent.h>

#include <string>
#include <cstring>
#include <iostream>
#include <vector>
#include "httpresource.h"

#ifndef VOMPSTANDALONE
#include <vdr/recording.h>
#include <vdr/videodir.h>
#endif

#define SERVER "SmartTvWeb/0.1"
#define PROTOCOL "HTTP/1.1"
#define RFC1123FMT "%a, %d %b %Y %H:%M:%S GMT"

#define MAXLEN 4096
#define OKAY 0
#define ERROR (-1)
#define DEBUG_REGHEADERS
#define DEBUGPREFIX "mReqId= " << mReqId << " fd= " << mFd 
#define DEBUGHDR " " <<  __PRETTY_FUNCTION__ << " (" << __LINE__ << ") "

using namespace std;

struct sVdrFileEntry {
  unsigned long long sSize;
  unsigned long long sCumSize;
  int sIdx;

  sVdrFileEntry () {}; 
  sVdrFileEntry (off_t s, off_t t, int i) 
  : sSize(s), sCumSize(t), sIdx(i) {};
};

void HttpResourceStartThread(void* arg) {
  cHttpResource* m = (cHttpResource*)arg;
  m->threadLoop();
  delete m;
  pthread_exit(NULL);
}

// An HTTP resource has two states: Either Read data or write data.
// In read data (until the header and the full body is received), there is no data to write
// in Write data, there is no data to read
// The only think for both states is to watch the socket close state. 
cHttpResource::cHttpResource(int f, int id,string addr, int port): mServerAddr(addr), mServerPort(port), mFd(f), mReqId(id), mConnected(true), mConnState(WAITING),
  mMethod(), mDataBuffer(NULL), mBlkData(false), mBlkPos(0), mBlkLen(0), mPath(), mVersion(), protocol(), 
  mAcceptRanges(true), rangeHdr(), mFileSize(-1), mRemLength(0) {

  mLog = Log::getInstance();

  *(mLog->log()) << DEBUGPREFIX 
       << " ------- Hello ------- " 
       << DEBUGHDR<< endl;

  pthread_mutex_init(&mSendLock, NULL);
  mDataBuffer = new char[MAXLEN];
}


cHttpResource::~cHttpResource() {
  *(mLog->log())<< DEBUGPREFIX 
       << " ------- Bye ----- "        
       << " mConnState= " << getConnStateName() 
       << DEBUGHDR << endl;
  delete mDataBuffer;
}

void cHttpResource::setNonBlocking() {
  *(mLog->log())<< DEBUGPREFIX
       << " Set Socket to non-blocking" 
       << DEBUGHDR << endl;
  int oldflags = fcntl(mFd, F_GETFL, 0);
  oldflags |= O_NONBLOCK;
  fcntl(mFd, F_SETFL, oldflags);
}

int cHttpResource::run() {
  if (pthread_create(&mThreadId, NULL, (void*(*)(void*))HttpResourceStartThread, (void *)this) == -1) 
    return 0;
  return 1;
}

void cHttpResource::threadLoop() {
  *(mLog->log())<< DEBUGPREFIX
       << " Thread Started" 
       << DEBUGHDR << endl;

  // The default is to read one HTTP request and then close...
  
  fd_set read_state;
  int maxfd;
  struct timeval waitd;          
  FD_ZERO(&read_state);
  FD_SET(mFd, &read_state);
  maxfd = mFd;

  for (;;) {                    
    fd_set readfds;
    int ret;

    waitd.tv_sec = 1;     // Make select wait up to 1 second for data
    waitd.tv_usec = 0;    // and 0 milliseconds.

    readfds = read_state;       
    ret = select(maxfd + 1, &readfds, NULL, NULL, &waitd);
    if ((ret < 0) && (errno == EINTR)) {
      *(mLog->log())<< DEBUGPREFIX
	   << " Error: " << strerror(errno) 
	   << DEBUGHDR << endl; 
      continue;
    }

    // Check for data on already accepted connections
    if (FD_ISSET(mFd, &readfds)) {
      *(mLog->log())<< endl;
      *(mLog->log())<< DEBUGPREFIX
	   << " Request Received from Client fd= "<<  mFd 
	   << DEBUGHDR << endl;

      ret = readFromClient();
      if (ret <0) {
	*(mLog->log())<< DEBUGPREFIX
	     << " Closing Connection" 
	     << DEBUGHDR
	     << endl;
	close(mFd);
	break;
      } 
    }
  } // for (;;)

  *(mLog->log())<< DEBUGPREFIX
       << " Left loop to terminate fd= " << mFd 
       << DEBUGHDR << endl; 
}

int cHttpResource::readFromClient() {
  //  int ret =0;
  struct stat statbuf;
  int ret = OKAY;

  *(mLog->log())<< DEBUGPREFIX
       << DEBUGHDR << endl;

  if (mConnState != WAITING) {
    *(mLog->log())<< DEBUGPREFIX
	 << " ERROR: State is not WAITING" 
	 << DEBUGHDR << endl;
    return OKAY;
  }

  processHttpHeaderNew();
  *(mLog->log())<< " mPath= " << mPath << endl;
  //		      << " mPath(utf8)= " << iso8859ToUtf8(mPath)

  setNonBlocking();
  mConnState = SERVING;

  // done - look for range header
  if (strcasecmp(mMethod.c_str(), "GET") != 0){
    sendError(501, "Not supported", NULL, "Method is not supported.");
    return ERROR;
  }

  if (mPath.compare("/recordings.html") == 0) {
    *(mLog->log())<< DEBUGPREFIX
		  << "generating /recordings.html" 
		  << DEBUGHDR << endl;

    ret = sendRecordingsHtml( &statbuf);
    return ERROR;
  }
  if (mPath.compare("/recordings.xml") == 0) {
    *(mLog->log())<< DEBUGPREFIX
		  << "generating /recordings.xml" 
		  << DEBUGHDR << endl;

    ret = sendRecordingsXml( &statbuf);
    return ERROR;
  }

  if (stat(mPath.c_str(), &statbuf) < 0) {
    sendError(404, "Not Found", NULL, "File not found.");
    return ERROR;
  }
  else {
    if (S_ISDIR(statbuf.st_mode)) {
      if (mPath.find(".rec") != string::npos) {
	ret = sendVdrDir( &statbuf);
      }
      else {
	sendDir( &statbuf);
      }
    }
    else {
      printf ("file send\n");
      mFileSize = statbuf.st_size;
      ret = sendFirstChunk(&statbuf);
    }
  }
  if (mRemLength <=0)
    ret =  ERROR;
  if (mConnState == TOCLOSE)
    ret =  ERROR;

  return ret;
}

void cHttpResource::sendError(int status, const char *title, const char *extra, const char *text) {
  char f[400];

  mConnState = TOCLOSE;
  string hdr = "";
  sendHeaders(status, title, extra, "text/html", -1, -1);
  snprintf(f, sizeof(f), "<HTML><HEAD><TITLE>%d %s</TITLE></HEAD>\r\n", status, title);
  hdr += f;
  snprintf(f, sizeof(f), "<BODY><H4>%d %s</H4>\r\n", status, title);
  hdr += f;
  snprintf(f, sizeof(f), "%s\r\n", text);
  hdr += f;
  snprintf(f, sizeof(f), "</BODY></HTML>\r\n");
  hdr += f;

  if ( writeToClient(hdr.c_str(), hdr.size()) == ERROR) {
    return;
  }
}


int cHttpResource::sendDir(struct stat *statbuf) {
  char pathbuf[4096];
  char f[400];
  int len;

  mConnState = TOCLOSE;
  *(mLog->log())<< "sendDir:" << endl;
  *(mLog->log())<< "path= " << mPath << endl;
  len = mPath.length();
  int ret = OKAY;

  if (len == 0 || mPath[len - 1] != '/') {
    snprintf(pathbuf, sizeof(pathbuf), "Location: %s/", mPath.c_str());
    sendError(302, "Found", pathbuf, "Directories must end with a slash.");
    ret = ERROR;
  }
  else {
    snprintf(pathbuf, sizeof(pathbuf), "%sindex.html", mPath.c_str());
    if (stat(pathbuf, statbuf) >= 0) {
      mPath = pathbuf;
      sendFirstChunk(statbuf);
      //      sendFile(pathbuf, statbuf); // found an index.html file in the directory
    }
    else {
      DIR *dir;
      struct dirent *de;

      sendHeaders(200, "OK", NULL, "text/html", -1, statbuf->st_mtime);

      string hdr = "";
      snprintf(f, sizeof(f), "<HTML><HEAD><TITLE>Index of %s</TITLE></HEAD>\r\n<BODY>", mPath.c_str());
      hdr += f;
      snprintf(f, sizeof(f), "<H4>Index of %s</H4>\r\n<PRE>\n", mPath.c_str());
      hdr += f;
      snprintf(f, sizeof(f), "Name                             Last Modified              Size\r\n");
      hdr += f;
      snprintf(f, sizeof(f), "<HR>\r\n");
      hdr += f;

      if ( writeToClient(hdr.c_str(), hdr.size()) == ERROR) {
	return ERROR;
      }

      if (len > 1) {
	snprintf(f, sizeof(f), "<A HREF=\"..\">..</A>\r\n");
	if ( writeToClient(hdr.c_str(), hdr.size()) == ERROR) {
	  return ERROR;
	}
      }

      dir = opendir(mPath.c_str());
      while ((de = readdir(dir)) != NULL) {
	char timebuf[32];
	struct tm *tm;
	strcpy(pathbuf, mPath.c_str());
	printf (" -Entry: %s\n", de->d_name);
	strcat(pathbuf, de->d_name);

	stat(pathbuf, statbuf);
	tm = gmtime(&(statbuf->st_mtime));
	strftime(timebuf, sizeof(timebuf), "%d-%b-%Y %H:%M:%S", tm);

	hdr = "";
	snprintf(f, sizeof(f), "<A HREF=\"%s%s\">", de->d_name, S_ISDIR(statbuf->st_mode) ? "/" : "");
	hdr += f;

	snprintf(f, sizeof(f), "%s%s", de->d_name, S_ISDIR(statbuf->st_mode) ? "/</A>" : "</A> ");
	hdr += f;

	if (strlen(de->d_name) < 32) {
	  snprintf(f, sizeof(f), "%*s", 32 - strlen(de->d_name), "");
	  hdr += f;
	}
	if (S_ISDIR(statbuf->st_mode)) {
	  snprintf(f, sizeof(f), "%s\r\n", timebuf);
	  hdr += f;
	}
	else {
	  snprintf(f, sizeof(f), "%s\r\n", timebuf);
	  hdr += f;
	}
	if ( writeToClient(hdr.c_str(), hdr.size()) == ERROR) {
	  return ERROR;
	}
      }
      closedir(dir);
      *(mLog->log())<< DEBUGPREFIX
	   << "Done" 
	   << DEBUGHDR << endl;

      snprintf(f, sizeof(f), "</PRE>\r\n<HR>\r\n<ADDRESS>%s</ADDRESS>\r\n</BODY></HTML>\r\n", SERVER);
      if ( writeToClient(hdr.c_str(), hdr.size()) == ERROR) {
	return ERROR;
      }
    }
  }
  if (mRemLength != 0)
    *(mLog->log())<< " WARNING: mRemLength not zero" << endl;
  mRemLength = 0;
  return ret;
}

string cHttpResource::removeEtChar(string line) {
  bool done = false;
  size_t cur_pos = 0;
  size_t pos = 0;
  string res = "";

  int end_after_done = 0;

  while (!done) {
    pos = line.find('&', cur_pos);
    if (pos == string::npos) {
      done = true;
      res += line.substr(cur_pos);
      break;
    }
    if (pos >= 0) {
      res += line.substr(cur_pos, (pos-cur_pos)) + "&#38;";
      //      cur_pos = cur_pos+ pos +1;
      cur_pos = pos +1;
      end_after_done ++;
    }
  }
  if (end_after_done != 0) {
    *(mLog->log())<< "removeEtChar" << " line= " << line;
    *(mLog->log())<< " res= " << res << " occurances= " << end_after_done << endl;
  }
  return res;
}

int cHttpResource::sendRecordingsXml(struct stat *statbuf) {
  sendHeaders(200, "OK", NULL, "application/xml", -1, statbuf->st_mtime);

  string hdr = "";
  hdr += "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>\n";
  //  hdr += "<?xml version=\"1.0\"?>\n";
  hdr += "<rss version=\"2.0\">\n";
  hdr+= "<channel>\n";

  if ( writeToClient(hdr.c_str(), hdr.size()) == ERROR) {
    return ERROR;
  }

  char buff[20];
  char f[400];
  cRecordings Recordings;
  Recordings.Load();

  int count = 0;
  for (cRecording *recording = Recordings.First(); recording; recording = Recordings.Next(recording)) {
    hdr = "";
    if (recording->HierarchyLevels() == 0) {
      if (++count != 11)
	continue;
      hdr += "<item>\n";
      strftime(buff, 20, "%Y-%m-%d %H:%M:%S", localtime(&recording->start));
      hdr += "<title>";
      snprintf(f, sizeof(f), "%s - %s", buff, removeEtChar(recording->Name()).c_str());
      hdr += f;
      hdr += "</title>\n";
      hdr += "<link>";
      snprintf(f, sizeof(f), "http://%s:%d%s/", mServerAddr.c_str(), mServerPort, removeEtChar(recording->FileName()).c_str());
      hdr += f;
      hdr += "</link>\n";
      hdr += "<description>";
      // TODO Title
      const cRecordingInfo* info = recording->Info();
      //      snprintf(f, sizeof(f), "title= %s\n", info->Title());
      //      hdr += f;
      hdr += "Hallo";
      hdr += "HexDump title= \n" + hexDump(recording->Name());
      hdr += "\nHexDump link= \n" + hexDump(recording->FileName()) + "\n";
      *(mLog->log())<< DEBUGPREFIX 
		    << " *** "
		    << " HexDump title= \n" << hexDump(recording->Name()) << endl
		    << " HexDump link= \n" << hexDump(recording->FileName()) << endl
		    << DEBUGHDR
		    << endl;

      //      snprintf(f, sizeof(f), "short= %s\n", info->ShortText());
      //      hdr += f;    
      //      snprintf(f, sizeof(f), "desc= %s\n", info->Description());
      //      hdr += f;    

      hdr += "</description>\n";
      hdr += "</item>\n";
      if ( writeToClient(hdr.c_str(), hdr.size()) == ERROR) {
	return ERROR;
      }
    }
    // start is time_t
  }

  hdr += "</channel>\n";
  hdr += "</rss>\n";
  if ( writeToClient(hdr.c_str(), hdr.size()) == ERROR) {
    return ERROR;
  }

  return ERROR;
}
int cHttpResource::sendRecordingsHtml(struct stat *statbuf) {
  sendHeaders(200, "OK", NULL, "text/html", -1, statbuf->st_mtime);

  string hdr = "";
  hdr += "<HTML><HEAD><TITLE>Recordings</TITLE></HEAD>\r\n";
  hdr += "<meta http-equiv=\"content-type\" content=\"text/html;charset=ISO-8859-15\"/>\r\n";
  hdr += "<BODY>";
  hdr += "<H4>Recordings</H4>\r\n<PRE>\n";
  hdr += "<HR>\r\n";
  if ( writeToClient(hdr.c_str(), hdr.size()) == ERROR) {
    return ERROR;
  }

  char buff[20];
  char f[400];
  cRecordings Recordings;
  Recordings.Load();
  for (cRecording *recording = Recordings.First(); recording; recording = Recordings.Next(recording)) {
    hdr = "";
    strftime(buff, 20, "%Y-%m-%d %H:%M:%S", localtime(&recording->start));
    snprintf(f, sizeof(f), "%s - %d <A HREF=\"%s/\">%s</A>\r\n", buff, recording->HierarchyLevels(), recording->FileName(),  recording->Name());
    hdr += f;
    if ( writeToClient(hdr.c_str(), hdr.size()) == ERROR) {
      return ERROR;
    }
    // start is time_t
  }
  return ERROR;
}

int cHttpResource::sendVdrDir(struct stat *statbuf) {
  *(mLog->log())<< DEBUGPREFIX 
    << " *** "
       << DEBUGHDR
       << endl;
  char pathbuf[4096];
  char f[400];
  int vdr_idx = 0;
  off_t total_file_size = 0; 
  int ret = OKAY;

  string vdr_dir = mPath;
  vector<sVdrFileEntry> file_sizes;
  bool more_to_go = true;

  while (more_to_go) {
    vdr_idx ++;
    snprintf(pathbuf, sizeof(pathbuf), "%s%03d.vdr", mPath.c_str(), vdr_idx);
    if (stat(pathbuf, statbuf) >= 0) {
      *(mLog->log())<< " found for " <<   pathbuf << endl;
      file_sizes.push_back(sVdrFileEntry(statbuf->st_size, total_file_size, vdr_idx));
      total_file_size += statbuf->st_size;
    }
    else {
      more_to_go = false;
    }
  }
  if (file_sizes.size() < 1) {
    // There seems to be vdr video file in the directory
    *(mLog->log())<< DEBUGPREFIX
	 << " No video file in the directory" 
	 << DEBUGHDR << endl;
    sendError(404, "Not Found", NULL, "File not found.");
    ret = ERROR;
    return ret;
  }
  *(mLog->log())<< DEBUGPREFIX
       << " vdr filesize list " 
       << DEBUGHDR << endl;

  for (uint i = 0; i < file_sizes.size(); i++)
    *(mLog->log())<< " i= " << i << " size= " << file_sizes[i].sSize << " tSize= " << file_sizes[i].sCumSize << endl;
  //  *(mLog->log())<< endl;
  *(mLog->log())<< " total_file_size= " << total_file_size << endl;

  uint cur_idx = 0;

  if (!rangeHdr.isRangeRequest) {
    snprintf(pathbuf, sizeof(pathbuf), "%s%03d.vdr", mPath.c_str(), file_sizes[cur_idx].sIdx);

    if (openFile(pathbuf) != OKAY)
      return ERROR;

    mRemLength = total_file_size;
    sendHeaders(200, "OK", NULL, "video/mpeg", total_file_size, statbuf->st_mtime);
  }
  else { // Range request
    // idenify the first file
    *(mLog->log())<< DEBUGPREFIX
	 << " Range Request Handling" 
	 << DEBUGHDR << endl;
    
    cur_idx = file_sizes.size() -1;
    for (uint i = 0; i < file_sizes.size(); i++) {
      if (file_sizes[i].sCumSize > rangeHdr.begin) {
	cur_idx = i -1;
	break;
      }
    }
    *(mLog->log())<< " Identified Record i= " << cur_idx << " file_sizes[i].sCumSize= " 
	 << file_sizes[cur_idx].sCumSize << " rangeHdr.begin= " << rangeHdr.begin 
	 << " vdr_no= " << file_sizes[cur_idx].sIdx << endl;
    snprintf(pathbuf, sizeof(pathbuf), "%s%03d.vdr", mPath.c_str(), file_sizes[cur_idx].sIdx);
    *(mLog->log())<< " file identified= " << pathbuf << endl;
    if (openFile(pathbuf) != OKAY)
      return ERROR;

    mPath = pathbuf;
    *(mLog->log())<< " Seeking into file= " << (rangeHdr.begin - file_sizes[cur_idx].sCumSize) 
	 << " cur_idx= " << cur_idx
	 << " file_sizes[cur_idx].sCumSize= " << file_sizes[cur_idx].sCumSize
	 << endl;

    fseek(mFile, (rangeHdr.begin - file_sizes[cur_idx].sCumSize), SEEK_SET);
    if (rangeHdr.end == 0)
      rangeHdr.end = total_file_size;
    mRemLength = (rangeHdr.end-rangeHdr.begin);
    snprintf(f, sizeof(f), "Content-Range: bytes %lld-%lld/%lld", rangeHdr.begin, (rangeHdr.end -1), total_file_size);
    sendHeaders(206, "Partial Content", f, "video/mpeg", total_file_size, statbuf->st_mtime);
  }

  *(mLog->log())<< " ***** Yes, vdr dir found ***** mPath= " << mPath<< endl;

  while (cur_idx <  file_sizes.size()) {
    ret = sendDataChunk();
    fclose(mFile);

    if (ret == ERROR) {
      /*      *(mLog->log())<< DEBUGPREFIX
	   << " Error, returning" 
	   << DEBUGHDR << endl;
      */
      return ERROR;
      break;
    }
    cur_idx ++;
    if (cur_idx == file_sizes.size()) {
      *(mLog->log())<< DEBUGPREFIX
	   << " Done " 
	   << DEBUGHDR << endl;
      break;
    }
    if (ret == OKAY) {
      snprintf(pathbuf, sizeof(pathbuf), "%s%03d.vdr", mPath.c_str(), file_sizes[cur_idx].sIdx);
      *(mLog->log())<< " Next File pathbuf= " << pathbuf << endl;
      if (openFile(pathbuf) != OKAY)
	return ERROR;
    }
  }
  return ret;
}

void cHttpResource::sendHeaders(int status, const char *title, const char *extra, const char *mime,
				off_t length, time_t date) {

  time_t now;
  char timebuf[128];
  char f[400];

  string hdr = "";
  snprintf(f, sizeof(f), "%s %d %s\r\n", PROTOCOL, status, title);
  hdr += f;
  snprintf(f, sizeof(f), "Server: %s\r\n", SERVER);
  hdr += f;
  now = time(NULL);
  strftime(timebuf, sizeof(timebuf), RFC1123FMT, gmtime(&now));
  snprintf(f, sizeof(f), "Date: %s\r\n", timebuf);
  hdr += f;
  if (extra) { 
    snprintf(f, sizeof(f), "%s\r\n", extra);
    hdr += f;
  }
  if (mime) {
    snprintf(f, sizeof(f), "Content-Type: %s\r\n", mime);
    hdr += f;
  }
  if (length >= 0) {
    snprintf(f, sizeof(f), "Content-Length: %lld\r\n", length);
  *(mLog->log())<< DEBUGPREFIX
       << " length= " << length 
       << DEBUGHDR << endl;
    hdr += f;
  }
  if (date != -1) {
    strftime(timebuf, sizeof(timebuf), RFC1123FMT, gmtime(&date));
    snprintf(f, sizeof(f), "Last-Modified: %s\r\n", timebuf);
    hdr += f;
  }
  if (mAcceptRanges) {
    snprintf(f, sizeof(f), "Accept-Ranges: bytes\r\n");
    hdr += f;
  }
  snprintf(f, sizeof(f), "Connection: close\r\n");
  hdr += f;

  snprintf(f, sizeof(f), "\r\n");
  hdr += f;
  if ( writeToClient(hdr.c_str(), hdr.size()) == ERROR) {
    return;
  }

}

int cHttpResource::sendFirstChunk(struct stat *statbuf) {
  // Send the First Datachunk, incl all headers

  *(mLog->log())<< "fd= " <<  mFd << " mReqId= "<< mReqId << " mPath= " << mPath 
       << DEBUGHDR
       << endl;

  char f[400];

  if (openFile(mPath.c_str()) == ERROR)
    return ERROR;
  mFile = fopen(mPath.c_str(), "r");
  int ret = OKAY;

  if (!mFile) {
    sendError(403, "Forbidden", NULL, "Access denied.");
    ret = ERROR;
  }
  else {
    mFileSize = S_ISREG(statbuf->st_mode) ? statbuf->st_size : -1;

    if (!rangeHdr.isRangeRequest) {
      mRemLength = mFileSize;
      sendHeaders(200, "OK", NULL, getMimeType(mPath.c_str()), mFileSize, statbuf->st_mtime);
    }
    else { // Range request
      fseek(mFile, rangeHdr.begin, SEEK_SET);
      if (rangeHdr.end == 0)
	rangeHdr.end = mFileSize;
      mRemLength = (rangeHdr.end-rangeHdr.begin);
      snprintf(f, sizeof(f), "Content-Range: bytes %lld-%lld/%lld", rangeHdr.begin, (rangeHdr.end -1), mFileSize);
      sendHeaders(206, "Partial Content", f, getMimeType(mPath.c_str()), (rangeHdr.end-rangeHdr.begin), statbuf->st_mtime);
    }

    *(mLog->log())<< "fd= " <<  mFd << " mReqId= "<< mReqId 
	 << ": Done mRemLength= "<< mRemLength << " ret= " << ret 
	 << DEBUGHDR << endl;

    ret = sendDataChunk();
    *(mLog->log())<< " Close File" << endl;
    fclose(mFile);
  }
  return ret;

}

int cHttpResource::sendDataChunk() {
  // the the paload of an open file
  *(mLog->log())<< DEBUGPREFIX
       << " mConnState= " << getConnStateName() << " mRemLength= "<< mRemLength 
       << DEBUGHDR << endl;

  int n;
  int chunk_no =0;
  int bytes_to_send = 0;

  int ret = 0;

  char buf[MAXLEN];
  int buflen = sizeof(buf);

  if (!mConnected)
    return ERROR;

  if (mConnState == WAITING) {
    *(mLog->log())<< "fd= " << mFd
	 << " Something wrong: Should not be here" 
	 << DEBUGHDR << endl;
    return OKAY;
  }
  if (mRemLength ==0) {
    *(mLog->log())<< " closing connection" 
	 << DEBUGHDR << endl;
    mConnected = false;
    close (mFd);
    return ERROR;  
  }
  if (mConnState == TOCLOSE) {
    *(mLog->log())<< DEBUGPREFIX
	 << " closing connection" 
	 << DEBUGHDR << endl;
    mConnected = false;
    close (mFd);
    return ERROR;
  }

  bool done = false;
  while (!done) {
    // Check whethere there is no other data to send (from last time)
    if (mRemLength == 0) {
      *(mLog->log())<< DEBUGPREFIX
	   << " mRemLength == 0 --> closing connection" 
	   << DEBUGHDR << endl;
      mConnected = false;
      close (mFd);
      return ERROR;
      
    }
    if (mRemLength >= buflen) {
      bytes_to_send = buflen;
    }
    else
      bytes_to_send = mRemLength;

    n = fread(buf, 1, bytes_to_send, mFile);
    if (n != bytes_to_send) {
    *(mLog->log())<< DEBUGPREFIX
	 << " -- Something wrong here - n= " << n << " bytes_to_send= " << bytes_to_send 
	 << DEBUGHDR << endl;
      done = true;
    }

    ret = writeToClient( buf, bytes_to_send);
    if (ret == ERROR) {
      *(mLog->log())<< DEBUGPREFIX
	   << " Stopping - Client closed connection " 
	   << DEBUGHDR << endl;
      
      // socket had blocket. wait until select comes back.
      done = true;
      //      fclose(mFile);
      ret = ERROR;
      break;
    }

    mRemLength -= bytes_to_send;
    chunk_no ++;
    //    *(mLog->log())<< " chunk_no= " << chunk_no << endl;
  }

  return ret;
}

int cHttpResource::writeToClient(const char *buf, size_t buflen) {
  //  *(mLog->log())<< __PRETTY_FUNCTION__ << " (" << __LINE__ << "): "
  //       << "fd= " << mFd << " mReqId=" << mReqId << " mConnected= " << ((mConnected)? "true":"false") 
  //       << " buflen= " << buflen << " mRemLength= "<< mRemLength << endl;

  unsigned int bytes_written = 0;
  int this_write;
  int retries = 0;

  struct timeval timeout;

  int ret = 0;
  fd_set write_set;

  FD_ZERO(&write_set);

  pthread_mutex_lock(&mSendLock);
  
  if (!mConnected) {
    *(mLog->log())<< DEBUGPREFIX
	 << " not connected anymore" 
	 DEBUGHDR << endl;
    pthread_mutex_unlock(&mSendLock);
    return ERROR;
  }

  if (mConnState == WAITING) {
    *(mLog->log())<< DEBUGPREFIX
	 << " Should not be in WAITING state" 
	 << DEBUGHDR << endl;
    pthread_mutex_unlock(&mSendLock);
    return OKAY;
  }

  bool done = false;
  while (!done) {
    FD_ZERO(&write_set);
    FD_SET(mFd, &write_set);
    timeout.tv_sec = 10;
    timeout.tv_usec = 0;
    ret = select(mFd + 1, NULL, &write_set, NULL, NULL);
    if (ret < 1) {
      *(mLog->log())<< DEBUGPREFIX
	   << " Select returned error -- Closing connection" 
	   << DEBUGHDR << endl;
      mConnected = false;
      pthread_mutex_unlock(&mSendLock);
      close(mFd);
      return ERROR;  // error, or timeout
    }
    if (ret == 0) {
      *(mLog->log())<< DEBUGPREFIX
	   << " Select returned ZERO -- Closing connection" 
	   << DEBUGHDR << endl;
      mConnected = false;
      pthread_mutex_unlock(&mSendLock);
      close(mFd);
      return ERROR;  // error, or timeout
    }
    this_write = write(mFd, &buf[bytes_written], buflen - bytes_written);
    if (this_write <=0)    {
      /*      *(mLog->log())<< DEBUGPREFIX
	   << " ERROR: Stopped (Client terminated Connection)" 
	   << DEBUGHDR << endl;
      */
      mConnected = false;
      close(mFd);
      pthread_mutex_unlock(&mSendLock);
      return ERROR;
    }
    bytes_written += this_write;

    if (bytes_written == buflen) {
      done = true;
      break;
    }
    else {
      if (++retries == 100) {
	*(mLog->log())<< DEBUGPREFIX
	     << " ERROR: Too many retries " 
	     << DEBUGHDR << endl;
	mConnected = false;
	close(mFd);
	pthread_mutex_unlock(&mSendLock);
	return ERROR;	
      }
    }
  }
  //  *(mLog->log())<< __PRETTY_FUNCTION__ << " (" << __LINE__ << "): "
  //       << " done "<< endl;
  // Done with writing
  pthread_mutex_unlock(&mSendLock);

  return OKAY;
}




char *cHttpResource::getMimeType(const char *name) {
  char *ext = strrchr((char*)name, '.');
  if (!ext) 
    return NULL;
  //  if (ext.compare(".html") || ext.compare(".htm")) return "text/html";
  if (strcmp(ext, ".html") == 0 || strcmp(ext, ".htm") == 0) return "text/html";
  if (strcmp(ext, ".jpg") == 0 || strcmp(ext, ".jpeg") == 0) return "image/jpeg";
  if (strcmp(ext, ".gif") == 0) return "image/gif";
  if (strcmp(ext, ".png") == 0) return "image/png";
  if (strcmp(ext, ".css") == 0) return "text/css";
  if (strcmp(ext, ".au") == 0) return "audio/basic";
  if (strcmp(ext, ".wav") == 0) return "audio/wav";
  if (strcmp(ext, ".avi") == 0) return "video/x-msvideo";
  if (strcmp(ext, ".mp4") == 0) return "video/mp4";
  if (strcmp(ext, ".vdr") == 0) return "video/mpeg";
  if (strcmp(ext, ".mpeg") == 0 || strcmp(ext, ".mpg") == 0) return "video/mpeg";
  if (strcmp(ext, ".mp3") == 0) return "audio/mpeg";
  return NULL;
}

int cHttpResource::processHttpHeaderNew() {
  *(mLog->log())<< DEBUGPREFIX
       << " processHttpHeaderNew " 
       << DEBUGHDR << endl;

  char buf[MAXLEN];
  int buflen = sizeof(buf);

  int line_count = 0;
  bool hdr_end_found = false;
  bool is_req = true;
  // block until the entire request header is read
  string rem_hdr = "";

  while (!hdr_end_found) {
    int count = 0;
    while ((buflen = read(mFd, buf, sizeof(buf))) == -1)
      count ++;
    if (count != 0)
      *(mLog->log())<< " Blocked for " << count << " Iterations " << endl; 
    //FIXME. Better return and wait.
    if (buflen == -1) {
      *(mLog->log())<< " Some Error" << endl;
      return 2; // Nothing to read
    }
    #ifdef DEBUG_REQHEADERS
    *(mLog->log())<< " Read " << buflen << " Bytes from " << fd << endl;
    #endif
    string req_line = rem_hdr + buf;
    if (rem_hdr.size() != 0) {
      *(mLog->log())<< DEBUGPREFIX
	   << " rem_hdr.size() = " << rem_hdr.size() 
	   << DEBUGHDR << endl;
    }
    buflen += rem_hdr.size();

    size_t last_pos = 0;
    while (true) {
      line_count ++;
      size_t pos = req_line.find ("\r\n", last_pos);
      if (pos > buflen) {
	*(mLog->log())<< DEBUGPREFIX
	     << " Pos (" << pos << ") outside of read buffer" 
	     << DEBUGHDR << endl;
	rem_hdr = req_line.substr(last_pos, buflen - last_pos);
	*(mLog->log())<< DEBUGPREFIX
	     << " No HdrEnd Found, read more data. rem_hdr= " << rem_hdr.size() 
	     << DEBUGHDR << endl;	
	break;
      }
      if ((last_pos - pos) == 0) {
	*(mLog->log())<< DEBUGPREFIX
	     << " Header End Found" 
	     << DEBUGHDR << endl;
	hdr_end_found = true;
	break;
      }

      if (pos == string::npos){
      // not found
	rem_hdr = req_line.substr(last_pos, buflen - last_pos);
	*(mLog->log())<< DEBUGPREFIX
	     << " No HdrEnd Found, read more data. rem_hdr= " << rem_hdr.size() 
	     << DEBUGHDR << endl;	
	break;
      }
  
      string line = req_line.substr(last_pos, (pos-last_pos));

#ifdef DEBUG_REQHEADERS
      *(mLog->log())<< " Line= " << line << endl;
#endif
      last_pos = pos +2;
      if (is_req) {
	is_req = false;
	// Parse the request line
	mMethod = line.substr(0, line.find_first_of(" "));
	mPath = line.substr(line.find_first_of(" ") +1, (line.find_last_of(" ") - line.find_first_of(" ") -1));
	mVersion = line.substr(line.find_last_of(" ") +1);

	*(mLog->log())<< DEBUGPREFIX
		      << " ReqLine= " << line << endl;
	*(mLog->log())<< DEBUGPREFIX
		      << " mMethod= " << mMethod 
		      << " mPath= " << mPath
	  //		      << " mPath(utf8)= " << iso8859ToUtf8(mPath)
		      << " mVer= " << mVersion 
		      << " HexDump= " << endl << hexDump(mPath)
		      << DEBUGHDR << endl;
      }
      else {
	string hdr_name = line.substr(0, line.find_first_of(":"));
	string hdr_val = line.substr(line.find_first_of(":") +2);
	if (hdr_name.compare("Range") == 0) {
	  parseRangeHeaderValue(hdr_val);
	  *(mLog->log())<< " Range:  Begin= " << rangeHdr.begin 
	       << "  End= " << rangeHdr.end
	       << endl; 
	}
	if (hdr_name.compare("User-Agent") == 0) {
	  //	  *(mLog->log())<< " ***" << hdr_name << endl;
	  *(mLog->log())<< " User-Agent:  " << hdr_val 
	       << endl; 
	}

      }
      //      *(mLog->log())<< " update last_pos= " << last_pos << endl;; 
    }
  }
  //  exit(0);
  return OKAY;
}

string cHttpResource::getConnStateName() {
  string state_string;
  switch (mConnState) {
  case WAITING:
    state_string = "WAITING";
    break;
  case SERVING:
    state_string = "SERVING";
    break;
  case TOCLOSE:
    state_string = "TOCLOSE";
    break;
  default:
    state_string = "UNKNOWN";
    break;
  }
  return state_string;
}

int cHttpResource::parseRangeHeaderValue(string val) {
  rangeHdr.isRangeRequest = true;
  size_t pos_equal = val.find_first_of('=');
  size_t pos_minus = val.find_first_of('-');

  string range_type = val.substr(0, pos_equal);
  string first_val= val.substr(pos_equal+1, pos_minus -(pos_equal+1));
  rangeHdr.begin = atoll(first_val.c_str());

  string sec_val = "";
  if ((pos_minus +1)< val.size()){
    sec_val = val.substr(pos_minus+1);
    rangeHdr.end = atoll(sec_val.c_str());
  }
  //  *(mLog->log())<< " RangeType= (" << range_type 
  //       << ") Begin= " << rangeHdr.begin 
  //       << "  End= " << rangeHdr.end
  //       << endl; 
  // *(mLog->log())<< " equal= " << equal << " minus= " << minus  << " size= " << hdr_val.size() << endl; 

}

int cHttpResource::openFile(const char *name) {
  mFile = fopen(name, "r");
  if (!mFile) {
    *(mLog->log())<< DEBUGPREFIX
	 << " fopen failed pathbuf= " << name 
	 << DEBUGHDR << endl;
    sendError(403, "Forbidden", NULL, "Access denied.");
    return ERROR;
  }
  return OKAY;
}

string cHttpResource::hexDump(string in) {
  string res = "";
  string ascii = "";
  char buf[10];

  int line_count = 0;
  for (uint i = 0; i < in.size(); i++) {
    unsigned char num = in[i];
    sprintf (buf, "%02hhX", num);
    if ((num >= 32) && (num < 127)) {
      ascii += char(num);
    }
    else 
      ascii += '.';
    res += buf;

    line_count++;
    switch (line_count) {
    case 8:
      res += "  ";
      ascii += " ";
      break;      
    case 16:
      res += "  " + ascii;
      res += "\r\n";
      ascii = "";
      line_count = 0;
      break;      
    default: 
      res += " ";
      break;
    }
  }
  if (line_count != 0) {
    for (int i = 0; i < ((16 - line_count) * 3 ); i++)
      res += " ";
    if (line_count >= 8) 
      res += " ";
    res += ascii;
  }
  return res;
}


string iso8859ToUtf8 (string input) {
    string res = "";

    /*    for (uint i = 0; i < input.size(); i++) {
      unsigned char num = input[i]; 
      if (num < 128)
	res += char(num);
      else {
	//	res += char(0xc2 + (num > 0xbf));
      //      res += char((num & 0x3f) +0x80);
      }
      
      }*/
    
    return res; 
  //  unsigned char *in, *out;
  //  while (*in)
  //    if (*in<128) *out++=*in++;
  //    else *out++=0xc2+(*in>0xbf), *out++=(*in++&0x3f)+0x80;

  }
