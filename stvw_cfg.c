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

#include "stvw_cfg.h"

#ifndef STANDALONE
#include <vdr/plugin.h>
#endif

#include <iostream>
#include <fstream>
#include <cstdio>
#include <cstdlib>

cSmartTvConfig::cSmartTvConfig(): mConfigDir(""), mLog(NULL), mCfgFile(NULL), mUseVdrSetupConf(false),
  mLogFile(), mMediaFolder(), mSegmentDuration(), mHasMinBufferTime(), mHasBitrateCorrection(),
  mLiveChannels(), mGroupSep(IGNORE), mServerAddress(""), mServerPort(8000), mCmds(false), mUseStreamDev4Live(true),
  mBuiltInLiveStartMode (4), mBuiltInLivePktBuf4Hd(150), mBuiltInLivePktBuf4Sd(75), mBuiltInLiveBufDur(0.6), 
  mAddCorsHeader(false), mCorsHeaderPyld() {

#ifndef STANDALONE
  mLogFile= "";
#else
  mLogFile= "./smartvvweblog-standalone.txt";
#endif

  // Defaults
  mMediaFolder= "/hd2/mpeg";
  mSegmentDuration = 10;
  mHasMinBufferTime = 40;
  mHasBitrateCorrection = 1.1;
  mLiveChannels = 30;
}

cSmartTvConfig::~cSmartTvConfig() {
}


void cSmartTvConfig::Store(cPlugin *mPlugin) {
  mPlugin->SetupStore("LiveChannels", mLiveChannels);  
  mPlugin->SetupStore("LogFile", mLogFile.c_str());  
  mPlugin->SetupStore("MediaFolder", mMediaFolder.c_str());  
  mPlugin->SetupStore("SegmentDuration", mSegmentDuration);  
  mPlugin->SetupStore("HasMinBufferTime", mHasMinBufferTime);  
  mPlugin->SetupStore("HasBitrateCorrection", mHasBitrateCorrection);  
  switch (mGroupSep) {
  case EMPTYIGNORE:
    mPlugin->SetupStore("GroupSeparators", "EmptyIgnore");  
    break;
  case EMPTYFOLDERDOWN:
    mPlugin->SetupStore("GroupSeparators", "EmptyFolderDown");  
    break;
  }
  mPlugin->SetupStore("ServerAddress", mServerAddress.c_str());  
  mPlugin->SetupStore("ServerPort", mServerPort);  
  mPlugin->SetupStore("Commands", (mCmds ? 1 : 0));  
  mPlugin->SetupStore("UseStreamDev4Live", (mUseStreamDev4Live ? 1 : 0));  
  mPlugin->SetupStore("BuiltInLiveBufDur", (mBuiltInLiveBufDur ? 1 : 0));  
  if (mAddCorsHeader)
    mPlugin->SetupStore("CorsHeader", mCorsHeaderPyld.c_str());  
  else
    mPlugin->SetupStore("CorsHeader");  
}

bool cSmartTvConfig::SetupParse(const char *name, const char *value) {  

  if ( strcmp( name, "LiveChannels" ) == 0 ) 
    mLiveChannels = atoi( value );
  else if ( strcmp( name, "LogFile" ) == 0 ) 
    mLogFile = string(value);
  else if ( strcmp(name, "MediaFolder") == 0) 
    mMediaFolder = string (value);
  else if (strcmp(name, "SegmentDuration") == 0) 
    mSegmentDuration = atoi(value);
  else if (strcmp(name, "HasMinBufferTime") == 0) 
    mHasMinBufferTime = atoi(value);
  else if (strcmp(name, "HasBitrateCorrection") == 0)
    mHasBitrateCorrection = atof(value);
  else if (strcmp(name, "GroupSeparators") == 0) {
    if (strcmp (value, "EmptyIgnore") == 0) {
      mGroupSep = EMPTYIGNORE;
    }
    else if ( strcmp(value, "EmptyFolderDown") == 0) {
      mGroupSep = EMPTYFOLDERDOWN;
    }
  }
  else if (strcmp(name, "ServerAddress") == 0) 
    mServerAddress = value;
  else if (strcmp(name, "ServerPort") == 0) {
    mServerPort = atoi(value);
  }
  else if (strcmp(name, "Commands") == 0) {
    if (strcmp(value, "enable") == 0)
      mCmds = true;
  }
  else if (strcmp(name, "UseStreamDev4Live") == 0) {
    if (strcmp(value, "false") == 0)
      mUseStreamDev4Live = false;
  }
  else if (strcmp(name, "BuiltInLiveBufDur") == 0) {
    mBuiltInLiveBufDur = atoi(value) /1000.0;
    if (mBuiltInLiveBufDur <= 0.0)
      mBuiltInLiveBufDur = 0.5;
  }
  else if (strcmp(name, "CorsHeader") == 0) {
    mAddCorsHeader = true;
    mCorsHeaderPyld = value;
  }
  else 
    return false;

  mUseVdrSetupConf = true;
  return true;
}

