/*
 * stvw_cfg.h: VDR on Smart TV plugin
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


#ifndef __SMARTTV_CONFIG_H__
#define __SMARTTV_CONFIG_H__

#include <string>
#include <cstring>
#include <vector>
#include <ctime>
#include "log.h"

using namespace std;

class cResumeEntry {
 public:
  string mTitle;
  time_t mStartTime; // title is not unique
  int mResume;
  time_t mLastViewed;

  friend  ostream& operator<<(ostream& out, const cResumeEntry& o) {
    out << "mTitle= " << o.mTitle << " mStartTime= " << o.mStartTime << " mResume= " << o.mResume << endl;
    return out;
  };
};

class cResumes {
 public:
 cResumes(string t) : mDevice(t) {};

  vector<cResumeEntry> mResumes;

  string mDevice; 
};

class cSmartTvConfig {
 private:
  string mConfigDir;
  Log* mLog;
  FILE *mCfgFile;

  string mLogFile;
  string mMediaFolder;
  unsigned int mSegmentDuration;
  int mHasMinBufferTime;
  unsigned int mHasBitrate;
  int mLiveChannels;

 public:
  cSmartTvConfig(string dir);
  ~cSmartTvConfig();

  void readConfig();

  cResumes* readConfig(string);

  string getLogFile() { return mLogFile; };
  string getMediaFolder() { return mMediaFolder; };
  unsigned int getSegmentDuration() {return mSegmentDuration; };
  int getHasMinBufferTime() { return mHasMinBufferTime; };
  unsigned int getHasBitrate() {return mHasBitrate; };
  int getLiveChannels() {return mLiveChannels; };
};

#endif
