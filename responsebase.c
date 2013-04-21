/*
 * responsebase.c: VDR on Smart TV plugin
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


#include "responsebase.h"
#include "httpresource.h"
#include "smarttvfactory.h"
#include "log.h"

#define DEBUGPREFIX "mReqId= " << mRequest->mReqId << " fd= " << mRequest->mFd 
#define OKAY 0
#define ERROR (-1)
#define DEBUG

#define PROTOCOL "HTTP/1.1"
#define RFC1123FMT "%a, %d %b %Y %H:%M:%S GMT"



cResponseBase::cResponseBase(cHttpResource* req): mBlkData(NULL), mBlkPos(0), mBlkLen(0), mLog(NULL), mRequest(req), mRemLength(0), mError (false) {
    mLog = Log::getInstance();

    mBlkData = new char[MAXLEN];
    
}

cResponseBase::~cResponseBase() {
  delete[] mBlkData;
}

bool cResponseBase::isHeadRequest() {
  if (mRequest->mMethod.compare("HEAD") == 0) {
    *(mLog->log())<< DEBUGPREFIX << " HEAD Request" << endl;
    mError= true;
    sendHeaders(200, "OK", NULL, NULL, -1, -1);
    return true;
  }  
  return false;
}

void cResponseBase::sendError(int status, const char *title, const char *extra, const char *text) {
  char f[400];

  mError = true;
  string hdr = "";
  sendHeaders(status, title, extra, "text/plain", -1, -1);

  snprintf(f, sizeof(f), "%s\r\n", text);
  hdr += f;

  //  strcpy(&(mRequest->mBlkData[mRequest->mBlkLen]), hdr.c_str());
  strcpy(&mBlkData[mBlkLen], hdr.c_str());
  mBlkLen += hdr.size();
}

void cResponseBase::sendHeaders(int status, const char *title, const char *extra, const char *mime,
				long long int length, time_t date) {

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
    hdr += f;
  }
  if (date != -1) {
    strftime(timebuf, sizeof(timebuf), RFC1123FMT, gmtime(&date));
    snprintf(f, sizeof(f), "Last-Modified: %s\r\n", timebuf);
    hdr += f;
  }
  snprintf(f, sizeof(f), "Accept-Ranges: bytes\r\n");
  hdr += f;
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


int cResponseBase::fillDataBlk() {

  if (mError) {
    mRequest->mConnState = TOCLOSE;
    return ERROR;
  }
}

bool cResponseBase::isBlkWritten() {
  return ((mBlkLen == mBlkPos) ? true : false);
}

int cResponseBase::writeData(int fd) {
  int this_write = write(fd, &mBlkData[mBlkPos], mBlkLen - mBlkPos);
  mBlkPos += this_write;
  return this_write;
}


cResponseOk::cResponseOk (cHttpResource* req, int status, const char *title, const char *extra, const char *mime, long long int length, time_t date) : cResponseBase(req) {
  
  if (isHeadRequest())
    return;
  sendHeaders(status, title, extra, mime, length, date);
}

cResponseOk::~cResponseOk() {
}


cResponseError::cResponseError(cHttpResource* req, int status, const char *title, const char *extra, const char *text) : cResponseBase(req) {

  sendError(status, title, extra, text);
}

cResponseError::~cResponseError() {
}
