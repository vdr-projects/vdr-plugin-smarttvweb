/*
 * httpresource_base.c: VDR on Smart TV plugin
 *
 * Copyright (C) 2013 T. Lohmar
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

#include "httpresource_base.h"
#include "log.h"
#include <unistd.h>

int cHttpResourcePipe::mPipeId = 0;

#define MEMBUFLEN 1000

cHttpResourcePipe::cHttpResourcePipe(int f, SmartTvServer* fac) : cHttpResourceBase(f, mPipeId++, 0, "-", fac), mLog(NULL), mBuf(NULL) {   

  mLog = Log::getInstance();
  mBuf = new char[MEMBUFLEN];
};

cHttpResourcePipe::~cHttpResourcePipe() {
  delete [] mBuf;
};

int cHttpResourcePipe::handleRead() { 

  int buflen = read(mFd, mBuf, MEMBUFLEN);
  if (buflen == 0)
    return -1;
  return 0; 
};  // OKAY
