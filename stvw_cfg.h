/*
 * stvw_cfg.h: VDR on Smart TV plugin
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


#ifndef __SMARTTV_CONFIG_H__
#define __SMARTTV_CONFIG_H__

#include <string>
#include <cstring>
#include <vector>
#include <ctime>
#include "log.h"

using namespace std;


enum eGroupSep {
  IGNORE,
  EMPTYIGNORE,
  EMPTYFOLDERDOWN
};

class cWidgetConfigBase {
 private:
  bool mUseDefaultBuffer;
  int mTotalBufferSize;
  int mInitialBufferSize;
  int mPendingBufferSize;
  int mSkipDuration;
  bool mUsePdlForRecordings;
  string mFormat;
  int mLiveChannels;
  int mDirectAccessTimeout;
  int mSortType;
  int mPlayKeyBehavior;
  bool mShowInfoMsgs;
  bool mWidgetdebug;

  char f[400];

  string BoolLine(string name, bool val);
  string IntLine(string name, int val);

 public:
  cWidgetConfigBase();

  string GetWidgetConf();

};

class cPlugin;

class cSmartTvConfig {
 private:
  string mConfigDir;
  Log* mLog;
  FILE *mCfgFile;

  bool mUseVdrSetupConf;
  string mLogFile;
  string mMediaFolder;
  bool mHaveMediaFolder;
  unsigned int mSegmentDuration;
  int mHasMinBufferTime;
  float mHasBitrateCorrection;
  int mLiveChannels;

  eGroupSep mGroupSep;
  string mServerAddress;
  int mServerPort;
  bool mCmds;
  bool mUseStreamDev4Live;
  int mBuiltInLiveStartMode;
  int mBuiltInLivePktBuf4Hd;
  int mBuiltInLivePktBuf4Sd;
  double mBuiltInLiveBufDur;

  bool mAddCorsHeader;
  string mCorsHeaderPyld;

  string mUsageStatsLogFile;
  //  cPlugin* mPlugin;
  cWidgetConfigBase mWidgetConfigBase;
 public:
  cSmartTvConfig();
  ~cSmartTvConfig();

  bool SetupParse(const char *Name, const char *Value);
  void Store(cPlugin *mPlugin);

  void Initialize(string dir);
  void readConfig();
  //  void readPluginConfig();
  void printConfig();

  string getLogFile() { return mLogFile; };
  string getMediaFolder() { return mMediaFolder; };
  bool haveMediaFolder() { return mHaveMediaFolder; };
  unsigned int getSegmentDuration() {return mSegmentDuration; };
  int getHasMinBufferTime() { return mHasMinBufferTime; };
  float getHasBitrateCorrection() { return mHasBitrateCorrection; };
  int getLiveChannels() {return mLiveChannels; };
  eGroupSep getGroupSep() { return mGroupSep; };
  string getServerAddress() { return mServerAddress; };
  int getServerPort() { return mServerPort; };
  bool getCmds() { return mCmds; };
  bool useStreamDev4Live() { return mUseStreamDev4Live; };
  int getBuiltInLiveStartMode() {return mBuiltInLiveStartMode; };
  int getBuiltInLivePktBuf4Hd() { return mBuiltInLivePktBuf4Hd; };
  int getBuiltInLivePktBuf4Sd() { return mBuiltInLivePktBuf4Sd; };
  double getBuiltInLiveBufDur() { return mBuiltInLiveBufDur; };

  bool addCorsHeader() { return mAddCorsHeader; };
  string getCorsHeader() {return mCorsHeaderPyld; };

  string getUsageStatsLogFile() { return mUsageStatsLogFile; };
  string GetWidgetConf() { return mWidgetConfigBase.GetWidgetConf(); };
};


#endif
