/*
 * responsememblk.h: VDR on Smart TV plugin
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

#ifndef __RESPONSE_MEMBLK_H__
#define __RESPONSE_MEMBLK_H__

#include <cstdio>
#include <sys/stat.h>
#include <string>
#include <vector>
#include <sys/time.h>
#include "responsebase.h"

#include <vdr/config.h>

using namespace std;

struct sFileEntry {
  string sName;
  string sPath;
  int sStart;

sFileEntry(string n, string l, int s) : sName(n), sPath(l), sStart(s) {
  };
};


class cResumeEntry;
class cHttpResource;

// create the complete response for the file request
// info on range request should be provided.
class cResponseMemBlk : public cResponseBase {
 public:
  cResponseMemBlk(cHttpResource* );
  virtual ~cResponseMemBlk(); // same as sendFile

  int fillDataBlk();

  int sendRecordingsXml (struct stat *statbuf);
  int sendChannelsXml (struct stat *statbuf);
  int sendResumeXml ();
  int sendVdrStatusXml (struct stat *statbuf);
  void sendServerNameXml ();
  int sendYtBookmarkletJs();
  int sendBmlInstHtml();

  int sendEpgXml (struct stat *statbuf);
  int sendUrlsXml ();
  int sendMediaXml (struct stat *statbuf);
  int sendManifest (struct stat *statbuf, bool is_hls = true);
  void sendTimersXml();
  void sendRecCmds();
  void receiveExecRecCmdReq();

  void receiveAddTimerReq();
  void receiveDelTimerReq();

  void receiveClientInfo();

  int receiveResume();
  int receiveDelRecReq();

  int receiveYtUrl();
  int receiveDelYtUrl();

  int receiveCfgServerAddrs();

  void writeM3U8(double duration, int bitrate, float seg_dur, int end_seg);
  void writeMPD(double duration, int bitrate, float seg_dur, int end_seg);

  int parseResume(cResumeEntry &entry, string &id);
  int parseFiles(vector<sFileEntry> *entries, string prefix, string dir_base, string dir_name, struct stat *statbuf);
  int sendDir(struct stat *statbuf);
  int writeXmlItem(string title, string link, string programme, string desc, string guid, int no, time_t start, int dur, double fps, int is_pes, int is_new);
  uint64_t getVdrFileSize();

 private:
  string *mResponseMessage;
  int mResponseMessagePos;

  timeval mResponseStart;
};

#endif
