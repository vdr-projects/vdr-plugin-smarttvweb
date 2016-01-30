/*
 * httpresource_base.h: VDR on Smart TV plugin
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

#ifndef __HTTPREQUEST_base_H__
#define __HTTPREQUEST_base_H__

#include <string>

using namespace std;

class SmartTvServer;

class cHttpResourceBase {

 public:
 cHttpResourceBase(int f, int id, int port, string addr, SmartTvServer* fac): mFd(f), mReqId(id), mFactory(fac), mServerPort(port),
    mRemoteAddr (addr) {};
  virtual ~cHttpResourceBase() {};

  virtual int handleRead() =0;
  virtual int handleWrite() = 0;
  virtual int checkStatus() =0;

  int mFd;
  int mReqId;
  SmartTvServer* mFactory;
  int mServerPort;

  string mRemoteAddr;
};


class Log;

class cHttpResourcePipe : public cHttpResourceBase {
 public:
  cHttpResourcePipe(int f, SmartTvServer* fac);
  virtual ~cHttpResourcePipe();
  
  int handleRead(); 
  int handleWrite() { return 0; };
  int checkStatus() { return 0; };
 private:
  static int mPipeId;
  Log*       mLog;

  char*      mBuf;
};


#endif
