/*
 * httpresource.c: VDR on Smart TV plugin
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
#include <sstream>
#include <iostream>
#include <vector>
#include "httpresource.h"
#include "smarttvfactory.h"
#include "stvw_cfg.h"
#include "mngurls.h"
#include "url.h"
#include "responsebase.h"
#include "responsefile.h"
#include "responsevdrdir.h"
#include "responsememblk.h"
#include "responselive.h"

#ifndef STANDALONE
#include <vdr/recording.h>
#include <vdr/channels.h>
#include <vdr/timers.h>
#include <vdr/videodir.h>
#include <vdr/epg.h>

#else
//standalone
#include <netinet/in.h>
#include <arpa/inet.h>
#endif


//TODO: Should I increase the MAXLEN from 4k to 64k?
//#define MAXLEN 4096 
//#define MAXLEN 32768 
#define OKAY 0
#define ERROR (-1)
#define DEBUG_REGHEADERS
#define DEBUGPREFIX mLog->getTimeString() << ": mReqId= " << mReqId << " fd= " << mFd 
#define DEBUGHDR " " <<  __PRETTY_FUNCTION__ << " (" << __LINE__ << ") "

#define DEBUG

#define SEGMENT_DURATION 10

using namespace std;



cHttpResource::cHttpResource(int f, int id, int port, SmartTvServer* factory): cHttpResourceBase(f, id, port, factory),
  mLog(), mConnTime(0), mHandleReadCount(0),  
  mConnected(true), mConnState(WAITING), mReadBuffer(), mMethod(),  
									       //  mBlkData(NULL), mBlkPos(0), mBlkLen(0), 
  mPath(), mVersion(), protocol(), mReqContentLength(0),
  mPayload(), mUserAgent(),
  mAcceptRanges(true), rangeHdr(), mResponse(NULL) {

  mLog = Log::getInstance();
  mPath = "";
  mConnTime = time(NULL);
  setNonBlocking();
  //  mBlkData = new char[MAXLEN];

#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX 
		 << " cHttpResource created" << endl;
#endif
}


cHttpResource::~cHttpResource() {
#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX 
		 << " cHttpResource destroyed"        
		 << endl;
#endif
  //  delete[] mBlkData;
  if (mResponse != NULL)
    delete mResponse;
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
		     << "mConnState= " << getConnStateName()
		     << endl;
      return ERROR;
    }
    break;
  case TOCLOSE:
    return ERROR;
    break;
  case SERVING:
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
  //  bool is_req = true;
  string rem_hdr = "";

  buflen = read(mFd, buf, sizeof(buf));

  if (buflen == -1) {
    *(mLog->log())<< " Some Error, no data received" << endl;
    return ERROR; // Nothing to read
  }

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
      mFactory->setWriteFlag(mFd);
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
	  mFactory->setWriteFlag(mFd);
	  return processRequest();
	}
      } // if(content_length != 0)
      else {
	mConnState = SERVING;
	mFactory->setWriteFlag(mFd);
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
	//	is_req = false;
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
  bool ok_to_serve = false;

  if (mMethod.compare("POST")==0) {
    return handlePost();
  }

  if (!((strcasecmp(mMethod.c_str(), "GET") == 0) or (strcasecmp(mMethod.c_str(), "HEAD") == 0))) {
    mResponse = new cResponseError(this, 501, "Not supported", NULL, "Method is not supported.");
    //    ((cResponseError*)mResponse)->sendError(501, "Not supported", NULL, "Method is not supported.");
    return OKAY;
  }

#ifndef STANDALONE
  if (mPath.compare("/recordings.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendRecordingsXml( &statbuf);
    return OKAY;
  }

  if (mPath.compare("/channels.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendChannelsXml( &statbuf);
    return OKAY;
  }

  if (mPath.compare("/epg.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendEpgXml( &statbuf);
    return OKAY;
  }

  if (mPath.compare("/timers.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendTimersXml();
    return OKAY;
  }

  if (mPath.compare("/reccmds.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendRecCmds();
    return OKAY;
  }
  if (mPath.compare("/execreccmd") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveExecRecCmdReq();
    return OKAY;
  }

  if (mPath.compare("/cmds.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendCmds();
    return OKAY;
  }
  if (mPath.compare("/execcmd") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveExecCmdReq();
    return OKAY;
  }

  if (mPath.compare("/setResume.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveResume();
    return OKAY;
  }

  if (mPath.compare("/getResume.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendResumeXml();
    return OKAY;
  }

  if (mPath.compare("/getMarks.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendMarksXml();
    return OKAY;
  }

  if (mPath.compare("/vdrstatus.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendVdrStatusXml( &statbuf);
    return OKAY;
  }

  //thlo for testing purpose
  if (mPath.compare("/deleteTimer") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveDelTimerReq();
    return OKAY;
  }

  //thlo for testing purpose

  if (mPath.compare("/activateTimer") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveActTimerReq();
    return OKAY;
  }

  if (mPath.compare("/addTimer") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveAddTimerReq();
    return OKAY;
  }

#endif

  if (mPath.compare("/deleteFile") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveDelFileReq();
    return OKAY;
  }


  if (mPath.compare("/serverName.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendServerNameXml( );
    return OKAY;
  }


  if (mPath.compare("/yt-bookmarklet.js") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendYtBookmarkletJs();
    return OKAY;
  }

  if (mPath.compare("/bmlet-inst.html") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendBmlInstHtml();
    return OKAY;
  }

  if (mPath.compare("/media.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendMediaXml( &statbuf);
    return OKAY;
  }

  if (mPath.compare("/clients") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveClientInfo();
    return OKAY;
  }

  if (mPath.compare("/widget.conf") == 0) {
    mPath = mFactory->getConfigDir() + "/widget.conf";

    if (stat(mPath.c_str(), &statbuf) < 0) {
      mResponse = new cResponseError(this, 404, "Not Found", NULL, "003 File not found.");
      //      ((cResponseError*)mResponse)->sendError(404, "Not Found", NULL, "File not found.");
      return OKAY;
    }

    mResponse = new cResponseFile(this);
    return ((cResponseFile*)mResponse)->sendFile();
    //    mContentType = SINGLEFILE;
    //    mFileSize = statbuf.st_size;
    //    return sendFile(&statbuf);
  }

  if (mPath.compare("/favicon.ico") == 0) {
    mPath = mFactory->getConfigDir() + "/web/favicon.ico";

    if (stat(mPath.c_str(), &statbuf) < 0) {
      mResponse = new cResponseError(this, 404, "Not Found", NULL, "003 File not found.");
      //      ((cResponseError*)mResponse)->sendError(404, "Not Found", NULL, "File not found.");
      return OKAY;
    }
    mResponse = new cResponseFile(this);
    return ((cResponseFile*)mResponse)->sendFile();
    //    mFileSize = statbuf.st_size;
    //    mContentType = SINGLEFILE;
    //    return sendFile(&statbuf);
  }

  if (mPath.compare("/urls.xml") == 0) {

    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendUrlsXml();
    return OKAY;
  }

  if (mPath.size() > 8) {
    if (mPath.compare(mPath.size() -8, 8, "-seg.mpd") == 0) {
      mResponse = new cResponseMemBlk(this);
      ((cResponseMemBlk*)mResponse)->sendManifest( &statbuf, false);
      return OKAY;
    }
  }

  if (mPath.size() > 9) {
    if (mPath.compare(mPath.size() -9, 9, "-seg.m3u8") == 0) {
      mResponse = new cResponseMemBlk(this);
      ((cResponseMemBlk*)mResponse)->sendManifest( &statbuf, true);
      return OKAY;
    }
  }

  if (mPath.size() > 7) {
    if (mPath.compare(mPath.size() -7, 7, "-seg.ts") == 0) {

      mResponse = new cResponseVdrDir(this);
      ((cResponseVdrDir*)mResponse)->sendMediaSegment( &statbuf);
      return OKAY;
    }
  }

  if (mPath.find("/web/", 0, 5) == 0) {
    mPath = mFactory->getConfigDir() + mPath;
    *(mLog->log())<< DEBUGPREFIX
		  << " Found web request. serving " << mPath << endl;
    ok_to_serve = true;    
  }

  if (mPath.find("/live/", 0, 6) == 0) {
    *(mLog->log())<< DEBUGPREFIX
		  << " Found live request. serving " << mPath 
		  << endl;
    mResponse = new cResponseLive(this, mPath.substr(6));
    //((cResponseVdrDir*)mResponse)->sendMediaSegment( &statbuf);
    return OKAY;
    
  }

#if VDRVERSNUM >= 20102
  if (mPath.compare(0, strlen(cVideoDirectory::Name()), cVideoDirectory::Name()) == 0) {
#else
  if (mPath.compare(0, strlen(VideoDirectory), VideoDirectory) == 0) {
#endif
    *(mLog->log())<< DEBUGPREFIX
		  << " Found video dir request. serving " << mPath << endl;
    ok_to_serve = true;    
  }

  if (stat(mPath.c_str(), &statbuf) < 0) {
    // checking, whether the file or directory exists 
    *(mLog->log())<< DEBUGPREFIX
                  << " File Not found " << mPath << endl;
    mResponse = new cResponseError(this, 404, "Not Found", NULL, "003 File not found.");
    //    ((cResponseError*)mResponse)->sendError(404, "Not Found", NULL, "File not found.");
    
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

	mResponse = new cResponseVdrDir(this);
	return ((cResponseVdrDir*)mResponse)->sendVdrDir( &statbuf);
	//	mContentType = VDRDIR;
	//	return sendVdrDir( &statbuf);
      }
    }

    if (!((ok_to_serve) or (mPath.compare(0, (mFactory->getConfig()->getMediaFolder()).size(), mFactory->getConfig()->getMediaFolder()) == 0)))  {
      // No directory access outside of MediaFolder (and also VDRCONG/web)
      mResponse = new cResponseError(this, 404, "Not Found", NULL, "003 File not found.");
      //      ((cResponseError*)mResponse)->sendError(404, "Not Found", NULL, "File not found.");
      return OKAY;
    }

    //    mContentType = MEMBLOCK;
    string tmp = mPath + "index.html";
    //    snprintf(pathbuf, sizeof(pathbuf), "%sindex.html", mRequest->mPath.c_str());
    //    if (stat(pathbuf, statbuf) >= 0) {
    if (stat(tmp.c_str(), &statbuf) >= 0) {
      mPath = tmp;
      mResponse = new cResponseFile(this);
      return ((cResponseFile*)mResponse)->sendFile();
    }
    else {
      mResponse = new cResponseMemBlk(this);
      ((cResponseMemBlk*)mResponse)->sendDir( &statbuf);
      return OKAY;    
    }
  }
  else {
    // mPath is not a folder, thus it is a file
#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX
		  << " processRequest: file send\n";
#endif

    // Check, if requested file is in Media Directory
    if (!((ok_to_serve) or (mPath.compare(0, (mFactory->getConfig()->getMediaFolder()).size(), mFactory->getConfig()->getMediaFolder()) == 0)))  {
      mResponse = new cResponseError(this, 404, "Not Found", NULL, "003 File not found.");
      //      ((cResponseError*)mResponse)->sendError(404, "Not Found", NULL, "File not found.");
      return OKAY;
    }

    mResponse = new cResponseFile(this);
    return ((cResponseFile*)mResponse)->sendFile();
    //    mFileSize = statbuf.st_size;
    //mContentType = SINGLEFILE;
    //return sendFile(&statbuf);
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
  
  if (mResponse->isBlkWritten()) {
    // note the mBlk may be filled with header info first.
    if (mResponse->fillDataBlk() != OKAY) {
      return ERROR;
    }
    if (mResponse->mBlkLen == 0) {
      return OKAY;
    }
  }
  
  if (mResponse->writeData(mFd) <=0)    {

#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX
		  << " close in write: Stopped (Client terminated Connection)"
		  << " mBlkPos= " << mResponse->mBlkPos << " mBlkLen= " << mResponse->mBlkLen
		  << DEBUGHDR << endl;
#endif
    mConnState = TOCLOSE;
    mConnected = false;
    return ERROR;
  }
  //  mResponse->mBlkPos += this_write;

  return OKAY;
}



int cHttpResource::handlePost() {
  mConnState = SERVING;
  mFactory->setWriteFlag(mFd);

  if (mPath.compare("/log") == 0) {
    *(mLog->log()) << mLog->getTimeString() << ": "
		   << mPayload
		   << endl;

    mResponse = new cResponseOk(this, 200, "OK", NULL, NULL, -1, -1);
    //    ((cResponseError*)mResponse)->sendHeaders(200, "OK", NULL, NULL, -1, -1);
    return OKAY;
  }

  if (mPath.compare("/getResume.xml") == 0) {

    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->sendResumeXml( );
    return OKAY;
  }

  if (mPath.compare("/setResume.xml") == 0) {

    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveResume();
    return OKAY;
  }

  if (mPath.compare("/setYtUrl") == 0) {

    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveYtUrl();
    return OKAY;
  }

  if (mPath.compare("/deleteYtUrl") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveDelYtUrl();
    return OKAY;
  }

  if (mPath.compare("/deleteFile") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveDelFileReq();
    return OKAY;
  }

  if (mPath.compare("/deleteRecording.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveDelRecReq();
    return OKAY;
  }
  if (mPath.compare("/execreccmd") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveExecRecCmdReq();
    return OKAY;
  }

  if (mPath.compare("/execcmd") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveExecCmdReq();
    return OKAY;
  }

  if (mPath.compare("/deleteTimer.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveDelTimerReq();
    return OKAY;
  }

  if (mPath.compare("/addTimer.xml") == 0) {
    mResponse = new cResponseMemBlk(this);
    ((cResponseMemBlk*)mResponse)->receiveAddTimerReq();
    return OKAY;
  }


  // Should not reach the end of the function
  return ERROR;
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



// common for all mem functions
//string cHttpResource::getOwnIp(int fd) {
string cHttpResource::getOwnIp() {
  struct sockaddr_in sock;
  socklen_t len_inet = sizeof(sock);
  int ret = getsockname(mFd, (struct sockaddr *)&sock, &len_inet);  
  if ( ret == -1 ) {  
    *(mLog->log()) << "Error: Cannot obtain own ip address" << endl;
    return string("0.0.0.0");
  }  
  return string (inet_ntoa(sock.sin_addr));
}

