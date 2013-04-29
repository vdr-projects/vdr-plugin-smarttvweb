/*
 * responsememblk.c: VDR on Smart TV plugin
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

#include "responsememblk.h"
#include "httpresource.h"
#include "url.h"
#include "smarttvfactory.h"

#include <sstream>

#ifndef STANDALONE
#include <vdr/recording.h>
#include <vdr/channels.h>
#include <vdr/timers.h>
#include <vdr/videodir.h>
#include <vdr/epg.h>

#else
//standalone
#include <netinet/in.h>
#include <arpa/inet.h>

#include <cstdlib>
//#include <stdio.h>
//#include <sys/stat.h>
#include <dirent.h>

#endif


//#define MAXLEN 32768
#define DEBUGPREFIX "mReqId= " << mRequest->mReqId << " fd= " << mRequest->mFd 
#define OKAY 0
#define ERROR (-1)
#define DEBUG

class cResumeEntry {
 public:
  string mFilename;
  float mResume;

  friend  ostream& operator<<(ostream& out, const cResumeEntry& o) {
    out << "mFilename= " << o.mFilename  << " mResume= " << o.mResume << endl;
    return out;
  };
 cResumeEntry():mFilename(), mResume(-1.0) {};
};


struct sTimerEntry {
  string name;
  time_t startTime;
  int duration;
sTimerEntry(string t, time_t s, int d) :  name(t), startTime(s), duration(d) {};
};


cResponseMemBlk::cResponseMemBlk(cHttpResource* req) : cResponseBase(req), mResponseMessage(NULL), mResponseMessagePos(0) {

  gettimeofday(&mResponseStart,0); 
  
}

cResponseMemBlk::~cResponseMemBlk() {

  timeval now;
  gettimeofday(&now, 0);

  //  long diff; // in ms
  //  diff = (now.tv_sec - mResponseStart.tv_sec) *1000;
  //  diff += (now.tv_usec - mResponseStart.tv_usec) /1000;

  long long diff; // in us
  diff = (now.tv_sec - mResponseStart.tv_sec) *1000000;
  diff += (now.tv_usec - mResponseStart.tv_usec) ;

  *(mLog->log())<< DEBUGPREFIX
		<< " cResponseMemBlk: Response duration= " << diff/1000.0 << " ms"
		<< endl;

}

int cResponseMemBlk::receiveYtUrl() {
  vector<sQueryAVP> avps;
  mRequest->parseQueryLine(&avps);
  string line; 
  string store_str;
  bool store = true;

  if (isHeadRequest())
    return OKAY;

  if (mRequest->getQueryAttributeValue(&avps, "store", store_str) == OKAY){
    if (store_str.compare("false")==0) {
      store = false;
      *(mLog->log()) << DEBUGPREFIX 
		     << " receiveYtUrl: set store to false "
		     << endl;

    }
  }
  if (mRequest->getQueryAttributeValue(&avps, "line", line) == OKAY){
    if (line.compare ("") == 0) {
      *(mLog->log())<< DEBUGPREFIX
		    << " receiveYtUrl: Nothing to push " 
		    << endl;

      sendHeaders(200, "OK", NULL, NULL, 0, -1);
      return OKAY;
    }
    
    mRequest->mFactory->pushYtVideoId(line, store);

    if (store)
      mRequest->mFactory->storeYtVideoId(line);

    sendHeaders(200, "OK", NULL, NULL, 0, -1);
    return OKAY;

  }

  sendError(400, "Bad Request", NULL, "Mandatory Line attribute not present.");
  return OKAY;

}

int cResponseMemBlk::receiveDelYtUrl() {
  if (isHeadRequest())
    return OKAY;

  vector<sQueryAVP> avps;
  mRequest->parseQueryLine(&avps);
  string id = "";

  if (mRequest->getQueryAttributeValue(&avps, "guid", id) == ERROR){
    *(mLog->log())<< DEBUGPREFIX
		  << " ERROR in cResponseMemBlk::receiveDelYtUrl: guid not found in query." 
		  << endl;
    sendError(400, "Bad Request", NULL, "No guid in query line");
    return OKAY;
  }

  if (mRequest->mFactory->deleteYtVideoId(id)) {
    sendHeaders(200, "OK", NULL, NULL, -1, -1);
  }
  else {
    sendError(400, "Bad Request.", NULL, "Entry not found. Deletion failed!");
  }

  return OKAY;
  
}

int cResponseMemBlk::receiveCfgServerAddrs() {
  vector<sQueryAVP> avps;
  mRequest->parseQueryLine(&avps);
  string addr; 

  if (isHeadRequest())
    return OKAY;

  if (mRequest->getQueryAttributeValue(&avps, "addr", addr) == OKAY){
    if (addr.compare ("") == 0) {
      *(mLog->log())<< DEBUGPREFIX
		    << " receiveCfgServerAddrs: no server address" 
		    << endl;

      sendHeaders(400, "Bad Request", NULL, "TV address field empty", 0, -1);
      return OKAY;
    }
    
    //    mRequest->mFactory->pushYtVideoId(line, store);

    sendHeaders(200, "OK", NULL, NULL, 0, -1);
    return OKAY;

  }

  sendError(400, "Bad Request", NULL, "Mandatory TV address attribute not present.");
  return OKAY;

}

void cResponseMemBlk::receiveClientInfo() {
  vector<sQueryAVP> avps;
  mRequest->parseQueryLine(&avps);
  
  string mac = "";
  string ip = "";
  string state = "";

  if (isHeadRequest())
    return;

  mRequest->getQueryAttributeValue(&avps, "mac", mac) ;
  mRequest->getQueryAttributeValue(&avps, "ip", ip);
  mRequest->getQueryAttributeValue(&avps, "state", state);

  // state: started, running, stopped
  *(mLog->log())<< DEBUGPREFIX
		<< " receiveClientInfo mac= " << mac << " ip= " << ip << " state= " << state
		<< endl;
  if (mac.compare ("") == 0) {
    *(mLog->log())<< DEBUGPREFIX
      << " mac is empty. Ignoring"
		  << endl;
    sendHeaders(200, "OK", NULL, NULL, 0, -1);
    return;
  }
  if (state.compare("stopped") == 0) {
    mRequest->mFactory->removeTvClient(ip, mac, time(NULL));
  }
  else {
    mRequest->mFactory->updateTvClient(ip, mac, time(NULL));
  }
  sendHeaders(200, "OK", NULL, NULL, 0, -1);
#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " receiveClientInfo -done " 
		<< endl;
#endif
}



int cResponseMemBlk::parseResume(cResumeEntry &entry, string &id) {
  bool done = false;
  size_t cur_pos = 0;
    
  bool have_filename = false;
  bool have_resume = false;

  if (isHeadRequest())
    return OKAY;

  while (!done) {
      size_t pos = mRequest->mPayload.find('\n', cur_pos);
      if (pos == string::npos) {
	done = true;
	continue;
      }
      size_t pos_col = mRequest->mPayload.find(':', cur_pos);
      string attr= mRequest->mPayload.substr(cur_pos, (pos_col- cur_pos));
      string val = mRequest->mPayload.substr(pos_col +1, (pos - pos_col-1));

      if (attr == "filename") {
	have_filename = true;
	entry.mFilename = cUrlEncode::doUrlSaveDecode(val);
	*(mLog->log())<< DEBUGPREFIX
		      << " filename= " << entry.mFilename
		      << endl;
      }
      else if (attr == "resume") {
	have_resume = true;
	entry.mResume = atof(val.c_str());
	*(mLog->log())<< DEBUGPREFIX
		      << " mResume= " << entry.mResume
		      << endl;
      }
      else {
	*(mLog->log())<< DEBUGPREFIX
                    << " parseResume: ERROR: Unknown attr= " << attr
                    << " with val= " << val
		      << endl;
      }
      cur_pos = pos +1;
      if (cur_pos >= mRequest->mPayload.size())
	done= true;
    }
    if (have_resume && have_filename )
      return OKAY;
    else
      return ERROR;
}

int cResponseMemBlk::receiveResume() {
  string dev_id;
  cResumeEntry entry;

  if (isHeadRequest())
    return OKAY;

  if (parseResume(entry, dev_id) == ERROR) {
    *(mLog->log())<< DEBUGPREFIX 
		  << " ERROR parsing resume" 
		  << endl;
  }

  *(mLog->log())<< DEBUGPREFIX 
		<< " Resume:"
    //		<< " id= " << dev_id
		<< " resume= " << entry << endl;

  vector<sQueryAVP> avps;
  mRequest->parseQueryLine(&avps);
  string guid; 
  string resume_str; 

  if (mRequest->getQueryAttributeValue(&avps, "guid", guid) == OKAY){
    entry.mFilename = cUrlEncode::doUrlSaveDecode(guid);
    
    /*   *(mLog->log())<< DEBUGPREFIX
		  << " Found a id Parameter: " << guid
		  << endl;
*/
  }
  if (mRequest->getQueryAttributeValue(&avps, "resume", resume_str) == OKAY){
    entry.mResume = atof(resume_str.c_str());
    *(mLog->log())<< DEBUGPREFIX
		  << " Found a resume Parameter: " << entry.mResume
		  << endl;
  }

