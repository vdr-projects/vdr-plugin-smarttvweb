/*
 * httpresource.h: VDR on Smart TV plugin
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
#include "smarttvfactory.h"
#include "stvw_cfg.h"

#include "url.h"

#ifndef STANDALONE
#include <vdr/recording.h>
#include <vdr/channels.h>
#include <vdr/timers.h>
#include <vdr/videodir.h>
#include <vdr/epg.h>
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

#define DEBUG

#define SEGMENT_DURATION 10

using namespace std;


struct sVdrFileEntry {
  unsigned long long sSize;
  unsigned long long sFirstOffset;
  int sIdx;

  sVdrFileEntry () {}; 
  sVdrFileEntry (off_t s, off_t t, int i) 
  : sSize(s), sFirstOffset(t), sIdx(i) {};
};


struct sTimerEntry {
  string name;
  time_t startTime;
  int duration;
sTimerEntry(string t, time_t s, int d) :  name(t), startTime(s), duration(d) {};
};

// 8 Byte per entry
struct tIndexTs {
  uint64_t offset:40; // up to 1TB per file (not using off_t here - must definitely be exactly 64 bit!)
  int reserved:7; // reserved for future use
  int independent:1; // marks frames that can be displayed by themselves (for trick modes)
  uint16_t number:16; // up to 64K files per recording
  };

union tIndexRead {
  struct tIndexTs in;
  char buf[8];
};


cHttpResource::cHttpResource(int f, int id,string addr, int port, SmartTvServer* factory): mFactory(factory), mLog(), mServerAddr(addr), 
  mServerPort(port), mFd(f), mReqId(id), mConnTime(0), mHandleReadCount(0),  
  mConnected(true), mConnState(WAITING), mContentType(NYD), mReadBuffer(),
  mMethod(), mResponseMessagePos(0), mBlkData(NULL), mBlkPos(0), mBlkLen(0), 
  mPath(), mVersion(), protocol(), mReqContentLength(0),
  mPayload(), mUserAgent(),
  mAcceptRanges(true), rangeHdr(), mFileSize(-1), mRemLength(0), mFile(NULL), mVdrIdx(1), mFileStructure(), 
  mIsRecording(false), mRecProgress(0.0) {

  mLog = Log::getInstance();
  mPath = "";
  mConnTime = time(NULL);
  setNonBlocking();
  mBlkData = new char[MAXLEN];

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX 
		<< " cHttpResource created" << endl;
#endif
}


cHttpResource::~cHttpResource() {
#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX 
		<< " Destructor of cHttpResource called"        
		<< endl;
#endif
  delete[] mBlkData;
  if (mFile != NULL) {
    *(mLog->log())<< DEBUGPREFIX
		  << " ERROR: mFile still open. Closing now..." << endl;
    fclose(mFile);
    mFile = NULL;
  }
    
}

int cHttpResource::checkStatus() {
  time_t now = time(NULL);

  switch (mConnState) {
  case WAITING:
  case READHDR:
  case READPAYLOAD:
    if (now - mConnTime > 2) {
      *(mLog->log()) << DEBUGPREFIX
		     << " checkStatus: no activity for 2sec "
		     << "mmConnState= " << getConnStateName()
		     << endl;
      return ERROR;
    }
    break;
  case TOCLOSE:
    return ERROR;
    break;
  }

  // check for how much time the 
  return OKAY;
}

void cHttpResource::setNonBlocking() {
  int oldflags = fcntl(mFd, F_GETFL, 0);
  oldflags |= O_NONBLOCK;
  fcntl(mFd, F_SETFL, oldflags);
}


int cHttpResource::handleRead() {
  mHandleReadCount ++;
  if (mConnState == SERVING) {
    *(mLog->log())<< DEBUGPREFIX
		  << " handleRead() in wrong state= " << getConnStateName()
		  << endl; 
    return OKAY;
  }
  if (mConnState == TOCLOSE) {
    *(mLog->log())<< DEBUGPREFIX
		  << " handleRead() in wrong state= " << getConnStateName()
		  << endl; 
    return ERROR;
  }

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " handleRead() state= " << getConnStateName()
		<< endl; 
#endif  

  char buf[MAXLEN];
  int buflen = sizeof(buf);

  int line_count = 0;
  bool is_req = true;
  string rem_hdr = "";

  buflen = read(mFd, buf, sizeof(buf));

  if (buflen == -1) {
    *(mLog->log())<< " Some Error, no data received" << endl;
    return ERROR; // Nothing to read
  }

  //  if (( mConnState == WAITING) and ((time(NULL) - mConnTime) > 1)) {
  if (( mConnState == WAITING) and (mHandleReadCount > 1000)) {
    *(mLog->log()) << DEBUGPREFIX << " hmm, handleRead() no data since 1sec -> closing. mHandleReadCount= " << mHandleReadCount << endl;
    return ERROR; // Nothing to read   
  }

  if ( ((mConnState == READHDR) or (mConnState == READPAYLOAD)) and (mHandleReadCount > 5000)) {
    *(mLog->log()) << DEBUGPREFIX << " ERROR Still not finished after mHandleReadCount= " << mHandleReadCount << endl;
    return ERROR; // Nothing to read 
  }

  if (buflen == 0) {
    return OKAY; // Nothing to read
  }

  if (mConnState == READPAYLOAD) {
    mPayload += string(buf, buflen);
    if (mPayload.size() == mReqContentLength) {
      //Done
      mConnState = SERVING;
      return processRequest();
    }
  }

  if (mConnState == WAITING) {
    mConnState = READHDR;
  }

  string req_line = mReadBuffer + string(buf, buflen);
  buflen += rem_hdr.size();

  size_t last_pos = 0;
  // Parse http header lines
  while (true) {
    line_count ++;
    size_t pos = req_line.find ("\r\n", last_pos);

    if ((pos > buflen) or (pos == string::npos)) {
      mReadBuffer = req_line.substr(last_pos, buflen - last_pos);
#ifndef DEBUG
      *(mLog->log())<< DEBUGPREFIX << " No HdrEnd Found, read more data. rem_hdr= " << mReadBuffer.size() 
		    << " buflen= " << buflen
		    << DEBUGHDR << endl;	
      *(mLog->log())<< cUrlEncode::hexDump(mReadBuffer) << endl;
#endif
      return OKAY;
    }

    if ((last_pos - pos) == 0) {
      // Header End 
#ifndef DEBUG
      *(mLog->log())<< DEBUGPREFIX << " ---- Header End Found" << DEBUGHDR << endl;
#endif

      if (mReqContentLength != 0) {
	mConnState = READPAYLOAD;
	mPayload = req_line.substr(pos +2, buflen - (pos +2));
	if (mPayload.size() != mReqContentLength) 
	  return OKAY;
	else {
	  mConnState = SERVING;
	  return processRequest();
	}
      } // if(content_length != 0)
      else {
	mConnState = SERVING;
	return processRequest();
      }
    } // if (header end)

    string line = req_line.substr(last_pos, (pos-last_pos));
#ifdef DEBUG_REQHEADERS
      *(mLog->log())<< " Line= " << line << endl;
#endif
      last_pos = pos +2;
      if (mPath.size() == 0) {
#ifndef DEBUG
	*(mLog->log())<< " parsing Request Line= " << line << endl;
#endif	
	is_req = false;
	// Parse the request line
	if (parseHttpRequestLine(line) != OKAY) {
	  return ERROR;
	};
      }
      else {
	parseHttpHeaderLine (line);
      }
    }
  return OKAY;
}

int cHttpResource::processRequest() {
  // do stuff based on the request and the query
#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX << " processRequest for mPath= " << mPath << DEBUGHDR << endl;
#endif
  struct stat statbuf;
  int ret = OKAY;

  if (mMethod.compare("POST")==0) {
    return handlePost();
  }

  if (strcasecmp(mMethod.c_str(), "GET") != 0){
    sendError(501, "Not supported", NULL, "Method is not supported.");
    return OKAY;
  }

#ifndef STANDALONE
  if (mPath.compare("/recordings.html") == 0) {
#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX
		  << " generating /recordings.html" 
		  << DEBUGHDR << endl;
#endif
    ret = sendRecordingsHtml( &statbuf);
    return OKAY;
  }

  if (mPath.compare("/recordings.xml") == 0) {
    ret = sendRecordingsXml( &statbuf);
    return OKAY;
  }

  if (mPath.compare("/channels.xml") == 0) {
    ret = sendChannelsXml( &statbuf);
    return OKAY;
  }

  if (mPath.compare("/epg.xml") == 0) {
    ret = sendEpgXml( &statbuf);
    return OKAY;
  }
#endif

  if (mPath.compare("/media.xml") == 0) {
    ret = sendMediaXml( &statbuf);
    return OKAY;
  }

  if (mPath.compare("/widget.conf") == 0) {
    mPath = mFactory->getConfigDir() + "/widget.conf";

    if (stat(mPath.c_str(), &statbuf) < 0) {
      sendError(404, "Not Found", NULL, "File not found.");
      return OKAY;
    }
    mFileSize = statbuf.st_size;
    mContentType = SINGLEFILE;
    return sendFile(&statbuf);
  }

  if (mPath.size() > 8) {
    if (mPath.compare(mPath.size() -8, 8, "-seg.mpd") == 0) {
      ret = sendManifest( &statbuf, false);
      return OKAY;
    }
  }

  if (mPath.size() > 9) {
    if (mPath.compare(mPath.size() -9, 9, "-seg.m3u8") == 0) {
      ret = sendManifest( &statbuf, true);
      return OKAY;
    }
  }

  if (mPath.size() > 7) {
    if (mPath.compare(mPath.size() -7, 7, "-seg.ts") == 0) {
      ret = sendMediaSegment( &statbuf);
      return OKAY;
    }
  }

  if (stat(mPath.c_str(), &statbuf) < 0) {
    // checking, whether the file or directory exists 
    sendError(404, "Not Found", NULL, "File not found.");
    return OKAY;
  }

  if (S_ISDIR(statbuf.st_mode)) {
    // Do Folder specific checkings
#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX
		  << " processRequest: isDir - mPath: " <<  mPath.c_str() << endl;
#endif    
    
    if (mPath.size() >4) {
      if (mPath.compare(mPath.size() - 4, 4, ".rec") == 0) {
	// Handle any recording directory specifically
	mContentType = VDRDIR;
	return sendVdrDir( &statbuf);
      }
    }

    if (mPath.compare(0, (mFactory->getConfig()->getMediaFolder()).size(), mFactory->getConfig()->getMediaFolder()) != 0) {
      // No directory access outside of MediaFolder
      *(mLog->log())<< DEBUGPREFIX
		    << " Directory request is not for MediaFolde (" 
		    << mFactory->getConfig()->getMediaFolder() << ")"
		    << endl;
      sendError(404, "Not Found", NULL, "File not found.");
      return OKAY;
    }

    sendDir( &statbuf);
    mContentType = MEMBLOCK;
    return OKAY;    
  }
  else {
    // mPath is not a folder, thus it is a file
#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX
		  << " processRequest: file send\n";
#endif

    // Check, if requested file is in Media Directory
    if (mPath.compare(0, (mFactory->getConfig()->getMediaFolder()).size(), mFactory->getConfig()->getMediaFolder()) != 0) {
      sendError(404, "Not Found", NULL, "File not found.");
      return OKAY;
    }
    mFileSize = statbuf.st_size;
    mContentType = SINGLEFILE;
    return sendFile(&statbuf);
  }

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		  << " processRequest: Not Handled SHOULD not be here\n";
#endif
  return ERROR;
}


int cHttpResource::handleWrite() {

  if (mConnState == TOCLOSE) {
    *(mLog->log())<< DEBUGPREFIX
		  << " handleWrite() in wrong state= " << getConnStateName()
		  << endl; 
    return ERROR;
  }

  if (mConnState != SERVING)  {
    return OKAY;
  }

  if (mBlkLen == mBlkPos) {
    // note the mBlk may be filled with header info first.
    if (fillDataBlk() != OKAY) {
      return ERROR;
    }
  }
  
  int this_write = write(mFd, &mBlkData[mBlkPos], mBlkLen - mBlkPos);
  if (this_write <=0)    {

#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX
	   << " ERROR after write: Stopped (Client terminated Connection)"
		  << " mBlkPos= " << mBlkPos << " mBlkLen= " << mBlkLen
	   << DEBUGHDR << endl;
#endif
    mConnState = TOCLOSE;
    mConnected = false;
    return ERROR;
  }
  mBlkPos += this_write;

  return OKAY;
}


int cHttpResource::fillDataBlk() {
  char pathbuf[4096];

  mBlkPos = 0;
  int to_read = 0;

  switch(mContentType) {
  case NYD:

    break;
  case VDRDIR:
    // Range requests are assumed to be all open
    if (mFile == NULL) {
      *(mLog->log()) << DEBUGPREFIX << " no open file anymore "
		     << "--> Done " << endl;
      return ERROR;
    }
    if (mRemLength == 0) {
      *(mLog->log()) << DEBUGPREFIX << " mRemLength is zero "
		     << "--> Done " << endl;
      fclose(mFile);
      mFile = NULL;      
      return ERROR;
    }
    to_read = ((mRemLength > MAXLEN) ? MAXLEN : mRemLength);
    
    mBlkLen = fread(mBlkData, 1, to_read, mFile);
    mRemLength -= mBlkLen;

    if (mRemLength == 0) {
      *(mLog->log()) << DEBUGPREFIX << " last Block read "
		     << "--> Almost Done " << endl;
      return OKAY;
    }

    if (mBlkLen != MAXLEN) {
      fclose(mFile);
      mFile = NULL;
      mVdrIdx ++;

      snprintf(pathbuf, sizeof(pathbuf), mFileStructure.c_str(), mDir.c_str(), mVdrIdx);
      mPath = pathbuf;
      if (openFile(pathbuf) != OKAY) {
	*(mLog->log())<< DEBUGPREFIX << " Failed to open file= " << pathbuf << " mRemLength= " << mRemLength<< endl;
	mFile = NULL;
	if  (mBlkLen == 0) {
	  *(mLog->log()) << DEBUGPREFIX << " mBlkLen is zero --> Done "  << endl;
	  return ERROR;
	}
	else
	  *(mLog->log()) << DEBUGPREFIX << " Still data to send mBlkLen= " << mBlkLen <<" --> continue "  << endl;
	return OKAY;
      }
    
      if (mBlkLen == 0) {
	to_read = ((mRemLength > MAXLEN) ? MAXLEN : mRemLength);
	mBlkLen = fread(mBlkData, 1, to_read, mFile);
      }
      mRemLength -= mBlkLen;
    }
    break;
  case SINGLEFILE:
    to_read = ((mRemLength > MAXLEN) ? MAXLEN : mRemLength);
    mBlkLen = fread(mBlkData, 1, to_read, mFile);
    mRemLength -= mBlkLen;
    if (mBlkLen == 0) {

      // read until EOF 
      fclose(mFile);
      mFile = NULL;
      return ERROR;
    }
    break;
  case MEMBLOCK:
    int rem_len = mResponseMessage->size() - mResponseMessagePos;
    if (rem_len == 0) {

#ifndef DEBUG
      *(mLog->log())<< DEBUGPREFIX << " fillDataBlock: MEMBLOCK done" << endl;
#endif
      delete mResponseMessage;
      mResponseMessagePos = 0;
      mConnState = TOCLOSE;
      return ERROR;
    }
    if (rem_len > MAXLEN) 
      rem_len = MAXLEN;

    string sub_msg = mResponseMessage->substr(mResponseMessagePos, rem_len);
    mResponseMessagePos += rem_len;
    mBlkLen = sub_msg.size();
    memcpy(mBlkData, sub_msg.c_str(), rem_len);
    break;
  }

  return OKAY;
}


int cHttpResource::parseResume(cResumeEntry &entry, string &id) {
    bool done = false;
    size_t cur_pos = 0;

    bool have_devid = false;
    bool have_title = false;
    bool have_start = false;
    bool have_resume = false;

    while (!done) {
      size_t pos = mPayload.find('\n', cur_pos);
      if (pos == string::npos) {
	done = true;
	continue;
      }
      size_t pos_col = mPayload.find(':', cur_pos);
      string attr= mPayload.substr(cur_pos, (pos_col- cur_pos));
      string val = mPayload.substr(pos_col +1, (pos - pos_col-1));

      if (attr== "devid") {
	have_devid = true;
	id = val;
      }
      else if (attr == "title") {
	have_title = true;
	entry.mTitle = val;
      }
      else if (attr == "start") {
	have_start = true;
	entry.mStartTime = atoi(val.c_str());
      }
      else if (attr == "resume") {
	have_resume = true;
	entry.mResume = atoi(val.c_str());
      }
      else {
	*(mLog->log())<< DEBUGPREFIX
                    << " parseResume: ERROR: Unknown attr= " << attr
                    << " with val= " << val
		      << endl;
      }
      cur_pos = pos +1;
      if (cur_pos >= mPayload.size())
	done= true;
    }
    if (have_resume && have_start && have_title && have_devid)
      return OKAY;
    else
      return ERROR;
}

int cHttpResource::handlePost() {
  mConnState = SERVING;
  mContentType = MEMBLOCK;

  // sent an empty response message with just the OK header
  mResponseMessage = new string();
  *mResponseMessage = "";
  mResponseMessagePos = 0;

  /*
    Resume support:
    Key for recordings: Title plus start time. Value: Current PlayTime in Sec
    Structure: Either, the plugin reads the list from file when the first client connects
    Question: How to get files into /var/lib/vdr/plugins

    First: Create a list of resumes (use vdr cList ).
    Write the list to file
    Read the list from file
    
   */

  if (mPath.compare("/log") == 0) {
    *(mLog->log())<< mPayload
		  << endl;
  }

  if (mPath.compare("/resume") == 0) {

    string dev_id;
    cResumeEntry entry;
    if (parseResume(entry, dev_id) == ERROR) {
      *(mLog->log())<< DEBUGPREFIX 
		    << " ERROR parsing resume" 
		    << endl;
    }
    *(mLog->log())<< DEBUGPREFIX 
		  << " Resume: id= " << dev_id
		  << " resume= " << entry << endl;
  }

  sendHeaders(200, "OK", NULL, NULL, -1, -1);

  return OKAY;
}