void cSmartTvConfig::Initialize(string dir) {
  mConfigDir = dir;
  readConfig();

  struct stat statbuf;
  mHaveMediaFolder = false;
  if (stat(mMediaFolder.c_str(), &statbuf) != -1) {
    if (S_ISDIR(statbuf.st_mode)) {
      mHaveMediaFolder = true;
    }
  } 
}

void cSmartTvConfig::printConfig() {
  mLog = Log::getInstance();


  *(mLog->log()) << "printConfig: " << endl; 
  *(mLog->log()) << " ConfigDir: " << mConfigDir << endl;
  *(mLog->log()) << " LogFile: " << mLogFile << endl;
  *(mLog->log()) << " MediaFolder:" << mMediaFolder << endl;
  *(mLog->log()) << " SegmentDuration: " << mSegmentDuration << endl;
  *(mLog->log()) << " HasMinBufferTime: " << mHasMinBufferTime << endl;
  *(mLog->log()) << " HasBitrateCorrection: " << mHasBitrateCorrection << endl;
  *(mLog->log()) << " LiveChannels: " << mLiveChannels << endl;
  *(mLog->log()) << " GroupSeparators: " << ((mGroupSep==IGNORE)? "Ignore" : ((mGroupSep==EMPTYIGNORE)? "EmptyIgnore": "EmptyFolderDown")) << endl;
  *(mLog->log()) << " ServerAddress: " << mServerAddress << endl;
  *(mLog->log()) << " UseStreamDev4Live: " << ((mUseStreamDev4Live) ? "true" :"false") << endl;
  //  *(mLog->log()) << " BuiltInLiveStartMode: " << mBuiltInLiveStartMode << endl;
  //  *(mLog->log()) << " BuiltInLivePktBuf4Hd: " << mBuiltInLivePktBuf4Hd << endl;
  //  *(mLog->log()) << " BuiltInLivePktBuf4Sd: " << mBuiltInLivePktBuf4Sd << endl;
  *(mLog->log()) << " BuiltInLiveBufDur: " << mBuiltInLiveBufDur << endl;
  *(mLog->log()) << " CorsHdrPyld: " << mCorsHeaderPyld << endl;
}



//void cSmartTvConfig::readPluginConfig() {
  /*
  mPlugin = cPluginManager::GetPlugin("smarttvweb");

  if (!mPlugin)
    return;
  
  mPlugin->SetupStore("LiveChannels", mLiveChannels);
  */
//}

