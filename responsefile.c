/*
 * responsefile.c: VDR on Smart TV plugin
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


#include "responsefile.h"
#include "httpresource.h"

#include <vector>
#include <sys/stat.h>
#include <errno.h>
#include <cstring>

//#define MAXLEN 4096
#define DEBUGPREFIX mLog->getTimeString() << ": mReqId= " << mRequest->mReqId << " fd= " << mRequest->mFd 
#define OKAY 0
#define ERROR (-1)
#define DEBUG


cResponseFile::cResponseFile(cHttpResource* req) : cResponseBase(req), mFile(NULL), mFileSize(0) {
}

cResponseFile::~cResponseFile() {
  if (mFile != NULL) {
    fclose(mFile);
    mFile = NULL;
  }  
}


int cResponseFile::sendFile() {
  // Send the First Datachunk, incl all headers

  if (isHeadRequest())
    return OKAY;

  struct stat64 statbuf;

  if (stat64((mRequest->mPath).c_str(), &statbuf) < 0) {
    sendError(404, "Not Found", NULL, "003 File not found.");
    return OKAY;
  }
  *(mLog->log())<< DEBUGPREFIX
		<< " SendFile mPath= " << mRequest->mPath 
		<< endl;

  char f[400];

  if (openFile((mRequest->mPath).c_str()) == ERROR) {
    sendError(403, "Forbidden", NULL, "001 Access denied.");
    return OKAY;
  }

  if (!mFile) {
    sendError(403, "Forbidden", NULL, "001 Access denied.");
    return OKAY;
  }

  mFileSize = S_ISREG(statbuf.st_mode) ? statbuf.st_size : -1;

  *(mLog->log())<< "fd= " <<  mRequest->mFd << " mReqId= "<< mRequest->mReqId 
		<< " mFileSize= " <<mFileSize << endl;

  if (!(mRequest->rangeHdr).isRangeRequest) {
    mRemLength = mFileSize;
    sendHeaders(200, "OK", NULL, getMimeType((mRequest->mPath).c_str()), mFileSize, statbuf.st_mtime);
  }
  else { // Range request
    fseeko64(mFile, (mRequest->rangeHdr).begin, SEEK_SET);
    if ((mRequest->rangeHdr).end == 0)
      (mRequest->rangeHdr).end = mFileSize;
    mRemLength = ((mRequest->rangeHdr).end-(mRequest->rangeHdr).begin);
    *(mLog->log())<< "fd= " <<  mRequest->mFd << " mReqId= "<< mRequest->mReqId 
		  << " rangeHdr.begin= " <<(mRequest->rangeHdr).begin << " rangeHdr.end= " << (mRequest->rangeHdr).end 
		  << " Content-Length= " << mRemLength << endl;

    snprintf(f, sizeof(f), "Content-Range: bytes %lld-%lld/%lld", (mRequest->rangeHdr).begin, ((mRequest->rangeHdr).end -1), mFileSize);
    sendHeaders(206, "Partial Content", f, getMimeType((mRequest->mPath).c_str()), ((mRequest->rangeHdr).end-(mRequest->rangeHdr).begin), statbuf.st_mtime);
  }

#ifndef DEBUG
  *(mLog->log())<< "fd= " <<  mRequest->mFd << " mReqId= "<< mRequest->mReqId 
		<< ": Done mRemLength= "<< mRemLength  
		<< endl;
#endif
  mRequest->mConnState = SERVING;

  return OKAY;

}


int cResponseFile::openFile(const char *name) {
  mFile = fopen(name, "r");
  if (!mFile) {
    *(mLog->log())<< DEBUGPREFIX
		  << " fopen failed pathbuf= " << name 
		  << " errno= " << errno 
		  << " " << strerror(errno) << endl;
    return ERROR;
  }
  return OKAY;
}


int cResponseFile::fillDataBlk() {
  //  char pathbuf[4096];
  mBlkPos = 0;
  int to_read = 0;

  if (mError)
    return ERROR;

  to_read = ((mRemLength > MAXLEN) ? MAXLEN : mRemLength);
  mBlkLen = fread(mBlkData, 1, to_read, mFile);
  mRemLength -= mBlkLen;
  if (mBlkLen == 0) {

    // read until EOF 
    fclose(mFile);
    mFile = NULL;
    return ERROR;
  }
  return OKAY;
}