void cHttpResource::sendError(int status, const char *title, const char *extra, const char *text) {
  char f[400];

  mConnState = SERVING;
  mContentType = MEMBLOCK;
  mResponseMessage = new string();
  *mResponseMessage = "";
  mResponseMessagePos = 0;

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


  strcpy(&(mBlkData[mBlkLen]), hdr.c_str());
  mBlkLen += hdr.size();

}


int cHttpResource::sendDir(struct stat *statbuf) {
  char pathbuf[4096];
  char f[400];
  int len;

  mConnState = SERVING;

#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX << " sendDir: mPath= " << mPath << endl;
#endif
  len = mPath.length();
  //  int ret = OKAY;

  if (len == 0 || mPath[len - 1] != '/') {
    snprintf(pathbuf, sizeof(pathbuf), "Location: %s/", mPath.c_str());
    sendError(302, "Found", pathbuf, "Directories must end with a slash.");
    return OKAY;
  }

  snprintf(pathbuf, sizeof(pathbuf), "%sindex.html", mPath.c_str());
  if (stat(pathbuf, statbuf) >= 0) {
    mPath = pathbuf;
    sendFile(statbuf);
  }
  else {
#ifndef DEBUG
    *(mLog->log()) << DEBUGPREFIX << " sendDir: create index.html "  << endl;
#endif
    DIR *dir;
    struct dirent *de;
    
    sendHeaders(200, "OK", NULL, "text/html", -1, statbuf->st_mtime);
    mResponseMessage = new string();
    mResponseMessagePos = 0;
    *mResponseMessage = "";

    string hdr = "";
    snprintf(f, sizeof(f), "<HTML><HEAD><TITLE>Index of %s</TITLE></HEAD>\r\n<BODY>", mPath.c_str());
    hdr += f;
    snprintf(f, sizeof(f), "<H4>Index of %s</H4>\r\n<PRE>\n", mPath.c_str());
    hdr += f;
    snprintf(f, sizeof(f), "Name                             Last Modified              Size\r\n");
    hdr += f;
    snprintf(f, sizeof(f), "<HR>\r\n");
    hdr += f;
    
    *mResponseMessage += hdr;
    hdr = "";
    
    if (len > 1) {
      snprintf(f, sizeof(f), "<A HREF=\"..\">..</A>\r\n");
      hdr += f;
    }
    *mResponseMessage += hdr;
        
    dir = opendir(mPath.c_str());
    while ((de = readdir(dir)) != NULL) {
      char timebuf[32];
      struct tm *tm;
      strcpy(pathbuf, mPath.c_str());
      //	printf (" -Entry: %s\n", de->d_name);
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

      *mResponseMessage += hdr;
    }
    closedir(dir);
    snprintf(f, sizeof(f), "</PRE>\r\n<HR>\r\n<ADDRESS>%s</ADDRESS>\r\n</BODY></HTML>\r\n", SERVER);
    *mResponseMessage += f;

  }

  mRemLength = 0;
  return OKAY;
}