#ifndef STANDALONE
  cRecording *rec = Recordings.GetByName(entry.mFilename.c_str());
  if (rec == NULL) {
    //Error 400
    *(mLog->log())<< DEBUGPREFIX 
		  << " ERROR in receiveResume: recording not found - filename= " << entry.mFilename
		  << " resume= " << entry.mResume
		  << endl;

    sendError(400, "Bad Request", NULL, "Failed to find the recording.");
    return OKAY;
  }

  cResumeFile resume(entry.mFilename.c_str(), rec->IsPesRecording());
  *(mLog->log())<< DEBUGPREFIX 
		<< " Resume:  " << entry.mFilename
		<< " saving Index= " << int(entry.mResume * rec->FramesPerSecond() )
		<< " mResume= " <<entry.mResume 
		<< " fpr= " << rec->FramesPerSecond()
		<< endl;

  resume.Save(int(entry.mResume * rec->FramesPerSecond() ));
  rec->ResetResume();
#endif

  sendHeaders(200, "OK", NULL, NULL, -1, -1);
  return OKAY;
}


int cResponseMemBlk::sendResumeXml () {
  if (isHeadRequest())
    return OKAY;
#ifndef STANDALONE

  mResponseMessage = new string();
  *mResponseMessage = "";
  mResponseMessagePos = 0;

  mRequest->mConnState = SERVING;
  
  char f[400];

  cResumeEntry entry;
  string id;

  parseResume(entry, id);

  vector<sQueryAVP> avps;
  mRequest->parseQueryLine(&avps);
  string guid; 

  if (mRequest->getQueryAttributeValue(&avps, "guid", guid) == OKAY){
    entry.mFilename = cUrlEncode::doUrlSaveDecode(guid);

    *(mLog->log() )<< DEBUGPREFIX
		   << " Found guid: " << guid
		   << " filename: " << entry.mFilename
		   << endl;
  }


  cRecording *rec = Recordings.GetByName(entry.mFilename.c_str());
  if (rec == NULL) {
    //Error 404
    *(mLog->log())<< DEBUGPREFIX
		  << " ERROR in sendResume: recording not found - filename= " << entry.mFilename << endl;
    sendError(400, "Bad Request", NULL, "Failed to find the recording.");
    return OKAY;
  }
  if (rec->IsNew()) {
    *(mLog->log())<< DEBUGPREFIX
		  << " sendResume: file is new "  << endl;
    sendError(400, "Bad Request", NULL, "File is new.");
    return OKAY;
  }
  cResumeFile resume(entry.mFilename.c_str(), rec->IsPesRecording());

  *(mLog->log())<< DEBUGPREFIX
		<< " resume request for " << entry.mFilename 
		<< " resume= " << resume.Read() 
		<< " (" << resume.Read() *1.0 / rec->FramesPerSecond() << "sec)"
		<< endl;

  *mResponseMessage  += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  *mResponseMessage += "<resume>";
  snprintf(f, sizeof(f), "%.02f", resume.Read() *1.0 / rec->FramesPerSecond());
  *mResponseMessage += f;
  *mResponseMessage += "</resume>\n";


  sendHeaders(200, "OK", NULL, "application/xml", mResponseMessage->size(), -1);
#endif

  return OKAY;
}



int cResponseMemBlk::receiveDelRecReq() {
  if (isHeadRequest())
    return OKAY;

#ifndef STANDALONE

  vector<sQueryAVP> avps;
  mRequest->parseQueryLine(&avps);
  string id = "";

  if (mRequest->getQueryAttributeValue(&avps, "id", id) == ERROR){
    *(mLog->log())<< DEBUGPREFIX
		  << " ERROR: id not found in query." 
		  << endl;
    sendError(400, "Bad Request", NULL, "no id in query line");
    return OKAY;
  }
  mRequest->mPath = cUrlEncode::doUrlSaveDecode(id);

  cRecording* rec = Recordings.GetByName(mRequest->mPath.c_str());
  if (rec == NULL) {
    *(mLog->log())<< DEBUGPREFIX
		  << " ERROR: Recording not found. Deletion failed: mPath= " << mRequest->mPath
		  << endl;
    sendError(404, "Not Found.", NULL, "Recording not found. Deletion failed!");
    return OKAY;
  }
  if ( rec->Delete() ) {
    Recordings.DelByName(rec->FileName());
    //    Recordings.DelByName(mPath.c_str());
  }
  else {
    *(mLog->log())<< DEBUGPREFIX
		  << " ERROR: rec->Delete() returns false. mPath= " << mRequest->mPath
		  << endl;
    sendError(500, "Internal Server Error", NULL, "deletion failed!");
    return OKAY;
  }
  
  *(mLog->log())<< DEBUGPREFIX
		  << " Deleted."
		  << endl;
  sendHeaders(200, "OK", NULL, NULL, -1, -1);
  #endif
  return OKAY;
}