void cSmartTvConfig::readConfig() {
  string line;
  char attr[200];
  char value[200];

  if (mUseVdrSetupConf) {
    esyslog("SmartTvWeb: Using config from VDR setup");
    return;
  }

  ifstream myfile ((mConfigDir +"/smarttvweb.conf").c_str());

  if (!myfile.is_open()) {
#ifndef STANDALONE
    esyslog ("ERROR in SmartTvWeb: Cannot open config file. Expecting %s", (mConfigDir  +"/smarttvweb.conf").c_str() ); 
#else
    cout << "ERROR in SmartTvWeb: Cannot open config file. Expecting "<< (mConfigDir  +"/smarttvweb.conf") << endl;
#endif
    return;
  }
  
  while ( myfile.good() ) {
    getline (myfile, line);

    if ((line == "") or (line[0] == '#'))
      continue;
    
    sscanf(line.c_str(), "%s %s", attr, value);

    if (strcmp(attr, "LogFile")==0) {
      mLogFile = string(value);
      //      cout << " Found mLogFile= " << mLogFile << endl;
      continue;
    }
    
    if (strcmp(attr, "MediaFolder") == 0) {
      mMediaFolder = string (value);
      //      cout << " Found mMediaFolder= " << mMediaFolder << endl;
      continue;
    }

    if (strcmp(attr, "SegmentDuration") == 0)  {
      mSegmentDuration = atoi(value);
      //      cout << " Found mSegmentDuration= " << mSegmentDuration << endl;
      continue;
    }

    if (strcmp(attr, "HasMinBufferTime") == 0) {
      mHasMinBufferTime = atoi(value);
      //      cout << " Found mHasMinBufferTime= " << mHasMinBufferTime << endl;
      continue;
    }
    if (strcmp(attr, "HasBitrateCorrection") == 0) {
      mHasBitrateCorrection = atof(value);
      //      cout << " Found mHasBitrate= " <<mHasBitrate << endl;
      continue;
    }
    if (strcmp(attr, "LiveChannels") == 0) {
      mLiveChannels = atoi(value);
      //      cout << " Found mLiveChannels= " <<mLiveChannels << endl;
      continue;
    }

    if (strcmp(attr, "GroupSeparators") == 0) {
      if (strcmp (value, "EmptyIgnore") == 0) {
	mGroupSep = EMPTYIGNORE;
      }
      else if ( strcmp(value, "EmptyFolderDown") == 0) {
	mGroupSep = EMPTYFOLDERDOWN;
      }
      continue;
    }

    if (strcmp(attr, "ServerAddress") == 0) {
      mServerAddress = value;
      continue;
    }

    if (strcmp(attr, "ServerPort") == 0) {
      mServerPort = atoi(value);
      continue;
    }

    if (strcmp(attr, "Commands") == 0) {
      if (strcmp(value, "enable") == 0)
	mCmds = true;
      continue;
    }

    if (strcmp(attr, "UseStreamDev4Live") == 0) {
      if (strcmp(value, "false") == 0)
	mUseStreamDev4Live = false;
      continue;
    }

    /*    if (strcmp(attr, "BuiltInLiveStartMode") == 0) {
      mBuiltInLiveStartMode = atoi(value);
      if ((mBuiltInLiveStartMode <0) || (mBuiltInLiveStartMode > 4))
	mBuiltInLiveStartMode = 0;
      continue;
    }
    if (strcmp(attr, "BuiltInLivePktBuf4Hd") == 0) {
      mBuiltInLivePktBuf4Hd = atoi(value);
      continue;
    }
    if (strcmp(attr, "BuiltInLivePktBuf4Sd") == 0) {
      mBuiltInLivePktBuf4Sd = atoi(value);
      continue;
    }
*/

    if (strcmp(attr, "BuiltInLiveBufDur") == 0) {
      mBuiltInLiveBufDur = atoi(value) /1000.0;
      if (mBuiltInLiveBufDur <= 0.0)
	mBuiltInLiveBufDur = 0.5;
      continue;
    }

    if (strcmp(attr, "CorsHeader") == 0) {
      mAddCorsHeader = true;
      mCorsHeaderPyld = value;
      continue;
    }
    
#ifndef STANDALONE
    esyslog("WARNING in SmartTvWeb: Attribute= %s with value= %s was not processed, thus ignored.", attr, value);
#else
    cout << "WARNING: Attribute= "<< attr << " with value= " << value << " was not processed, thus ignored." << endl; 
#endif
    }
    myfile.close();
}

  /*
cResumes* cSmartTvConfig::readConfig(string f) {


  string line;
  ifstream myfile ("example.txt");

  if (myfile.is_open()) {
    while ( myfile.good() ) {
      getline (myfile,line);
      *(mLog->log()) << " readConfig: " << line << endl; 
      if (line == "")
	continue;

      string t;
      time_t st;
      int r;
      time_t lv;
      int count = scanf (line.c_str(), "%s %lld %d %lld", &t, &st, &r, &lv);
      if (count == 4) {
	*(mLog->log()) << " read: " << t << " st= " << st << " r= " << r << " lv= " << lv << endl;
      }
      // first title
      

    }
    myfile.close();
  }

  else {
    *(mLog->log()) << " readConfig: Cannot open file " << f << endl; 
    return NULL;
  }


  // open the file
  // read the lines
  return NULL;
}
*/  

cWidgetConfigBase::cWidgetConfigBase() {
  mUseDefaultBuffer = false;
  mTotalBufferSize = 3500000;
  mInitialBufferSize = 1000000;
  mPendingBufferSize = 500000;
  mSkipDuration = 30;
  mUsePdlForRecordings = true;
  mFormat = "hls";
  mLiveChannels = 20;
  mDirectAccessTimeout = 2000;
  mSortType = 0;
  mPlayKeyBehavior = 0;
  mShowInfoMsgs = true;
  mWidgetdebug = false;
}

string cWidgetConfigBase::BoolLine(string name, bool val) {
  string res = "<" +  name + ">" ;
  res += (val ? "true" : "false");
  res += "</" + name + ">\r\n";
  return res;
} 

string cWidgetConfigBase::IntLine(string name, int val) {
  snprintf(f, sizeof(f), "%d", val);
  string res = "<" + name + ">";
  res += f;
  res += "</" + name + ">\r\n";
  return res;
}

string cWidgetConfigBase::GetWidgetConf() {

  string res = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n";
  res += "<config>\r\n";

  res += BoolLine("useDefaultBuffer", mUseDefaultBuffer);
  res += IntLine("totalBufferSize", mTotalBufferSize);
  res += IntLine("initialBufferSize", mInitialBufferSize);
  res += IntLine("pendingBufferSize", mPendingBufferSize);
  res += IntLine("skipDuration", mSkipDuration);

  res += BoolLine("usePdlForRecordings", mUsePdlForRecordings);

  //  snprintf(f, sizeof(f), "%s", mFormat);
  res += "<format>" + mFormat + "</format>\r\n";

  res += IntLine("liveChannels", mLiveChannels);
  res += IntLine ("directAccessTimeout", mDirectAccessTimeout);
  res += IntLine("sortType", mSortType);
  res += IntLine ("playKeyBehavior", mPlayKeyBehavior);
  res += BoolLine("showInfoMsgs", mShowInfoMsgs);
  res += BoolLine("widgetdebug", mWidgetdebug);

  res += "</config>";
  return res;
}