int cHttpResource::writeXmlItem(string name, string link, string programme, string desc, string guid, time_t start, int dur) {
  string hdr = "";
  char f[400];

  hdr += "<item>\n";
  //  snprintf(f, sizeof(f), "%s - %s", );
  hdr += "<title>" + name +"</title>\n";
  hdr += "<link>" +link + "</link>\n";
  hdr += "<guid>" + guid + "</guid>\n";

  hdr += "<programme>" + programme +"</programme>\n";
  hdr += "<description>" + desc + "</description>\n";

  snprintf(f, sizeof(f), "%ld", start);
  hdr += "<start>";
  hdr += f;
  hdr += "</start>\n";

  hdr += "<startstr>";
  if (start != 0) {
    strftime(f, sizeof(f), "%y%m%d %H:%M", localtime(&start));
    hdr += f;
  } 
  else
    hdr += "0 0"; 
  hdr += "</startstr>\n";

  snprintf(f, sizeof(f), "%d", dur);
  hdr += "<duration>";
  hdr += f;
  hdr += "</duration>\n";

  hdr += "</item>\n";

  *mResponseMessage += hdr;

    //  return writeToClient(hdr.c_str(), hdr.size()); 
    return OKAY;
}

int cHttpResource::parseQueryLine (vector<sQueryAVP> *avps) {
  bool done = false;
  size_t cur_pos = 0;
  while (!done) {
    size_t end_pos = mQuery.find('&', cur_pos);
    size_t pos_eq = mQuery.find('=', cur_pos);

    if (pos_eq != cur_pos) {
      avps->push_back(sQueryAVP(mQuery.substr(cur_pos, (pos_eq -cur_pos)), mQuery.substr(pos_eq+1, (end_pos -pos_eq-1)) ));
    }
    if (end_pos == string::npos)
      done = true;
    else
      cur_pos = end_pos +1;
  }

  return OKAY;
}

int cHttpResource::getQueryAttributeValue(vector<sQueryAVP> *avps, string attr, string &val) {
  int found = ERROR;
  for (uint i = 0; i < avps->size(); i++) {
    if ((*avps)[i].attribute == attr) {
      val = (*avps)[i].value;
      found = OKAY;
    }
#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX
		  << " a= " 
		  << (*avps)[i].attribute
		  << " v= " << (*avps)[i].value
		  << endl;
#endif
  }
  return found;
}