//***************************
//**** Creade index.html ****
//***************************
int cResponseMemBlk::sendDir(struct stat *statbuf) {
  char pathbuf[4096];
  char f[400];
  int len;

  if (isHeadRequest())
    return OKAY;

  mRequest->mConnState = SERVING;

#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX << " sendDir: mPath= " << mRequest->mPath << endl;
#endif
  len = mRequest->mPath.length();
  //  int ret = OKAY;

  if (len == 0 || mRequest->mPath[len - 1] != '/') {
    snprintf(pathbuf, sizeof(pathbuf), "Location: %s/", mRequest->mPath.c_str());
    sendError(302, "Found", pathbuf, "Directories must end with a slash.");
    return OKAY;
  }

  /* thlo: TODO
  snprintf(pathbuf, sizeof(pathbuf), "%sindex.html", mRequest->mPath.c_str());
  if (stat(pathbuf, statbuf) >= 0) {
    mRequest->mPath = pathbuf;
    //    mFileSize = statbuf->st_size;
    mRemLength = statbuf->st_size;
    mRequest->mContentType = SINGLEFILE;
    return sendFile(statbuf);    
  }
*/
#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX << " sendDir: create index.html "  << endl;
#endif
  DIR *dir;
  struct dirent *de;
  
  mResponseMessage = new string();
  mResponseMessagePos = 0;
  *mResponseMessage = "";

  string hdr = "";
  snprintf(f, sizeof(f), "<HTML><HEAD><TITLE>Index of %s</TITLE></HEAD>\r\n<BODY>", mRequest->mPath.c_str());
  hdr += f;
  snprintf(f, sizeof(f), "<H4>Index of %s</H4>\r\n<PRE>\n", mRequest->mPath.c_str());
  hdr += f;
  snprintf(f, sizeof(f), "Name                             Last Modified              Size\r\n");
  hdr += f;
  snprintf(f, sizeof(f), "<HR>\r\n");
  hdr += f;
    
  *mResponseMessage += hdr;
  hdr = "";
    
  if (len > 1) {
    snprintf(f, sizeof(f), "<A HREF=\"..\">..</A>\r\n");
    hdr += f;
  }
  *mResponseMessage += hdr;
        
  dir = opendir(mRequest->mPath.c_str());
  while ((de = readdir(dir)) != NULL) {
    char timebuf[32];
    struct tm *tm;
    strcpy(pathbuf, mRequest->mPath.c_str());
    //	printf (" -Entry: %s\n", de->d_name);
    strcat(pathbuf, de->d_name);
      
    stat(pathbuf, statbuf);
    tm = gmtime(&(statbuf->st_mtime));
    strftime(timebuf, sizeof(timebuf), "%d-%b-%Y %H:%M:%S", tm);
      
    hdr = "";
    snprintf(f, sizeof(f), "<A HREF=\"%s%s\">", de->d_name, S_ISDIR(statbuf->st_mode) ? "/" : "");
    hdr += f;
      
    snprintf(f, sizeof(f), "%s%s", de->d_name, S_ISDIR(statbuf->st_mode) ? "/</A>" : "</A> ");
    hdr += f;
      
    if (strlen(de->d_name) < 32) {
      snprintf(f, sizeof(f), "%*s", 32 - strlen(de->d_name), "");
      hdr += f;
    }
    if (S_ISDIR(statbuf->st_mode)) {
      snprintf(f, sizeof(f), "%s\r\n", timebuf);
      hdr += f;
    }
    else {
      snprintf(f, sizeof(f), "%s\r\n", timebuf);
      hdr += f;
    }

    *mResponseMessage += hdr;
  }
  closedir(dir);
  snprintf(f, sizeof(f), "</PRE>\r\n<HR>\r\n<ADDRESS>%s</ADDRESS>\r\n</BODY></HTML>\r\n", SERVER);
  *mResponseMessage += f;

  sendHeaders(200, "OK", NULL, "text/html", mResponseMessage->size(), statbuf->st_mtime);

  mRemLength = 0;
  return OKAY;
}




// -------------------------------------------
// Manifest
// -------------------------------------------


int cResponseMemBlk::sendManifest (struct stat *statbuf, bool is_hls) {
  if (isHeadRequest())
    return OKAY;

#ifndef STANDALONE

  size_t pos = mRequest->mPath.find_last_of ("/");

  mRequest->mDir = mRequest->mPath.substr(0, pos);
  string mpd_name = mRequest->mPath.substr(pos+1);
  
  float seg_dur = mRequest->mFactory->getConfig()->getSegmentDuration() *1.0;

  cRecordings* recordings = &Recordings;
  cRecording* rec = recordings->GetByName(mRequest->mDir.c_str());  
  double duration = rec->NumFrames() / rec->FramesPerSecond();

  int bitrate = (int)((getVdrFileSize() *8.0 * mRequest->mFactory->getConfig()->getHasBitrateCorrection()/ duration) +0.5);

  time_t now = time(NULL);

  if (rec->Info() != NULL){
    if (rec->Info()->GetEvent() != NULL) {
      if (rec->Info()->GetEvent()->EndTime() > now) {

	float corr = (now - rec->Info()->GetEvent()->StartTime()) - duration;
	duration = rec->Info()->GetEvent()->Duration() -int(corr);
	  *(mLog->log()) << DEBUGPREFIX 
			 << " is Recording: Duration= " << duration << " sec"
			 << " correction: " << int(corr)
			 << endl;
      }
    }
    else
      *(mLog->log()) << DEBUGPREFIX  << " WARNING: rec-Info()->GetEvent() is NULL " << endl;
  }
  else
    *(mLog->log()) << DEBUGPREFIX  << " WARNING: rec-Info() is NULL " << endl;

  // duration is now either the actual duration of the asset or the target duration of the asset
  int end_seg = int (duration / seg_dur) +1;

  *(mLog->log()) << DEBUGPREFIX 
		 << " Manifest for mRequest->mDir= " << mRequest->mDir
		 << " duration= " << duration
		 << " seg_dur= " << seg_dur
		 << " end_seg= " << end_seg
		 << endl;



  if (is_hls) {
    writeM3U8(duration, bitrate, seg_dur, end_seg);
  }  
  else {
    writeMPD(duration, bitrate, seg_dur, end_seg);
  }

#endif
  return OKAY;
}


void cResponseMemBlk::writeM3U8(double duration, int bitrate, float seg_dur, int end_seg) {
  mResponseMessage = new string();
  mResponseMessagePos = 0;
  *mResponseMessage = "";

  //  mRequest->mContentType = MEMBLOCK;

  mRequest->mConnState = SERVING;
  char buf[30];

  string hdr = "";


  *mResponseMessage += "#EXTM3U\n";
  //  snprintf(buf, sizeof(buf), "#EXT-X-TARGETDURATION:%d\n", (seg_dur-1));
  snprintf(buf, sizeof(buf), "#EXT-X-TARGETDURATION:%d\n", int(seg_dur));
  hdr = buf;
  *mResponseMessage += hdr;
  
  *mResponseMessage += "#EXT-X-MEDIA-SEQUENCE:1\n";
  *mResponseMessage += "#EXT-X-KEY:METHOD=NONE\n";
  
  for (int i = 1; i < end_seg; i++){
    //    snprintf(buf, sizeof(buf), "#EXTINF:%.1f,\n", (seg_dur-0.5));
    snprintf(buf, sizeof(buf), "#EXTINF:%.2f,\n", seg_dur);
    hdr = buf;
    *mResponseMessage += hdr;
    
    snprintf(buf, sizeof(buf), "%d-seg.ts\n", i);
    hdr = buf;
    *mResponseMessage += hdr;
  }
  *mResponseMessage += "#EXT-X-ENDLIST\n";

  sendHeaders(200, "OK", NULL, "application/x-mpegURL", mResponseMessage->size(), -1);
}


