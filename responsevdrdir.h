/*
 * responsevdrdir.h: VDR on Smart TV plugin
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

#ifndef __HTTPRESPONSE_VDRDIR_H__
#define __HTTPRESPONSE_VDRDIR_H__

#include <cstdio>
#include <string>
#include <cstring>
#include "responsebase.h"

using namespace std;

//class cHttpResource;

class cResponseVdrDir : public cResponseBase{
 public:
  cResponseVdrDir(cHttpResource*);
  virtual ~cResponseVdrDir();

  int fillDataBlk();

  int sendVdrDir(struct stat *statbuf);
  int sendMediaSegment (struct stat *statbuf);
 protected:

  //  cHttpResource* mRequest;

  //range
  bool mIsRecording;
  bool mStreamToEnd;
  float mRecProgress;

  int mVdrIdx;
  FILE* mFile;
  string mFileStructure;

  bool isTimeRequest(struct stat *statbuf);
  void checkRecording() ;

  int openFile(const char *name);

};

#endif