int cHttpResource::parseFiles(vector<sFileEntry> *entries, string prefix, string dir_base, string dir_name, struct stat *statbuf) {
  char pathbuf[4096];
  string link;
  //  char f[400];
  //  int len;

  DIR *dir;
  struct dirent *de;
  string dir_comp;
  dir_comp = dir_base + dir_name + "/";

#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX 
		 << " parseFiles: Prefix= " << prefix 
		 << " base= " << dir_base
		 << " dir= " << dir_name 
		 << " comp= " << dir_comp
		 << endl;
#endif

  dir = opendir(dir_comp.c_str());
  while ((de = readdir(dir)) != NULL) {
    if ((strcmp(de->d_name, ".") == 0) or (strcmp(de->d_name, "..") == 0)) {
      continue;
    } 

    strcpy(pathbuf, dir_comp.c_str());
    strcat(pathbuf, de->d_name);
    
    stat(pathbuf, statbuf);

    if (S_ISDIR(statbuf->st_mode)) {
      if (strcmp(&(pathbuf[strlen(pathbuf)-4]), ".rec") == 0) {
	time_t now = time(NULL);
	struct tm tm_r;
	struct tm t = *localtime_r(&now, &tm_r); 
	t.tm_isdst = -1; 
	//	char [20] rest;
	int start = -1;
	sscanf(de->d_name, "%4d-%02d-%02d.%02d%.%02d", &t.tm_year, &t.tm_mon, &t.tm_mday, &t.tm_hour, &t.tm_min);
	t.tm_year -= 1900;
	t.tm_mon--;
	t.tm_sec = 0;
	start = mktime(&t);
	
#ifndef DEBUG
	*(mLog->log()) << DEBUGPREFIX 
		       << " Vdr Folder Found: " << pathbuf << " start= " << start << endl;
#endif

	entries->push_back(sFileEntry(dir_name, pathbuf, start));
      }
      else {
	parseFiles(entries, prefix + de->d_name + "~", dir_comp, de->d_name, statbuf);
      }
    }
    else {
      entries->push_back(sFileEntry(prefix+de->d_name, pathbuf, 1));
    }
  }
  closedir(dir);
  return OKAY;
}

int cHttpResource::sendManifest (struct stat *statbuf, bool is_hls) {
#ifndef STANDALONE

  size_t pos = mPath.find_last_of ("/");

  mDir = mPath.substr(0, pos);
  string mpd_name = mPath.substr(pos+1);
  
  float seg_dur = mFactory->getSegmentDuration() *1.0;
  //  float seg_dur = SEGMENT_DURATION *1.0;


  cRecordings* recordings = &Recordings;
  cRecording* rec = recordings->GetByName(mDir.c_str());  
  float duration = rec->NumFrames() / rec->FramesPerSecond();
  time_t now = time(NULL);

  if (rec->Info() != NULL){
    if (rec->Info()->GetEvent() != NULL) {
      if (rec->Info()->GetEvent()->EndTime() > now) {

	float corr = (now - rec->Info()->GetEvent()->StartTime()) - duration;
	duration = rec->Info()->GetEvent()->Duration() -int(corr);
	  *(mLog->log()) << DEBUGPREFIX 
			 << " is Recording: Duration= " << duration << " sec"
			 << " correction: " << int(corr)
			 << endl;
      }
    }
    else
      *(mLog->log()) << DEBUGPREFIX  << " WARNING: rec-Info()->GetEvent() is NULL " << endl;
  }
  else
    *(mLog->log()) << DEBUGPREFIX  << " WARNING: rec-Info() is NULL " << endl;

  // duration is now either the actual duration of the asset or the target duration of the asset
  int end_seg = int (duration / seg_dur) +1;
  // FIXME: Test Only
  /*  if (rec->FramesPerSecond() > 40)
    end_seg = int (duration *2 / seg_dur) +1;
*/
  *(mLog->log()) << DEBUGPREFIX 
		 << " m3u8 for mDir= " << mDir
		 << " duration= " << duration
		 << " seg_dur= " << seg_dur
		 << " end_seg= " << end_seg
		 << endl;



  if (is_hls) {
    writeM3U8(duration, seg_dur, end_seg);
  }  
  else {
    writeMPD(duration, seg_dur, end_seg);
  }

#endif
  return OKAY;
}

void cHttpResource::writeM3U8(float duration, float seg_dur, int end_seg) {
  mResponseMessage = new string();
  mResponseMessagePos = 0;
  *mResponseMessage = "";
  mContentType = MEMBLOCK;

  mConnState = SERVING;
  char buf[30];

  string hdr = "";

    sendHeaders(200, "OK", NULL, "application/x-mpegURL", -1, -1);

    *mResponseMessage += "#EXTM3U\n";
    //  snprintf(buf, sizeof(buf), "#EXT-X-TARGETDURATION:%d\n", (seg_dur-1));
    snprintf(buf, sizeof(buf), "#EXT-X-TARGETDURATION:%d\n", int(seg_dur));
    hdr = buf;
    *mResponseMessage += hdr;

    *mResponseMessage += "#EXT-X-MEDIA-SEQUENCE:1\n";
    *mResponseMessage += "#EXT-X-KEY:METHOD=NONE\n";
    
    for (int i = 1; i < end_seg; i++){
      //    snprintf(buf, sizeof(buf), "#EXTINF:%.1f,\n", (seg_dur-0.5));
      snprintf(buf, sizeof(buf), "#EXTINF:%.2f,\n", seg_dur);
      hdr = buf;
      *mResponseMessage += hdr;

      snprintf(buf, sizeof(buf), "%d-seg.ts\n", i);
      hdr = buf;
      *mResponseMessage += hdr;
    }
    *mResponseMessage += "#EXT-X-ENDLIST\n";

}

void cHttpResource::writeMPD(float duration, float seg_dur, int end_seg) {
  mResponseMessage = new string();
  mResponseMessagePos = 0;
  *mResponseMessage = "";
  mContentType = MEMBLOCK;

  mConnState = SERVING;
  char buf[30];
  char line[400];

  string hdr = "";

  //  sendHeaders(200, "OK", NULL, "application/xml", -1, -1);

  *mResponseMessage += "<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n";

  snprintf(line, sizeof(line), "<MPD type=\"OnDemand\" minBufferTime=\"PT%dS\" mediaPresentationDuration=\"PT%.1fS\"", 
	   mFactory->getHasMinBufferTime(), duration);
  *mResponseMessage = *mResponseMessage + line;

  //  *mResponseMessage += "<MPD type=\"OnDemand\" minBufferTime=\"PT30S\" mediaPresentationDuration=";

  //  snprintf(buf, sizeof(buf), "\"PT%.1fS\"", duration);
  //  hdr = buf;

  //  *mResponseMessage += hdr + " xmlns:xsi=\"http://www.w3.org/2001/XMLSchema\" xmlns=\"urn:mpeg:mpegB:schema:DASH:MPD:DIS2011\" ";
  *mResponseMessage += " xmlns:xsi=\"http://www.w3.org/2001/XMLSchema\" xmlns=\"urn:mpeg:mpegB:schema:DASH:MPD:DIS2011\" ";
  *mResponseMessage += "xsi:schemaLocation=\"urn:mpeg:mpegB:schema:DASH:MPD:DIS2011\">\n";
  *mResponseMessage += "<ProgramInformation>\n";
  *mResponseMessage += "<ChapterDataURL/>\n";
  *mResponseMessage += "</ProgramInformation>\n";
  *mResponseMessage += "<Period start=\"PT0S\" segmentAlignmentFlag=\"True\">\n"; 

  snprintf(line, sizeof(line), "<Representation id=\"0\" mimeType=\"video/mpeg\" bandwidth=\"%d\" startWithRAP=\"True\" width=\"1280\" height=\"720\" group=\"0\">\n", mFactory->getHasBitrate());
  *mResponseMessage = *mResponseMessage + line;
  //  *mResponseMessage += "<Representation id=\"0\" mimeType=\"video/mpeg\" bandwidth=\"15000000\" startWithRAP=\"True\" width=\"1280\" height=\"720\" group=\"0\">\n";

  //  *mResponseMessage += "<Representation id=\"0\" mimeType=\"video/mpeg\" bandwidth=\"5000000\" startWithRAP=\"True\" width=\"720\" height=\"576\" group=\"0\">\n";

  hdr = "<SegmentInfo duration=";
  snprintf(buf, sizeof(buf), "\"PT%.1fS\"", (seg_dur*1.0));
  hdr = hdr + buf + " >\n";
  *mResponseMessage += hdr;
  
  snprintf(buf, sizeof(buf), "\"%d\"", end_seg);
  *mResponseMessage += "<UrlTemplate sourceURL=\"$Index$-seg.ts\" startIndex=\"1\" endIndex=";
  hdr = buf ;
  *mResponseMessage += hdr + " />\n";
  
  *mResponseMessage += "</SegmentInfo>\n";
  *mResponseMessage += "</Representation>\n";
  *mResponseMessage += "</Period>\n";
  *mResponseMessage += "</MPD>";

  sendHeaders(200, "OK", NULL, "application/xml", mResponseMessage->size(), -1);
}