void cResponseMemBlk::writeMPD(double duration, int bitrate, float seg_dur, int end_seg) {
  mResponseMessage = new string();
  mResponseMessagePos = 0;
  *mResponseMessage = "";

  //  mRequest->mContentType = MEMBLOCK;

  mRequest->mConnState = SERVING;
  char buf[30];
  char line[400];

  string hdr = "";

  *mResponseMessage += "<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n";

  snprintf(line, sizeof(line), "<MPD type=\"OnDemand\" minBufferTime=\"PT%dS\" mediaPresentationDuration=\"PT%.1fS\"", 
	   mRequest->mFactory->getConfig()->getHasMinBufferTime(), duration);
  *mResponseMessage = *mResponseMessage + line;

  *mResponseMessage += " xmlns:xsi=\"http://www.w3.org/2001/XMLSchema\" xmlns=\"urn:mpeg:mpegB:schema:DASH:MPD:DIS2011\" ";
  *mResponseMessage += "xsi:schemaLocation=\"urn:mpeg:mpegB:schema:DASH:MPD:DIS2011\">\n";
  *mResponseMessage += "<ProgramInformation>\n";
  *mResponseMessage += "<ChapterDataURL/>\n";
  *mResponseMessage += "</ProgramInformation>\n";
  *mResponseMessage += "<Period start=\"PT0S\" segmentAlignmentFlag=\"True\">\n"; 
  // SD: 720x 576
  // HD: 1280x 720
  //  snprintf(line, sizeof(line), "<Representation id=\"0\" mimeType=\"video/mpeg\" bandwidth=\"%d\" startWithRAP=\"True\" width=\"1280\" height=\"720\" group=\"0\">\n", mRequest->mFactory->getConfig()->getHasBitrate());
  snprintf(line, sizeof(line), "<Representation id=\"0\" mimeType=\"video/mpeg\" bandwidth=\"%d\" startWithRAP=\"True\" %s group=\"0\">\n", 
	   bitrate, ((bitrate < 10000000)? "width=\"720\" height=\"576\"" : "width=\"1280\" height=\"720\""));
  *mResponseMessage = *mResponseMessage + line;

  hdr = "<SegmentInfo duration=";
  snprintf(buf, sizeof(buf), "\"PT%.1fS\"", (seg_dur*1.0));
  hdr = hdr + buf + " >\n";
  *mResponseMessage += hdr;
  
  snprintf(buf, sizeof(buf), "\"%d\"", end_seg);
  *mResponseMessage += "<UrlTemplate sourceURL=\"$Index$-seg.ts\" startIndex=\"1\" endIndex=";
  hdr = buf ;
  *mResponseMessage += hdr + " />\n";
  
  *mResponseMessage += "</SegmentInfo>\n";
  *mResponseMessage += "</Representation>\n";
  *mResponseMessage += "</Period>\n";
  *mResponseMessage += "</MPD>";

  sendHeaders(200, "OK", NULL, "application/x-mpegURL", mResponseMessage->size(), -1);
}


uint64_t cResponseMemBlk::getVdrFileSize() {
  // iter over all vdr files and get file size
  struct stat statbuf;
  string file_structure = "%s/%05d.ts";     // Only ts supported for HLS and HAS
  char pathbuf[4096];
  int vdr_idx = 0;
  uint64_t total_file_size = 0; 
  bool more_to_go = true;

  while (more_to_go) {
    vdr_idx ++;
    snprintf(pathbuf, sizeof(pathbuf), file_structure.c_str(), mRequest->mDir.c_str(), vdr_idx);
    if (stat(pathbuf, &statbuf) >= 0) {
      total_file_size += statbuf.st_size;
    }
    else {
      more_to_go = false;
    }    
  }
  return total_file_size;
}

// - Manifest End



// --------------------
// GET Resources
// --------------------


// common for all create xml file modules
int cResponseMemBlk::writeXmlItem(string name, string link, string programme, string desc, string guid, int no, time_t start, int dur, double fps, int is_pes, int is_new) {
  string hdr = "";
  char f[400];

  hdr += "<item>\n";
  //  snprintf(f, sizeof(f), "%s - %s", );
  hdr += "<title>" + name +"</title>\n";
  hdr += "<link>" +link + "</link>\n";
  hdr += "<enclosure url=\"" +link + "\" type=\"video/mpeg\" />\n";
  
  hdr += "<guid>" + guid + "</guid>\n";

  snprintf(f, sizeof(f), "%d", no);
  hdr += "<number>";
  hdr += f;
  hdr += "</number>\n";

  hdr += "<programme>" + programme +"</programme>\n";
  hdr += "<description>" + desc + "</description>\n";

  snprintf(f, sizeof(f), "%ld", start);
  hdr += "<start>";
  hdr += f;
  hdr += "</start>\n";

  snprintf(f, sizeof(f), "%d", dur);
  hdr += "<duration>";
  hdr += f;
  hdr += "</duration>\n";

  if (fps != -1)
    snprintf(f, sizeof(f), "<fps>%.2f</fps>\n", fps);
  else
    snprintf(f, sizeof(f), "<fps>unknown</fps>\n");
  hdr += f;

  switch (is_pes){
  case -1:
    // unknown
    hdr += "<ispes>unknown</ispes>\n";
    break;
  case 0: 
    // true
    hdr += "<ispes>true</ispes>\n";
    break;
  case 1:
    // false
    hdr += "<ispes>false</ispes>\n";
    break;
  default:
    break;
  }

  switch (is_new){
  case -1:
    // unknown
    hdr += "<isnew>unknown</isnew>\n";
    break;
  case 0: 
    // true
    hdr += "<isnew>true</isnew>\n";
    break;
  case 1:
    // false
    hdr += "<isnew>false</isnew>\n";
    break;
  default:
    break;
  }

  hdr += "</item>\n";

  *mResponseMessage += hdr;


    //  return writeToClient(hdr.c_str(), hdr.size()); 
    return OKAY;
}





int cResponseMemBlk::sendUrlsXml () {
  // read urls file and generate XML
  string type;
  string value;
  string line;
  if (isHeadRequest())
    return OKAY;

  mResponseMessage = new string();
  mResponseMessagePos = 0;
  *mResponseMessage = "";
  //  mRequest->mContentType = MEMBLOCK;

  mRequest->mConnState = SERVING;
  
  cManageUrls* urls = mRequest->mFactory->getUrlsObj();

  //  ifstream myfile ((mRequest->mFactory->getConfigDir() +"/urls.txt").c_str());
  // An empty xml is provided, if the file does not exist.

  //thlo: here to continue
  *mResponseMessage = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  *mResponseMessage += "<rss version=\"2.0\">\n";
  *mResponseMessage += "<channel>\n";

  for (uint i = 0; i < urls->size(); i++) {
    *mResponseMessage += "<item>\n<guid>";
    *mResponseMessage += (urls->getEntry(i))->mEntry;
    *mResponseMessage += "</guid>\n</item>\n";
  }

  /*
  while ( myfile.good() ) {
    getline (myfile, line);

    if ((line == "") or (line[0] == '#'))
      continue;

    size_t pos = line.find('|');
    type = line.substr(0, pos);
    value = line.substr(pos+1);
    
    if (type.compare("YT")==0) {
      *mResponseMessage += "<item>\n<guid>";
      *mResponseMessage += value;
      *mResponseMessage += "</guid>\n</item>\n";
      continue;
    }

    *mResponseMessage += "<item>\n<title>";
    *mResponseMessage += "Unknown: " + line + " type=" + type;
    
    *mResponseMessage += "</title>\n</item>\n";
  }
  myfile.close();
*/
  *mResponseMessage += "</channel>\n";
  *mResponseMessage += "</rss>\n";

  sendHeaders(200, "OK", NULL, "application/xml", mResponseMessage->size(), -1);
  return OKAY;
}




