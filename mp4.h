/*
 * mp4.h: VDR on Smart TV plugin
 *
 * Copyright (C) 2012 - 2015 T. Lohmar
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

#ifndef __MP4_H__
#define __MP4_H__

#include <stdint.h>
#include <string>
#include <stdio.h>
#include <stdlib.h>
#include "log.h"

using namespace std;

enum eBoxes {root, moov, udta, meta, ilst, covr, cnam, tvnn, ldes, desc};

class cMp4Metadata {
 public:
  cMp4Metadata(string fn, uint64_t);
  ~cMp4Metadata();

  void parseMetadata ();

 protected:
  bool findMetadata(FILE*, eBoxes);

  bool parseMovieHeader (FILE* ifd, uint64_t s);
  string parseString(FILE*, uint64_t);

  Log* mLog;
 public:
  bool mIsValidFile;

  bool mHaveTitle;
  bool mHaveShortDesc;
  bool mHaveLongDesc;
  bool mHaveCovrPos;

  string mFilename;
  uint64_t mFilesize;

  float mDuration;
  uint64_t mCreationTime;

  string mTitle;
  string mTVNetwork;
  string mShortDesc;
  string mLongDesc;

  uint64_t mCovrPos;
  uint64_t mCovrSize;
  int      mCovrType;
  char *mCovr;
};

#endif