int cHttpResource::sendMediaSegment (struct stat *statbuf) {
#ifndef STANDALONE

  *(mLog->log()) << DEBUGPREFIX << " sendMediaSegment " << mPath << endl;
  size_t pos = mPath.find_last_of ("/");

  mDir = mPath.substr(0, pos);
  string seg_name = mPath.substr(pos+1);
  int seg_number; 

  int seg_dur = mFactory->getSegmentDuration();
//  int seg_dur = SEGMENT_DURATION;
  int frames_per_seg = 0;

  sscanf(seg_name.c_str(), "%d-seg.ts", &seg_number);

  //FIXME: Do some consistency checks on the seg_number 
  //* Does the segment exist 

  cRecordings* recordings = &Recordings;
  cRecording* rec = recordings->GetByName(mDir.c_str());  
  if (rec != NULL) {
    frames_per_seg = seg_dur * rec->FramesPerSecond();
  }
  else {
    *(mLog->log()) << DEBUGPREFIX << " ERROR: Ooops, rec is NULL, assuming 25 fps "  << endl;
    frames_per_seg = seg_dur * 25;
  }
  //FIXME: HD Fix
  //  frames_per_seg = seg_dur * 25;

  *(mLog->log()) << DEBUGPREFIX 
		 << " mDir= " << mDir
		 << " seg_name= " << seg_name
		 << " seg_number= "<< seg_number
		 << " fps= " << rec->FramesPerSecond()
		 << " frames_per_seg= " << frames_per_seg
		 << endl;
  int start_frame_count = (seg_number -1) * frames_per_seg;

  FILE* idx_file = fopen((mDir +"/index").c_str(), "r");
  if (idx_file == NULL){
    *(mLog->log()) << DEBUGPREFIX
		   << " failed to open idx file = "<< (mDir +"/index").c_str()
		   << endl;
    sendError(404, "Not Found", NULL, "Failed to open Index file");
    return OKAY;
  }

  char *index_buf = new char[(frames_per_seg +3) *8];

  // fseek to start_frame_count * sizeof(in_read)
  fseek(idx_file, start_frame_count * 8, SEEK_SET);

  // read to (seg_number  * frames_per_seg  +1) *  sizeof(in_read)
  // buffersize is frames_per_seg * seg_number * sizeof(in_read)
  int buffered_indexes = fread(index_buf, 8, (frames_per_seg +2), idx_file);

  fclose(idx_file);

  if(buffered_indexes <= 0 ) {
    *(mLog->log())<<DEBUGPREFIX
		  << " issue while reading" << endl;
    sendError(404, "Not Found", NULL, "Failed to read Index file");
    return OKAY;
  }

  // Reading the segment
  mFileStructure = "%s/%05d.ts";
  int start_offset = -1;
  int start_idx = -1;

  tIndexTs in_read_ts;
  memcpy (&in_read_ts, &(index_buf[0]), 8);
  
  start_offset = in_read_ts.offset;
  start_idx = in_read_ts.number;

  char  seg_fn[200];
  mVdrIdx = start_idx;

  snprintf(seg_fn, sizeof(seg_fn), mFileStructure.c_str(), mDir.c_str(), mVdrIdx);
  mPath = seg_fn;

  /*
   * Now we determine the end of the segment
   */
  memcpy (&in_read_ts, &(index_buf[(frames_per_seg)*8]), 8);

  int end_idx = in_read_ts.number;
  int end_offset = in_read_ts.offset;

  /*#ifndef DEBUG*/
  *(mLog->log()) << DEBUGPREFIX
		 << " GenSegment: start (no/idx)= " << start_idx << " / " << start_offset
		 << " to (no/idx)= " << end_idx << " / " << end_offset
		 << endl;
  /*#endif*/

  delete[] index_buf;

  int rem_len = 0;
  bool error = false;
  if (start_idx == end_idx){
    mRemLength = (end_offset - start_offset);

#ifndef DEBUG
    *(mLog->log()) << DEBUGPREFIX
		   << " start_idx == end_idx: mRemLength= " <<mRemLength
		   << endl;
#endif
  }
  else {
    *(mLog->log()) << DEBUGPREFIX
		   << " start_idx < end_idx " 
		   << endl;
    snprintf(seg_fn, sizeof(seg_fn), mFileStructure.c_str(), mDir.c_str(), mVdrIdx);
    if (stat(seg_fn, statbuf) < 0) {
      *(mLog->log()) << DEBUGPREFIX
		     << " file=  " <<seg_fn << " does not exist" 
		     << endl;
      error= true;
      // issue: 
    }
    rem_len = statbuf->st_size - start_offset; // remaining length of the first segment
    for (int idx = (start_idx+1); idx < end_idx; idx ++) {
      snprintf(seg_fn, sizeof(seg_fn), mFileStructure.c_str(), mDir.c_str(), idx);
      if (stat(seg_fn, statbuf) < 0) {
	*(mLog->log()) << DEBUGPREFIX
		       << " for loop file=  " <<seg_fn << " does not exist" 
		       << endl;
	error = true;
	break;
	// issue: 
      }
      rem_len += statbuf->st_size; // remaining length of the first segment
    }
    rem_len += end_offset; // 
    mRemLength = rem_len;
    *(mLog->log()) << DEBUGPREFIX
		   << " start_idx= " << start_idx << " != end_idx= "<< end_idx <<": mRemLength= " <<mRemLength
		   << endl;    
  }

  if (error){
    sendError(404, "Not Found", NULL, "Not all inputs exists");
    return OKAY;
  }
  
  mContentType = VDRDIR;
  if (openFile(seg_fn) != OKAY) {
	*(mLog->log())<< DEBUGPREFIX << " Failed to open file= " << seg_fn 
		      << " mRemLength= " << mRemLength<< endl;
	sendError(404, "Not Found", NULL, "File not found.");
	return OKAY;
  }
  fseek(mFile, start_offset, SEEK_SET);

  sendHeaders(200, "OK", NULL, "video/mpeg", mRemLength, -1);

#endif
  return OKAY;
}

int cHttpResource::sendMediaXml (struct stat *statbuf) {
  char pathbuf[4096];
  string link;
  string media_folder = "/hd2/mpeg";

  mResponseMessage = new string();
  mResponseMessagePos = 0;
  *mResponseMessage = "";
  mContentType = MEMBLOCK;

  mConnState = SERVING;

#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX << " sendMedia "  << endl;  
#endif

  vector<sFileEntry> entries;
  parseFiles(&entries, "", media_folder, "", statbuf);
    
  sendHeaders(200, "OK", NULL, "application/xml", -1, statbuf->st_mtime);

  string hdr = "";
  hdr += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  hdr += "<rss version=\"2.0\">\n";
  hdr+= "<channel>\n";

  *mResponseMessage += hdr;

  hdr = "";

  for (uint i=0; i < entries.size(); i++) {
    
    snprintf(pathbuf, sizeof(pathbuf), "http://%s:%d%s", mServerAddr.c_str(), mServerPort, 
    	     cUrlEncode::doUrlSaveEncode(entries[i].sPath).c_str());
    if (writeXmlItem(cUrlEncode::doXmlSaveEncode(entries[i].sName), pathbuf, "NA", "NA", "-", 
		     entries[i].sStart, -1) == ERROR) 
      return ERROR;

  }
     
  hdr = "</channel>\n";
  hdr += "</rss>\n";
  *mResponseMessage += hdr;
  
  return OKAY;
}