// mediaXML
int cResponseMemBlk::parseFiles(vector<sFileEntry> *entries, string prefix, string dir_base, string dir_name, struct stat *statbuf) {
  char pathbuf[4096];
  string link;
  DIR *dir;
  struct dirent *de;
  string dir_comp;
  dir_comp = dir_base + dir_name + "/";

#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX 
		 << " parseFiles: Prefix= " << prefix 
		 << " base= " << dir_base
		 << " dir= " << dir_name 
		 << " comp= " << dir_comp
		 << endl;
#endif

  dir = opendir(dir_comp.c_str());
  if (stat(dir_comp.c_str(), statbuf) < 0)
    return ERROR;

  while ((de = readdir(dir)) != NULL) {
    if ((strcmp(de->d_name, ".") == 0) or (strcmp(de->d_name, "..") == 0)) {
      continue;
    } 

    strcpy(pathbuf, dir_comp.c_str());
    strcat(pathbuf, de->d_name);
    
    stat(pathbuf, statbuf);

    if (S_ISDIR(statbuf->st_mode)) {
      if (strcmp(&(pathbuf[strlen(pathbuf)-4]), ".rec") == 0) {
	// vdr folder
	time_t now = time(NULL);
	struct tm tm_r;
	struct tm t = *localtime_r(&now, &tm_r); 
	t.tm_isdst = -1; 
	//	char [20] rest;
	int start = -1;
	sscanf(de->d_name, "%4d-%02d-%02d.%02d.%02d", &t.tm_year, &t.tm_mon, &t.tm_mday, &t.tm_hour, &t.tm_min);

	//	sscanf(de->d_name, "%4d-%02d-%02d.%02d%.%02d", &t.tm_year, &t.tm_mon, &t.tm_mday, &t.tm_hour, &t.tm_min);
	t.tm_year -= 1900;
	t.tm_mon--;
	t.tm_sec = 0;
	start = mktime(&t);
	
#ifndef DEBUG
	*(mLog->log()) << DEBUGPREFIX 
		       << " Vdr Folder Found: " << pathbuf << " start= " << start << endl;
#endif

	entries->push_back(sFileEntry(dir_name, pathbuf, start));
      }
      else {
	// regular file
	parseFiles(entries, prefix + de->d_name + "~", dir_comp, de->d_name, statbuf);
      }
    }
    else {
      if ((de->d_name)[0] != '.' )
	entries->push_back(sFileEntry(prefix+de->d_name, pathbuf, 1));
    }
  }
  closedir(dir);
  return OKAY;
}

int cResponseMemBlk::sendMediaXml (struct stat *statbuf) {
  char pathbuf[4096];
  string link;
  string media_folder = mRequest->mFactory->getConfig()->getMediaFolder();

  if (isHeadRequest())
    return OKAY;

  
  mResponseMessage = new string();
  mResponseMessagePos = 0;

  *mResponseMessage = "";

  mRequest->mConnState = SERVING;

#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX << " sendMedia "  << endl;  
#endif

  string own_ip = mRequest->getOwnIp();
  *(mLog->log()) << " OwnIP= " << own_ip << endl;

  vector<sFileEntry> entries;

  if (parseFiles(&entries, "", media_folder, "", statbuf) == ERROR) {
    sendError(404, "Not Found", NULL, "Media Folder likely not configured.");
    return OKAY;
  }
    
  string hdr = "";
  hdr += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  hdr += "<rss version=\"2.0\">\n";
  hdr+= "<channel>\n";

  *mResponseMessage += hdr;

  hdr = "";

  for (uint i=0; i < entries.size(); i++) {
    
    snprintf(pathbuf, sizeof(pathbuf), "http://%s:%d%s", own_ip.c_str(), mRequest->mServerPort, 
    	     cUrlEncode::doUrlSaveEncode(entries[i].sPath).c_str());
    if (writeXmlItem(cUrlEncode::doXmlSaveEncode(entries[i].sName), pathbuf, "NA", "NA", "-", 
		     -1, entries[i].sStart, -1, -1, -1, -1) == ERROR) 
      return ERROR;

  }
     
  hdr = "</channel>\n";
  hdr += "</rss>\n";
  *mResponseMessage += hdr;
  sendHeaders(200, "OK", NULL, "application/xml", mResponseMessage->size(), statbuf->st_mtime);

  return OKAY;
}





int cResponseMemBlk::sendVdrStatusXml (struct stat *statbuf) {
  if (isHeadRequest())
    return OKAY;

#ifndef STANDALONE

  char f[400];
  mResponseMessage = new string();
  *mResponseMessage = "";
  
  mResponseMessagePos = 0;

  mRequest->mConnState = SERVING;

  int free;
  int used;
  int percent;

  percent = VideoDiskSpace(&free, &used);

  *mResponseMessage += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  *mResponseMessage += "<vdrstatus>\n";

  *mResponseMessage += "<diskspace>\n";  
  snprintf(f, sizeof(f), "<free>%d</free>", free);
  *mResponseMessage += f;

  snprintf(f, sizeof(f), "<used>%d</used>", used);
  *mResponseMessage += f;
  snprintf(f, sizeof(f), "<percent>%d</percent>", percent);
  *mResponseMessage += f;
  *mResponseMessage += "</diskspace>\n";
  
  *mResponseMessage += "</vdrstatus>\n";

  sendHeaders(200, "OK", NULL, "application/xml", mResponseMessage->size(), -1);
#else
  sendHeaders(200, "OK", NULL, NULL, 0, -1);
#endif
  return OKAY;
}

