/*
 * responsebase.h: VDR on Smart TV plugin
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

#ifndef __HTTPRESPONSEBASE_H__
#define __HTTPRESPONSEBASE_H__

#include <ctime>
#include <stdint.h>

class cHttpResource;
class Log;

class cResponseBase {
 public:
  cResponseBase(cHttpResource* req);
  virtual ~cResponseBase();

  virtual int fillDataBlk();

  bool isBlkWritten();
  int writeData(int fd);

  char* mBlkData;
  int mBlkPos;
  int mBlkLen;

 protected:  
  bool isHeadRequest();

  void sendError(int status, const char *title, const char *extra, const char *text);
  void sendHeaders(int status, const char *title, const char *extra, const char *mime,
		   long long int length, time_t date);

  const char *getMimeType(const char *name) ;

  Log* mLog;
  cHttpResource* mRequest;
  uint64_t mRemLength;
  bool mError;
};


class cResponseOk : public cResponseBase {
 public:
  cResponseOk(cHttpResource*, int status, const char *title, const char *extra, const char *mime,
		long long int length, time_t date );
  virtual ~cResponseOk(); 

  //  int fillDataBlk();
};

class cResponseError : public cResponseBase {
 public:
  cResponseError(cHttpResource* req, int status, const char *title, const char *extra, const char *text );
  virtual ~cResponseError(); 

  //  int fillDataBlk();
};

#endif