int cHttpResource::sendEpgXml (struct stat *statbuf) {
#ifndef STANDALONE
  char f[400];
  mResponseMessage = new string();
  *mResponseMessage = "";
  mResponseMessagePos = 0;
  mContentType = MEMBLOCK;

  mConnState = SERVING;

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " generating /epg.xml" 
		<< DEBUGHDR << endl;
#endif
  vector<sQueryAVP> avps;
  parseQueryLine(&avps);
  string id = "S19.2E-1-1107-17500";
  if (getQueryAttributeValue(&avps, "id", id) == ERROR){
    *(mLog->log())<< DEBUGPREFIX
		  << " ERROR: id not found" 
		  << DEBUGHDR << endl;
    sendError(400, "Bad Request", NULL, "no id in query line");
    return OKAY;
  }


  /*  for (int i = 0; i < avps.size(); i++) {
    if (avps[i].attribute == "id")
      id = avps[i].value;
    *(mLog->log())<< DEBUGPREFIX
		  << " a= " 
		  << avps[i].attribute
		  << " v= " << avps[i].value
		  << endl;
  }*/
  tChannelID chan_id = tChannelID::FromString (id.c_str());
  if ( chan_id  == tChannelID::InvalidID) {
    *(mLog->log())<< DEBUGPREFIX
		  << " ERROR: Not possible to get the ChannelId from the string" 
		  << DEBUGHDR << endl;
    // ERROR
    // FIXME: Should send a proper error code
    return ERROR;
  }

  cSchedulesLock * lock = new cSchedulesLock(false, 500);
  const cSchedules *schedules = cSchedules::Schedules(*lock);
 
  const cSchedule *schedule = schedules->GetSchedule(chan_id);
  const cEvent * ev = schedule->GetPresentEvent();

  delete lock;
  
  sendHeaders(200, "OK", NULL, "application/xml", -1, statbuf->st_mtime);

  string hdr = "";
  hdr += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  hdr += "<tv version=\"2.0\">\n";
  hdr+= "<programme>\n";

  *mResponseMessage += hdr;
  // Payload here
  
  string title = cUrlEncode::doXmlSaveEncode(ev->Title());
  hdr = "<title>" + title +"</title>\n";
  hdr += "<desc>";
  hdr += cUrlEncode::doXmlSaveEncode(ev->Description());
  hdr += "</desc>\n";

  snprintf(f, sizeof(f), "<start>%ld</start>\n", ev->StartTime());
  hdr += f ;

  snprintf(f, sizeof(f), "<end>%ld</end>\n", ev->EndTime());
  hdr += f;
  *mResponseMessage += hdr;

  hdr = "</programme>\n";
  hdr += "</tv>\n";
  
  *mResponseMessage += hdr;


#endif
  return OKAY;
}

int cHttpResource::sendChannelsXml (struct stat *statbuf) {
#ifndef STANDALONE
  char f[400];
  mResponseMessage = new string();
  *mResponseMessage = "";
  mResponseMessagePos = 0;
  mContentType = MEMBLOCK;

  mConnState = SERVING;

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " generating /channels.xml" 
		<< DEBUGHDR << endl;
#endif

  vector<sQueryAVP> avps;
  parseQueryLine(&avps);
  string mode = "";
  bool add_desc = true; 

  string no_channels_str = "";
  int no_channels = -1;

  if (getQueryAttributeValue(&avps, "mode", mode) == OKAY){
    if (mode == "nodesc") {
      add_desc = false;
      *(mLog->log())<< DEBUGPREFIX
		    << " Mode: No Description"
		    << endl;
    }
    else {
      *(mLog->log())<< DEBUGPREFIX
		    << " Mode: Unknown"
		    << endl;
    }
  }
  if (getQueryAttributeValue(&avps, "channels", no_channels_str) == OKAY){
    no_channels = atoi(no_channels_str.c_str()) ;
  }

  
  sendHeaders(200, "OK", NULL, "application/xml", -1, statbuf->st_mtime);

  string hdr = "";
  hdr += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  hdr += "<rss version=\"2.0\">\n";
  hdr+= "<channel>\n";

  *mResponseMessage += hdr;

  int count = mFactory->getLiveChannels();
  if (no_channels > 0)
    count = no_channels +1;
  
  cSchedulesLock * lock = new cSchedulesLock(false, 500);
  const cSchedules *schedules = cSchedules::Schedules(*lock); 

  for (cChannel *channel = Channels.First(); channel; channel = Channels.Next(channel)) {
    if (channel->GroupSep())
      continue;
    if (--count == 0) {
      break;
    }

    snprintf(f, sizeof(f), "http://%s:3000/%s.ts", mServerAddr.c_str(), *(channel->GetChannelID()).ToString());
    string link = f;

    const cSchedule *schedule = schedules->GetSchedule(channel->GetChannelID());
    string desc = "No description available";
    string title = "Not available"; 
    time_t start_time = 0;
    int duration = 0;
    
    if (schedule != NULL) {
      const cEvent *ev = schedule->GetPresentEvent();
      if (ev != NULL) {
	if ((ev->Description() != NULL) && add_desc)
	  desc = cUrlEncode::doXmlSaveEncode(ev->Description());
	
	if ((ev->Title() != NULL) && add_desc)
	  title = cUrlEncode::doXmlSaveEncode(ev->Title());
	start_time = ev->StartTime();
	duration = ev->Duration();
      }
      else {
	*(mLog->log())<< DEBUGPREFIX
		      << " Event Info is Zero for Count= " 
		      << count 
		      << " Name= " << channel->Name() << endl;	
      }
    }
    else {
      *(mLog->log())<< DEBUGPREFIX
		    << " Schedule is Zero for Count= " 
		    << count 
		    << " Name= " << channel->Name() << endl;
    }

    if (writeXmlItem(channel->Name(), link, title, desc, *(channel->GetChannelID()).ToString(), start_time, duration) == ERROR) 
      return ERROR;

  }

  hdr = "</channel>\n";
  hdr += "</rss>\n";
  
  *mResponseMessage += hdr;
  delete lock;

#endif
  return OKAY;
}

int cHttpResource::sendRecordingsXml(struct stat *statbuf) {
#ifndef STANDALONE
  mResponseMessage = new string();
  *mResponseMessage = "";
  mResponseMessagePos = 0;
  mContentType = MEMBLOCK;

  mConnState = SERVING;

  vector<sQueryAVP> avps;
  parseQueryLine(&avps);
  string model = "";
  string link_ext = "";
  string type = "";
  string has_4_hd_str = "";
  bool has_4_hd = true;
  
  if (getQueryAttributeValue(&avps, "model", model) == OKAY){
    *(mLog->log())<< DEBUGPREFIX
		  << " Found a Model Parameter: " << model
		  << endl;
    if (model == "samsung") 
      link_ext = "/manifest-seg.m3u8|COMPONENT=HLS";
  }

  if (getQueryAttributeValue(&avps, "type", type) == OKAY){
    *(mLog->log())<< DEBUGPREFIX
		  << " Found a Type Parameter: " << type
		  << endl;
    if (type == "hls") { 
      if (model == "samsung") 
	link_ext = "/manifest-seg.m3u8|COMPONENT=HLS";
      else
	link_ext = "/manifest-seg.m3u8";
    }
    if (type == "has") {
      if (model == "samsung") 
	link_ext = "/manifest-seg.mpd|COMPONENT=HAS";
      else
	link_ext = "/manifest-seg.mpd";
    }
  }

  if (getQueryAttributeValue(&avps, "has4hd", has_4_hd_str) == OKAY){
    *(mLog->log())<< DEBUGPREFIX
		  << " Found a Has4Hd Parameter: " << has_4_hd_str
		  << endl;
    if (has_4_hd_str == "false")
      has_4_hd = false;
  }


#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " generating /recordings.xml" 
		<< DEBUGHDR << endl;
#endif
  sendHeaders(200, "OK", NULL, "application/xml", -1, statbuf->st_mtime);

  string hdr = "";
  hdr += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  hdr += "<rss version=\"2.0\">\n";
  hdr+= "<channel>\n";

  *mResponseMessage += hdr;

  
  if (writeXmlItem("HAS - Big Bugs Bunny", "http://192.168.1.122/sm/BBB-DASH/HAS_BigBuckTS.xml|COMPONENT=HAS", "NA", "Big Bucks Bunny - HAS", 
		   "-", 0, 0) == ERROR) 
    return ERROR;

  if (writeXmlItem("HLS - Big Bugs Bunny", "http://192.168.1.122/sm/BBB-DASH/HLS_BigBuckTS.m3u8|COMPONENT=HLS", "NA", "Big Bucks Bunny - HLS", 
		   "-", 0, 0) == ERROR) 
    return ERROR;


  //--------------------
  cRecordings* recordings = &Recordings;
  //  char buff[20];
  char f[600];

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " recordings->Count()= " << recordings->Count()
		<< DEBUGHDR << endl;
#endif

  // List of recording timer
  time_t now = time(NULL);

  vector<sTimerEntry> act_rec;
#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " checking avtive timer"
		<< endl;
#endif
  for (cTimer * ti = Timers.First(); ti; ti = Timers.Next(ti)){
    ti->Matches();

    if (ti->HasFlags(tfRecording) ) {
      if (ti->Event() == NULL) {
	*(mLog->log()) << DEBUGPREFIX 
		       << " WARNING: Active recording for " << ti->File()
		       << " is skipped (No Event()" << endl;
	continue;
      }
      *(mLog->log()) << DEBUGPREFIX 
		     << " Active Timer: " << ti->File() 
		     << " Start= " << ti->Event()->StartTime() 
		     << " Duration= " << ti->Event()->Duration()
		     << endl;
      act_rec.push_back(sTimerEntry(ti->File(), ti->Event()->StartTime(), ti->Event()->Duration()));
    }
  }

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " Found " << act_rec.size()
		<< " running timers"
		<< endl;
#endif

  int rec_dur = 0;
  for (cRecording *recording = recordings->First(); recording; recording = recordings->Next(recording)) {
    hdr = "";

    if (recording->IsPesRecording() or ((recording->FramesPerSecond() > 30.0) and !has_4_hd )) 
      snprintf(f, sizeof(f), "http://%s:%d%s", mServerAddr.c_str(), mServerPort, 
	       cUrlEncode::doUrlSaveEncode(recording->FileName()).c_str());
    else
      snprintf(f, sizeof(f), "http://%s:%d%s%s", mServerAddr.c_str(), mServerPort, 
	       cUrlEncode::doUrlSaveEncode(recording->FileName()).c_str(), link_ext.c_str());

    string link = f;
    string desc = "No description available";
    rec_dur = recording->LengthInSeconds();

    string name = recording->Name();

    for (uint x = 0; x < act_rec.size(); x++) {
      if (act_rec[x].name == name) {

	*(mLog->log())<< DEBUGPREFIX
		      << " !!!!! Found active Recording !!! "
		      << endl;
	//	link += "/hm-seg.m3u8";
	rec_dur +=  (act_rec[x].startTime + act_rec[x].duration - now);
	

      }
    } // for

    if (recording->Info() != NULL) {
      if (recording->Info()->Description() != NULL) {
	desc = cUrlEncode::doXmlSaveEncode(recording->Info()->Description());
      }

    }

    if (writeXmlItem(cUrlEncode::doXmlSaveEncode(recording->Name()), link, "NA", desc, "-", 
		     recording->Start(), rec_dur) == ERROR) 
      return ERROR;

  }

  hdr = "</channel>\n";
  hdr += "</rss>\n";
  
  *mResponseMessage += hdr;


#endif
  return OKAY;
}