int cResponseMemBlk::sendYtBookmarkletJs() {
  *(mLog->log()) << DEBUGPREFIX
		 << " sendYtBookmarkletJs" << endl;

  vector<sQueryAVP> avps;
  mRequest->parseQueryLine(&avps);
  string store_str = "";
  bool store= true;

  if (isHeadRequest())
    return OKAY;

  if (mRequest->getQueryAttributeValue(&avps, "store", store_str) == OKAY) {
    if (store_str.compare("false") == 0) {
	store= false;
	*(mLog->log()) << DEBUGPREFIX
		   << " store= false "  << endl;
    }
  }

  mResponseMessage = new string();
  *mResponseMessage = "";
  mResponseMessagePos = 0;
  //  mRequest->mContentType = MEMBLOCK;

  mRequest->mConnState = SERVING;

  stringstream own_host ;
  own_host << "http://" 
	 << mRequest->getOwnIp()
	 << ":" << mRequest->mServerPort;

  //  string own_host = "http://"+mRequest->getOwnIp()+ ":" + str;

  *(mLog->log()) << " Ownhost= " << own_host.str() << endl;


  *mResponseMessage = "function get_query_var (querystring, name) {  "
    "var filter = new RegExp( name + \"=([^&]+)\" ); "
    "var res = null;"
    "if (querystring != null)"
    " res  = querystring.match(filter);"
    " if (res != null) return unescape( res[1] );"
    " else return \"\";"
    "}"
    "var vid_id= get_query_var(document.URL, \"v\");"

    "var iframe = document.createElement(\"iframe\");"
    "iframe.setAttribute(\"name\",\"myiframe\");"
    "iframe.setAttribute(\"frameborder\",\"0\");"
    "iframe.setAttribute(\"scrolling\",\"no\");"
    "iframe.setAttribute(\"src\",\"about:blank\");"
    "iframe.setAttribute(\"width\",\"1\");"
    "iframe.setAttribute(\"height\",\"1\");"
    "document.body.appendChild(iframe);"

    "var form = document.createElement(\"form\");"
    "form.setAttribute(\"method\", \"POST\");"
    "form.setAttribute(\"target\", \"myiframe\");"
    "form.setAttribute(\"action\", \"" + own_host.str() + "/setYtUrl?line=\"+vid_id"+((!store)?"+\"&store=false\"":"")+");"
    "var hiddenField = document.createElement(\"input\");"
    "form.appendChild(hiddenField);"
    "hiddenField.setAttribute(\"type\", \"hidden\");"
    "hiddenField.setAttribute(\"name\", \"line\");"
    "hiddenField.setAttribute(\"value\", vid_id);"
    "document.body.appendChild(form);"
    "form.submit();"
    ;

  sendHeaders(200, "OK", NULL, "text/javascript", mResponseMessage->size(), -1);
  return OKAY;
}

int cResponseMemBlk::sendBmlInstHtml() {
  *(mLog->log()) << DEBUGPREFIX
		 << " sendBmlInstHtml" << endl;

  if (isHeadRequest())
    return OKAY;

  mResponseMessage = new string();
  *mResponseMessage = "";
  mResponseMessagePos = 0;
  //  mRequest->mContentType = MEMBLOCK;

  mRequest->mConnState = SERVING;

  stringstream own_host ;
  own_host << "http://" 
	 << mRequest->getOwnIp()
	 << ":" << mRequest->mServerPort;

  *(mLog->log()) << " Ownhost= " << own_host << endl;

  *mResponseMessage = "<html><head>"
    "<title>SmartTVWeb Bookmarklets</title>"
    "</head><body>"
    "<br>"
    "<h2>Bookmarklet for collecting YouTube Pages</h2>"
    "<hr width=\"80%\">"
    "<br>"
    "<h3>Installation</h3>"
    "Drag the link below to your Bookmarks toolbar"
    "<p>or</p>"
    "<p>Right click and select &#8220;Bookmark This Link&#8221;</p>"
    "<p><a href='javascript:document.body.appendChild(document.createElement(&quot;script&quot;)).src=&quot;"+own_host.str()+"/yt-bookmarklet.js&quot;;void(0)'>YT SaveNPlay</a>: Save the video and also Play it.</p>"
    "<p><a href='javascript:document.body.appendChild(document.createElement(&quot;script&quot;)).src=&quot;"+own_host.str()+"/yt-bookmarklet.js?store=false&quot;;void(0)'>YT Play</a>: Play the video without saving.</p>"
    "<br>"
    "<hr width=\"80%\">"
    "<h3>Usage</h3>"
    "<p>Browse to your favorite YouTube page and click the bookmark to the bookmarklet (link above). The YouTube video is then provided to the VDR smarttvweb plugin, stored there and pushed to the TV screen for immediate playback. Tested with Firefox.</p>"
    "<br>"
    "<hr width=\"80%\">"
    "<p>Have fun...<br></p>"
    "</body>";

  sendHeaders(200, "OK", NULL, "text/html", mResponseMessage->size(), -1);
  return OKAY;
}



int cResponseMemBlk::sendChannelsXml (struct stat *statbuf) {
  if (isHeadRequest())
    return OKAY;

#ifndef STANDALONE

  char f[400];
  mResponseMessage = new string();
  *mResponseMessage = "";
  mResponseMessagePos = 0;
  //  mRequest->mContentType = MEMBLOCK;

  mRequest->mConnState = SERVING;

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " generating /channels.xml" 
		<< endl;
#endif
  string own_ip = mRequest->getOwnIp();
  *(mLog->log()) << " OwnIP= " << own_ip << endl;

  vector<sQueryAVP> avps;
  mRequest->parseQueryLine(&avps);
  string mode = "";
  bool add_desc = true; 

  string no_channels_str = "";
  int no_channels = -1;
  string group_sep = "";
  
  if (mRequest->getQueryAttributeValue(&avps, "mode", mode) == OKAY){
    if (mode == "nodesc") {
      add_desc = false;
      *(mLog->log())<< DEBUGPREFIX
		    << " Mode: No Description"
		    << endl;
    }
    else {
      *(mLog->log())<< DEBUGPREFIX
		    << " Mode: Unknown"
		    << endl;
    }
  }
  if (mRequest->getQueryAttributeValue(&avps, "channels", no_channels_str) == OKAY){
    no_channels = atoi(no_channels_str.c_str()) ;
  }

  
  string hdr = "";
  hdr += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  hdr += "<rss version=\"2.0\">\n";
  hdr+= "<channel>\n";
  hdr+= "<title>VDR Channels List</title>\n";


  *mResponseMessage += hdr;

  int count = mRequest->mFactory->getConfig()->getLiveChannels();
  if (no_channels > 0)
    count = no_channels +1;
  
  cSchedulesLock * lock = new cSchedulesLock(false, 500);
  const cSchedules *schedules = cSchedules::Schedules(*lock); 

  for (cChannel *channel = Channels.First(); channel; channel = Channels.Next(channel)) {
    if (channel->GroupSep()) {
      if (mRequest->mFactory->getConfig()->getGroupSep() != IGNORE) {
	// if emtpyFolderDown, always.
	// otherwise, only when not empty
	if (!((strcmp(channel->Name(), "") == 0) && (mRequest->mFactory->getConfig()->getGroupSep() == EMPTYIGNORE)))
	  group_sep = cUrlEncode::doXmlSaveEncode(channel->Name());

      }
      continue;
    }
    if (--count == 0) {
      break;
    }

    //    snprintf(f, sizeof(f), "http://%s:3000/%s.ts", mServerAddr.c_str(), *(channel->GetChannelID()).ToString());
    snprintf(f, sizeof(f), "http://%s:3000/%s.ts", own_ip.c_str(), *(channel->GetChannelID()).ToString());
    string link = f;

    const cSchedule *schedule = schedules->GetSchedule(channel->GetChannelID());
    string desc = "No description available";
    string title = "Not available"; 
    time_t start_time = 0;
    int duration = 0;
    
    if (schedule != NULL) {
      const cEvent *ev = schedule->GetPresentEvent();
      if (ev != NULL) {
	if ((ev->Description() != NULL) && add_desc)
	  desc = cUrlEncode::doXmlSaveEncode(ev->Description());
	
	if ((ev->Title() != NULL) && add_desc)
	  title = cUrlEncode::doXmlSaveEncode(ev->Title());
	start_time = ev->StartTime();
	duration = ev->Duration();
      }
      else {
	*(mLog->log())<< DEBUGPREFIX
		      << " Event Info is Zero for Count= " 
		      << count 
		      << " Name= " << channel->Name() << endl;	
      }
    }
    else {
      *(mLog->log())<< DEBUGPREFIX
		    << " Schedule is Zero for Count= " 
		    << count 
		    << " Name= " << channel->Name() << endl;
    }
    
    string c_name = (group_sep != "") ? (group_sep + "~" + cUrlEncode::doXmlSaveEncode(channel->Name())) 
      : cUrlEncode::doXmlSaveEncode(channel->Name()); 
    //    if (writeXmlItem(channel->Name(), link, title, desc, *(channel->GetChannelID()).ToString(), start_time, duration) == ERROR) 
    if (writeXmlItem(c_name, link, title, desc, *(channel->GetChannelID()).ToString(), channel->Number(), start_time, duration, -1, -1, -1) == ERROR) 
      return ERROR;

  }

  hdr = "</channel>\n";
  hdr += "</rss>\n";
  
  *mResponseMessage += hdr;
  delete lock;
  sendHeaders(200, "OK", NULL, "application/xml", mResponseMessage->size(), statbuf->st_mtime);

#endif
  return OKAY;
}

