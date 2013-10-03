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

cSmartTvConfig::cSmartTvConfig(string d): mConfigDir(d), mLog(NULL), mCfgFile(NULL),
  mLogFile(), mMediaFolder(), mSegmentDuration(), mHasMinBufferTime(), mHasBitrateCorrection(),
  mLiveChannels(), mGroupSep(IGNORE), mServerAddress(""), mServerPort(8000), mCmds(false) {

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

  readConfig();
}

cSmartTvConfig::~cSmartTvConfig() {
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
}


void cSmartTvConfig::readConfig() {
  string line;
  char attr[200];
  char value[200];

  ifstream myfile ((mConfigDir +"/smarttvweb.conf").c_str());

  if (!myfile.is_open()) {
#ifndef STANDALONE
    esyslog ("ERROR in SmartTvWeb: Cannot open config file. Expecting %s", (mConfigDir  +"/smarttvweb.conf").c_str() ); 
#else
    cout << "ERROR: Cannot open config file. Expecting "<< (mConfigDir  +"/smarttvweb.conf") << endl;
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