int cHttpResource::sendRecordingsHtml(struct stat *statbuf) {
#ifndef STANDALONE
  mResponseMessage = new string();
  mResponseMessagePos = 0;
  *mResponseMessage = "";
  mContentType = MEMBLOCK;

  mConnState = SERVING;

  sendHeaders(200, "OK", NULL, "text/html", -1, statbuf->st_mtime);

  string hdr = "";
  hdr += "<HTML><HEAD><TITLE>Recordings</TITLE></HEAD>\r\n";
  hdr += "<meta http-equiv=\"content-type\" content=\"text/html;charset=UTF-8\"/>\r\n";
  hdr += "<BODY>";
  hdr += "<H4>Recordings</H4>\r\n<PRE>\n";
  hdr += "<HR>\r\n";

  *mResponseMessage += hdr;

  char buff[20];
  char f[400];
  for (cRecording *recording = Recordings.First(); recording; recording = Recordings.Next(recording)) {
    hdr = "";
    strftime(buff, 20, "%Y-%m-%d %H:%M:%S", localtime(&recording->start));
    snprintf(f, sizeof(f), "%s - %d <A HREF=\"%s\">%s</A>\r\n", buff, recording->HierarchyLevels(), recording->FileName(),  recording->Name());
    hdr += f;
    *mResponseMessage += hdr;
    // start is time_t
  }
#endif
  return OKAY;
}


int cHttpResource::sendVdrDir(struct stat *statbuf) {
#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX  << " *** sendVdrDir mPath= "  << mPath  << endl;
#endif  
  char pathbuf[4096];
  char f[400];
  int vdr_idx = 0;
  off_t total_file_size = 0; 
  //  int ret = OKAY;
  string vdr_dir = mPath;
  vector<sVdrFileEntry> file_sizes;
  bool more_to_go = true;

  checkRecording();

  mVdrIdx = 1;
  mFileStructure = "%s/%03d.vdr";

  if (mPath.compare(mPath.size() - 9, 9, "99.99.rec") != 0) {
    mFileStructure = "%s/%05d.ts";
#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX  << " using dir format: " << mFileStructure.c_str() << endl;
#endif
  }

  // --- looup all vdr files in the dir ---
  while (more_to_go) {
    vdr_idx ++;
    snprintf(pathbuf, sizeof(pathbuf), mFileStructure.c_str(), mPath.c_str(), vdr_idx);
    if (stat(pathbuf, statbuf) >= 0) {
#ifndef DEBUG
      *(mLog->log())<< " found for " <<   pathbuf << endl;
#endif
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
    return OKAY;
  }

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
       << " vdr filesize list " 
       << DEBUGHDR << endl;
  for (uint i = 0; i < file_sizes.size(); i++)
    *(mLog->log())<< " i= " << i << " size= " << file_sizes[i].sSize << " firstOffset= " << file_sizes[i].sFirstOffset << endl;
  *(mLog->log())<< " total_file_size= " << total_file_size << endl << endl;
#endif

  // total_file_size (on disk)
  
  // ---------------- file sizes ---------------------

  uint cur_idx = 0;

#ifndef DEBUG
    if (mIsRecording) {
      snprintf(f, sizeof(f), " CurFileSize= %lld mRecProgress= %f ExtFileSize= %lld", total_file_size, mRecProgress, (long long int)(mRecProgress * total_file_size));
      *(mLog->log()) << DEBUGPREFIX
		     << endl << " isRecording: " << f 
		     << endl;      
    }
#endif

  if (!rangeHdr.isRangeRequest) {
    snprintf(pathbuf, sizeof(pathbuf), mFileStructure.c_str(), mPath.c_str(), file_sizes[cur_idx].sIdx);

    if (openFile(pathbuf) != OKAY) {
      sendError(403, "Forbidden", NULL, "Access denied.");
      return OKAY;
    }

    mRemLength = total_file_size;

    sendHeaders(200, "OK", NULL, "video/mpeg", ((mIsRecording) ? (mRecProgress * total_file_size): total_file_size ), statbuf->st_mtime);
  }
  else { // Range request
    // idenify the first file
#ifndef DEBUG
    *(mLog->log()) << DEBUGPREFIX
		   << endl <<" --- Range Request Handling ---" 
		   << DEBUGHDR << endl;
#endif
    if (mIsRecording && (rangeHdr.begin > total_file_size)) {
      *(mLog->log()) << DEBUGPREFIX
		     << " ERROR: Not yet available" << endl;     
      sendError(404, "Not Found", NULL, "File not found.");
      return OKAY;
    }
    cur_idx = file_sizes.size() -1;
    for (uint i = 1; i < file_sizes.size(); i++) {
      if (rangeHdr.begin < file_sizes[i].sFirstOffset  ) {
	cur_idx = i -1;
	break;
      }
    }

#ifndef DEBUG
    *(mLog->log())<< " Identified Record i= " << cur_idx << " file_sizes[i].sFirstOffset= " 
	 << file_sizes[cur_idx].sFirstOffset << " rangeHdr.begin= " << rangeHdr.begin 
	 << " vdr_no= " << file_sizes[cur_idx].sIdx << endl;
#endif

    mVdrIdx = file_sizes[cur_idx].sIdx;
    snprintf(pathbuf, sizeof(pathbuf), mFileStructure.c_str(), mPath.c_str(), file_sizes[cur_idx].sIdx);
#ifndef DEBUG
    *(mLog->log())<< " file identified= " << pathbuf << endl;
#endif
    if (openFile(pathbuf) != OKAY) {
      *(mLog->log())<< "----- fopen failed dump ----------" << endl;
      *(mLog->log())<< DEBUGPREFIX
		    << " vdr filesize list " 
		    << DEBUGHDR << endl;
      for (uint i = 0; i < file_sizes.size(); i++)
	*(mLog->log())<< " i= " << i << " size= " << file_sizes[i].sSize << " firstOffset= " << file_sizes[i].sFirstOffset << endl;
      *(mLog->log())<< " total_file_size= " << total_file_size << endl << endl;
      
      *(mLog->log())<< " Identified Record i= " << cur_idx << " file_sizes[i].sFirstOffset= " 
		    << file_sizes[cur_idx].sFirstOffset << " rangeHdr.begin= " << rangeHdr.begin 
		    << " vdr_no= " << file_sizes[cur_idx].sIdx << endl;
      *(mLog->log())<< "---------------" << endl;
      sendError(403, "Forbidden", NULL, "Access denied.");
      return OKAY;
    }
    mDir = mPath;
    mPath = pathbuf;
#ifndef DEBUG
    *(mLog->log())<< " Seeking into file= " << (rangeHdr.begin - file_sizes[cur_idx].sFirstOffset) 
	 << " cur_idx= " << cur_idx
	 << " file_sizes[cur_idx].sFirstOffset= " << file_sizes[cur_idx].sFirstOffset
	 << endl;
#endif
    fseek(mFile, (rangeHdr.begin - file_sizes[cur_idx].sFirstOffset), SEEK_SET);
    if (rangeHdr.end == 0)
      rangeHdr.end = ((mIsRecording) ? (mRecProgress * total_file_size): total_file_size);

    mRemLength = (rangeHdr.end-rangeHdr.begin);

    snprintf(f, sizeof(f), "Content-Range: bytes %lld-%lld/%lld", rangeHdr.begin, (rangeHdr.end -1), 
    	     ((mIsRecording) ? (long long int)(mRecProgress * total_file_size): total_file_size));
    
    sendHeaders(206, "Partial Content", f, "video/mpeg", (rangeHdr.end-rangeHdr.begin), statbuf->st_mtime);
  }

#ifndef DEBUG
  *(mLog->log())<< " ***** Yes, vdr dir found ***** mPath= " << mPath<< endl;
#endif

  return OKAY; // handleRead() done
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
    *(mLog->log())<< DEBUGPREFIX << " " << f;
    hdr += f;
  }
  if (mime) {
    snprintf(f, sizeof(f), "Content-Type: %s\r\n", mime);
    hdr += f;
  }
  if (length >= 0) {
    snprintf(f, sizeof(f), "Content-Length: %lld\r\n", length);
    *(mLog->log())<< DEBUGPREFIX << " " << f << endl;
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


  if (mBlkLen != 0) {
    *(mLog->log())<< DEBUGPREFIX
		  << " ERROR in SendHeader: mBlkLen != 0!!!  --> Overwriting" << endl;
  }
  mBlkLen = hdr.size();
  strcpy(mBlkData, hdr.c_str());

}

int cHttpResource::sendFile(struct stat *statbuf) {
  // Send the First Datachunk, incl all headers

  *(mLog->log())<< "fd= " <<  mFd << " mReqId= "<< mReqId << " mPath= " << mPath 
       << DEBUGHDR
       << endl;

  char f[400];

  if (openFile(mPath.c_str()) == ERROR) {
    sendError(403, "Forbidden", NULL, "Access denied.");
    return OKAY;
  }
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

#ifndef DEBUG
    *(mLog->log())<< "fd= " <<  mFd << " mReqId= "<< mReqId 
	 << ": Done mRemLength= "<< mRemLength << " ret= " << ret 
	 << DEBUGHDR << endl;
#endif
    mConnState = SERVING;

  }
  return ret;

}