int cResponseMemBlk::sendEpgXml (struct stat *statbuf) {
  if (isHeadRequest())
    return OKAY;

#ifndef STANDALONE

  char f[400];
  mResponseMessage = new string();
  *mResponseMessage = "";
  mResponseMessagePos = 0;
  //  mRequest->mContentType = MEMBLOCK;

  mRequest->mConnState = SERVING;

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " generating /epg.xml" 
		<< endl;
#endif
  vector<sQueryAVP> avps;
  mRequest->parseQueryLine(&avps);
  string id = "S19.2E-1-1107-17500";
  string mode = "";
  bool add_desc = true; 

  if (mRequest->getQueryAttributeValue(&avps, "id", id) == ERROR){
    *(mLog->log())<< DEBUGPREFIX
		  << " ERROR: id not found" 
		  << endl;
    delete mResponseMessage;
    mResponseMessage = NULL;
    sendError(400, "Bad Request", NULL, "no id in query line");
    return OKAY;
  }

  if (mRequest->getQueryAttributeValue(&avps, "mode", mode) == OKAY){
    if (mode == "nodesc") {
      add_desc = false;
      *(mLog->log())<< DEBUGPREFIX
		    << " **** Mode: No Description ****"
		    << endl;
    }
  }

  tChannelID chan_id = tChannelID::FromString (id.c_str());
  if ( chan_id  == tChannelID::InvalidID) {
    *(mLog->log())<< DEBUGPREFIX
		  << " ERROR: Not possible to get the ChannelId from the string" 
		  << endl;
    delete mResponseMessage;
    mResponseMessage = NULL; 
    sendError(400, "Bad Request", NULL, "Invalid Channel ID.");
    return OKAY;
  }

  cSchedulesLock * lock = new cSchedulesLock(false, 500);
  const cSchedules *schedules = cSchedules::Schedules(*lock);
 
  const cSchedule *schedule = schedules->GetSchedule(chan_id);
  if (schedule == NULL) {
    *(mLog->log())<< DEBUGPREFIX
		  << "ERROR: Schedule is zero for guid= " << id
		  << endl;
    delete mResponseMessage;
    mResponseMessage = NULL;
    sendError(500, "Internal Server Error", NULL, "Schedule is zero.");
    return OKAY;
  }

  time_t now = time(NULL);
  const cEvent *ev = NULL;
  for(cEvent* e = schedule->Events()->First(); e; e = schedule->Events()->Next(e)) {
    if ( (e->StartTime() <= now) && (e->EndTime() > now)) {
      ev = e;
	
    } else if (e->StartTime() > now + 3600) {
      break;
    }
  }
  
  //  const cEvent * ev = schedule->GetPresentEvent();

  if (ev == NULL) {
    *(mLog->log())<< DEBUGPREFIX
		  << "ERROR: Event is zero for guid= " << id
		  << endl;
    delete mResponseMessage;
    mResponseMessage = NULL;
    sendError(500, "Internal Server Error", NULL, "Event is zero.");
    return OKAY;
  }
  
  string hdr = "";
  hdr += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  hdr += "<tv version=\"2.0\">\n";
  hdr+= "<programme>\n";

  *mResponseMessage += hdr;
  // Payload here

  hdr = "";
  if (ev->Title() != NULL) {
    string title = cUrlEncode::doXmlSaveEncode(ev->Title());
    hdr += "<title>" + title +"</title>\n";
  }
  else {
    *(mLog->log())<< DEBUGPREFIX
		  << " ERROR: title is zero for guid= " << id  << endl;
    hdr += "<title>Empty</title>\n";

    delete mResponseMessage;
    mResponseMessage = NULL;
    sendError(500, "Internal Server Error", NULL, "Title is zero.");
    return OKAY;
  }

  hdr += "<guid>" + id + "</guid>\n";

  *(mLog->log())<< DEBUGPREFIX
		<< " guid= " << id
		<< " title= " << ev->Title()
		<< " start= " << ev->StartTime()
		<< " end= " << ev->EndTime()
		<< " now= " << now
		<< endl;
  if (add_desc) {
    hdr += "<desc>";
    if (ev->Description() != NULL) {
      hdr += cUrlEncode::doXmlSaveEncode(ev->Description());
    }
    else {
      *(mLog->log())<< DEBUGPREFIX
		    << " ERROR: description is zero for guid= " << id << endl;
      
      delete mResponseMessage;
      mResponseMessage = NULL;
      sendError(500, "Internal Server Error", NULL, "Description is zero.");
      return OKAY;
    }
    hdr += "</desc>\n";
  }
  else {
    hdr += "<desc>No Description Available</desc>\n";
  }
  snprintf(f, sizeof(f), "<start>%ld</start>\n", ev->StartTime());
  hdr += f ;

  snprintf(f, sizeof(f), "<end>%ld</end>\n", ev->EndTime());
  hdr += f;

  snprintf(f, sizeof(f), "<duration>%d</duration>\n", ev->Duration());
  hdr += f;
  *mResponseMessage += hdr;

  hdr = "</programme>\n";
  hdr += "</tv>\n";
  
  *mResponseMessage += hdr;

  delete lock;

  sendHeaders(200, "OK", NULL, "application/xml", mResponseMessage->size(), -1);

#endif
  return OKAY;
}