const char *cHttpResource::getMimeType(const char *name) {
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
  if (strcmp(ext, ".ts") == 0) return "video/mpeg";
  if (strcmp(ext, ".mpd") == 0) return "application/dash+xml";  
  if (strcmp(ext, ".xml") == 0) return "application/xml";  
  if (strcmp(ext, ".mpeg") == 0 || strcmp(ext, ".mpg") == 0) return "video/mpeg";
  if (strcmp(ext, ".mp3") == 0) return "audio/mpeg";
  return NULL;
}


string cHttpResource::getConnStateName() {
  string state_string;
  switch (mConnState) {
  case WAITING:
    state_string = "WAITING";
    break;
  case READHDR:
    state_string = "READ Req HDR";
    break;
  case READPAYLOAD:
    state_string = "READ Req Payload";
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

int cHttpResource::parseHttpRequestLine(string line) {
  mMethod = line.substr(0, line.find_first_of(" "));
  mRequest = line.substr(line.find_first_of(" ") +1, (line.find_last_of(" ") - line.find_first_of(" ") -1));
  mVersion = line.substr(line.find_last_of(" ") +1);
#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " ReqLine= " << line << endl;
#endif
  if (mVersion.compare(0, 4, "HTTP") != 0) {
#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX
		<< " ERROR: No HTTP request -> Closing Connection" << line << endl;
#endif
    return ERROR;
  }

  size_t pos = mRequest.find('?');
  if (pos != string::npos)
    mQuery = mRequest.substr (pos+1, string::npos);
  mPath = cUrlEncode::doUrlSaveDecode(mRequest.substr(0, mRequest.find('?')));
  *(mLog->log())<< DEBUGPREFIX
		<< " mMethod= " << mMethod 
		<< " mPath= " << mPath
		<< " mVer= " << mVersion 
		<< " mQuery= " << mQuery 
    //		      << " HexDump= " << endl << cUrlEncode::hexDump(mPath) << endl
		<< endl;
  return OKAY;
}

int cHttpResource::parseHttpHeaderLine (string line) {
  string hdr_name = line.substr(0, line.find_first_of(":"));
  string hdr_val = line.substr(line.find_first_of(":") +2);
  
  if (hdr_name.compare("Range") == 0) {
    parseRangeHeaderValue(hdr_val);
    *(mLog->log()) << DEBUGPREFIX
		   << " Range:  Begin= " << rangeHdr.begin 
		   << "  End= " << rangeHdr.end
		   << endl; 
  }
  if (hdr_name.compare("User-Agent") == 0) {
    mUserAgent = hdr_val;
    *(mLog->log())<< " User-Agent:  " << hdr_val 
		  << endl; 
  }
  if (hdr_name.compare("Content-Length") == 0) {
    mReqContentLength = atoll(hdr_val.c_str());
#ifndef DEBUG
    *(mLog->log())<< " Content-Length: " << mReqContentLength 
		  << endl; 
#endif
  }
  return 0;
}

void cHttpResource::checkRecording() {
  // sets mIsRecording to true when the recording is still on-going
  mIsRecording = false;
  time_t now = time(NULL);

#ifndef STANDALONE

  //  cRecordings* recordings = mFactory->getRecordings();
  cRecordings* recordings = &Recordings;
#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX 
		<< " GetByName(" <<mPath.c_str() << ")"
		<< endl;
#endif
  cRecording* rec = recordings->GetByName(mPath.c_str());  
  if (rec != NULL) {
    const cEvent *ev = rec->Info()->GetEvent();
    if (ev != NULL) {
      if (now  < ev->EndTime()) {
	// still recording
	mIsRecording = true;

	// mRecProgress * curFileSize = estimated File Size
	mRecProgress = (ev->EndTime() - ev->StartTime()) *1.1 / (rec->NumFrames() / rec->FramesPerSecond()); 
	//	mRecProgress = (ev->EndTime() - ev->StartTime()) *1.0/ (now - ev->StartTime());
#ifndef DEBUG
	*(mLog->log())<< DEBUGPREFIX
		      << " **** is still recording for mIsRecording= " 
		      << mIsRecording 
		      << " mRecProgress= " << mRecProgress << endl;
#endif
      }
    }

#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX  
		  << " checking, whether recording is on-going"
		  << " now= " << now << " start= " << rec->Start()
		  << " curDur= " << rec->LengthInSeconds()
		  << endl;
#endif
  }
#ifndef DEBUG
  else {
    *(mLog->log())<< DEBUGPREFIX
		  << " **** Recording Entry Not found **** " << endl;
  }
#endif
#endif
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
  return 0;
}

int cHttpResource::openFile(const char *name) {
  mFile = fopen(name, "r");
  if (!mFile) {
    *(mLog->log())<< DEBUGPREFIX
	 << " fopen failed pathbuf= " << name 
	 << endl;
    //    sendError(403, "Forbidden", NULL, "Access denied.");
    return ERROR;
  }
  return OKAY;
}