int cResponseMemBlk::sendRecordingsXml(struct stat *statbuf) {
  if (isHeadRequest())
    return OKAY;
#ifndef STANDALONE

  mResponseMessage = new string();
  *mResponseMessage = "";
  mResponseMessagePos = 0;
  //  mRequest->mContentType = MEMBLOCK;

  mRequest->mConnState = SERVING;

  string own_ip = mRequest->getOwnIp();
  *(mLog->log()) << " OwnIP= " << own_ip << endl;

  vector<sQueryAVP> avps;
  mRequest->parseQueryLine(&avps);
  string model = "";
  string link_ext = ""; 
  string type = "";
  string has_4_hd_str = "";
  bool has_4_hd = true;
  string mode = "";
  bool add_desc = true; 
  string guid = "";
  bool single_item = false;
  
  if (mRequest->getQueryAttributeValue(&avps, "model", model) == OKAY){
    *(mLog->log())<< DEBUGPREFIX
		  << " Found a Model Parameter: " << model
		  << endl;
  }

  if (mRequest->getQueryAttributeValue(&avps, "guid", guid) == OKAY){
    *(mLog->log())<< DEBUGPREFIX
		  << " Found a guid Parameter: " << guid
		  << endl;
    single_item = true;
  }

  if (mRequest->getQueryAttributeValue(&avps, "type", type) == OKAY){
    *(mLog->log())<< DEBUGPREFIX
		  << " Found a Type Parameter: " << type
		  << endl;
    if (type == "hls") { 
      if (model == "samsung") 
	link_ext = "/manifest-seg.m3u8|COMPONENT=HLS";
      else
	link_ext = "/manifest-seg.m3u8";
    }
    if (type == "has") {
      if (model == "samsung") 
	link_ext = "/manifest-seg.mpd|COMPONENT=HAS";
      else
	link_ext = "/manifest-seg.mpd";
    }
  }

  if (mRequest->getQueryAttributeValue(&avps, "mode", mode) == OKAY){
    if (mode == "nodesc") {
      add_desc = false;
      *(mLog->log())<< DEBUGPREFIX
		    << " Mode: No Description"
		    << endl;
    }
  }

  if (mRequest->getQueryAttributeValue(&avps, "has4hd", has_4_hd_str) == OKAY){
    *(mLog->log())<< DEBUGPREFIX
		  << " Found a Has4Hd Parameter: " << has_4_hd_str
		  << endl;
    if (has_4_hd_str == "false")
      has_4_hd = false;
  }


#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " generating /recordings.xml" 
		<< endl;
#endif

  //--------------------
  char f[600];

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " recordings->Count()= " << recordings->Count()
		<< endl;
#endif

  // List of recording timer
  time_t now = time(NULL);

  vector<sTimerEntry> act_rec;
  /*#ifndef DEBUG*/
  *(mLog->log())<< DEBUGPREFIX
		<< " checking avtive timer"
		<< endl;
  /*#endif*/
  for (cTimer * ti = Timers.First(); ti; ti = Timers.Next(ti)){
    ti->Matches();

    if (ti->HasFlags(tfRecording) ) {
      *(mLog->log()) << DEBUGPREFIX 
		     << " Active Timer: " << ti->File() 
		     << " Start= " << ti->StartTime() 
		     << " Duration= " << (ti->StopTime() - ti->StartTime())
		     << endl;
      act_rec.push_back(sTimerEntry(ti->File(), ti->StartTime(), (ti->StopTime() - ti->StartTime())));
    }
  }

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
		<< " Found " << act_rec.size()
		<< " running timers"
		<< endl;
#endif


  string hdr = "";
  hdr += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  hdr += "<rss version=\"2.0\">\n";
  hdr+= "<channel>\n";
  hdr+= "<title>VDR Recordings List</title>\n";

  *mResponseMessage += hdr;

  int item_count = 0;
  int rec_dur = 0;
  cRecording *recording = NULL;
  if (single_item) {
    recording = Recordings.GetByName(guid.c_str());
    if (recording == NULL)
      *(mLog->log())<< DEBUGPREFIX << " WARNING in sendRecordingsXml: recording " << guid << " not found" << endl;
  }
  else {
    recording = Recordings.First();
  }
  //  for (cRecording *recording = Recordings.First(); recording; recording = Recordings.Next(recording)) {
  while (recording != NULL) {
    hdr = "";

    if (recording->IsPesRecording() or ((recording->FramesPerSecond() > 30.0) and !has_4_hd )) 
      snprintf(f, sizeof(f), "http://%s:%d%s", own_ip.c_str(), mRequest->mServerPort, 
	       cUrlEncode::doUrlSaveEncode(recording->FileName()).c_str());
    else
      //      snprintf(f, sizeof(f), "http://%s:%d%s%s", mServerAddr.c_str(), mServerPort, 
      snprintf(f, sizeof(f), "http://%s:%d%s%s", own_ip.c_str(), mRequest->mServerPort, 
	       cUrlEncode::doUrlSaveEncode(recording->FileName()).c_str(), link_ext.c_str());

    string link = f;
    string desc = "No description available";
    rec_dur = recording->LengthInSeconds();

    string name = recording->Name();

    for (uint x = 0; x < act_rec.size(); x++) {
      if (act_rec[x].name == name) {

	// *(mLog->log())<< DEBUGPREFIX << " !!!!! Found active Recording !!! " << endl;
	rec_dur +=  (act_rec[x].startTime + act_rec[x].duration - now);
      }
    } // for

    if (recording->Info() != NULL) {
      if ((recording->Info()->Description() != NULL) && add_desc) {
	desc = cUrlEncode::doXmlSaveEncode(recording->Info()->Description());
      }
    }

    if (writeXmlItem(cUrlEncode::doXmlSaveEncode(recording->Name()), link, "NA", desc, 
		     cUrlEncode::doUrlSaveEncode(recording->FileName()).c_str(),
		     -1, 
		     recording->Start(), rec_dur, recording->FramesPerSecond(), 
		     (recording->IsPesRecording() ? 0: 1), (recording->IsNew() ? 0: 1)) == ERROR) {
      *mResponseMessage = "";
      sendError(500, "Internal Server Error", NULL, "writeXMLItem returned an error");
      return OKAY;
    }
    item_count ++;
    //    if (!single_item)
    //      recording = Recordings.Next(recording);
    recording = (!single_item) ? Recordings.Next(recording) : NULL;
  }

  hdr = "</channel>\n";
  hdr += "</rss>\n";
  
  *mResponseMessage += hdr;

  *(mLog->log())<< DEBUGPREFIX << " Recording Count= " <<item_count<< endl;

#endif
  sendHeaders(200, "OK", NULL, "application/xml", mResponseMessage->size(), statbuf->st_mtime);
  return OKAY;
}


int cResponseMemBlk::fillDataBlk() {
  mBlkPos = 0;
    
  if (mError) {
    *(mLog->log())<< DEBUGPREFIX << " mError == true -> Done" << endl;
    mRequest->mConnState = TOCLOSE;
    return ERROR;
  }

  if (mResponseMessage == NULL) {
#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX << " mResponseMessage == NULL -> Done" << endl;
#endif
    mRequest->mConnState = TOCLOSE;
    return ERROR;
  }
  
  int rem_len = mResponseMessage->size() - mResponseMessagePos;
  if (rem_len == 0) {

#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX << " fillDataBlock: MEMBLOCK done" << endl;
#endif
    delete mResponseMessage;
    mResponseMessage = NULL;
    mResponseMessagePos = 0;
    mRequest->mConnState = TOCLOSE;
    return ERROR;
  }

  if (rem_len > MAXLEN) 
    rem_len = MAXLEN;

  string sub_msg = mResponseMessage->substr(mResponseMessagePos, rem_len);
  mResponseMessagePos += rem_len;
  mBlkLen = sub_msg.size();

  memcpy(mBlkData, sub_msg.c_str(), rem_len);

  return OKAY;
}