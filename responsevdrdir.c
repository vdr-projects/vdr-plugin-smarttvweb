/*
 * responsevdrdir.c: VDR on Smart TV plugin
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


#include "responsevdrdir.h"
#include "httpresource.h"
#include "smarttvfactory.h"
#include <vector>
#include <cstdlib>

#ifndef STANDALONE
#include <vdr/recording.h>
//#include <vdr/channels.h>
//#include <vdr/timers.h>
//#include <vdr/videodir.h>
//#include <vdr/epg.h>
#else
#include <sys/stat.h>

#endif

//#define MAXLEN 4096
#define DEBUGPREFIX mLog->getTimeString() << ": mReqId= " << mRequest->mReqId << " fd= " << mRequest->mFd 
#define OKAY 0
#define ERROR (-1)
#define DEBUG

struct sVdrFileEntry {
  uint64_t sSize;
  uint64_t sFirstOffset;
  int sIdx;

  sVdrFileEntry () {}; 
  sVdrFileEntry (uint64_t s, uint64_t t, int i) 
  : sSize(s), sFirstOffset(t), sIdx(i) {};
};



// 8 Byte Per Entry
struct tIndexPes {
  uint32_t offset;
  uint8_t type;        // standalone
  uint8_t number;       // standalone
  uint16_t reserved;
  };


// 8 Byte per entry
struct tIndexTs {
  uint64_t offset:40; // up to 1TB per file (not using long long int here - must definitely be exactly 64 bit!)
  int reserved:7; // reserved for future use
  int independent:1; // marks frames that can be displayed by themselves (for trick modes)
  uint16_t number:16; // up to 64K files per recording
  };


cResponseVdrDir::cResponseVdrDir(cHttpResource* req) : cResponseBase(req), mIsRecording(false), 
  mStreamToEnd(false), mRecProgress(0.0), mVdrIdx(0), mFile(NULL), mFileStructure()  {
}

cResponseVdrDir::~cResponseVdrDir() {
  if (mFile != NULL) {
    *(mLog->log())<< DEBUGPREFIX
		  << " ERROR: mFile still open. Closing now..." << endl;
    fclose(mFile);
    mFile = NULL;
  } 
}


bool cResponseVdrDir::isTimeRequest(struct stat *statbuf) {

#ifndef STANDALONE
  vector<sQueryAVP> avps;
  mRequest->parseQueryLine(&avps);
  string time_str = "";
  string mode = "";
  float time = 0.0;

  if (mRequest->getQueryAttributeValue(&avps, "time", time_str) != OKAY){
    return false;
  }

  if (mRequest->getQueryAttributeValue(&avps, "mode", mode) == OKAY){
    if (mode.compare ("streamtoend") ==0) {
      mStreamToEnd = true;
    }
  }

  if (mIsRecording)
    mStreamToEnd = true;

  time = atof(time_str.c_str());
  *(mLog->log())<< DEBUGPREFIX
		<< " Found a Time Parameter: " << time
		<< " streamToEnd= " << ((mStreamToEnd) ? "true" : "false")
		<< endl;

  mRequest->mDir = mRequest->mPath;
  cRecording *rec = Recordings.GetByName(mRequest->mPath.c_str());
  if (rec == NULL) {
    *(mLog->log())<< DEBUGPREFIX
		  << " Error: Did not find recording= " << mRequest->mPath << endl;
    sendError(404, "Not Found", NULL, "003 File not found.");
    return true;
  }
  
  double fps = rec->FramesPerSecond();
  double dur = rec->NumFrames() * fps;
  bool is_pes = rec->IsPesRecording();
  if (dur < time) {
    sendError(400, "Bad Request", NULL, "013 Time to large.");
    return true;
  }

  int start_frame = int(time * fps) -25; 

  FILE* idx_file= NULL;

  if (is_pes){
    idx_file = fopen(((mRequest->mDir) +"/index.vdr").c_str(), "r");
    //    sendError(400, "Bad Request", NULL, "PES not yet supported.");
    //    return true;
  }
  else {
    idx_file = fopen(((mRequest->mDir) +"/index").c_str(), "r");
  }

  if (idx_file == NULL){
    *(mLog->log()) << DEBUGPREFIX
		   << " failed to open idx file = "<< (mRequest->mDir +"/index").c_str()
		   << endl;
    sendError(404, "Not Found", NULL, "004 Failed to open Index file");
    return OKAY;
  }

  int buffered_frames = 50;
  char *index_buf = new char[8 *buffered_frames]; // 50 indexes

  *(mLog->log()) << DEBUGPREFIX
		 << " seeking to start_frame= " << start_frame 
		 << " fps= " << fps << endl;
  fseek(idx_file, start_frame * 8, SEEK_SET);

  int buffered_indexes = fread(index_buf, 8, (buffered_frames), idx_file);

  fclose(idx_file);

  if(buffered_indexes <= 0 ) {
    *(mLog->log())<<DEBUGPREFIX
		  << " issue while reading, buffered_indexes <=0" << endl;
    delete[] index_buf;
    sendError(404, "Not Found", NULL, "005 Failed to read Index file");
    return OKAY;
  }

  *(mLog->log()) << DEBUGPREFIX
		 << " Finding I-Frame now" << endl;


  bool found_it = false;
  int i = 0;
  
  uint32_t offset = 0;
  int idx =0;
  int type =0;
      
  for (i= 0; i < buffered_indexes; i++){
    if (is_pes) { 
      tIndexPes in_read_pes;
      memcpy (&in_read_pes, &(index_buf[i*8]), 8);
      type = in_read_pes.type == 1;
      idx = in_read_pes.number;
      offset = in_read_pes.offset;
    }
    else{
      tIndexTs in_read_ts;
      memcpy (&in_read_ts, &(index_buf[i*8]), 8);
      type = in_read_ts.independent;
      idx = in_read_ts.number;
      offset = in_read_ts.offset;
    }      

    *(mLog->log()) << DEBUGPREFIX
		   << " Frame= " << i 
		   << " idx= "<< idx
		   << " offset= " << offset 
		   << " type= " << type
		   << endl;
    if (type){
      found_it = true;
      break;
    }
  }
  
  if (!found_it) {
    delete[] index_buf;
    sendError(404, "Not Found", NULL, "005 Failed to read Index file");
    return OKAY;
  }

  mVdrIdx = idx;

  *(mLog->log()) << DEBUGPREFIX
		   << " idx= "<< mVdrIdx
		   << " offset= " << offset 
		   << endl;

  delete[] index_buf;  

  char pathbuf[4096];
  snprintf(pathbuf, sizeof(pathbuf), mFileStructure.c_str(), (mRequest->mPath).c_str(), mVdrIdx);

  *(mLog->log()) << DEBUGPREFIX
		 << " Opening Path= "
		 << pathbuf << endl;
  if (openFile(pathbuf) != OKAY) {
    sendError(403, "Forbidden", NULL, "001 Access denied.");
    return true;
  }

  fseek(mFile, offset, SEEK_SET);

  if (mStreamToEnd) {
    sendHeaders(200, "OK", NULL, "video/mpeg", -1, -1);
    return true;
  }

  uint64_t file_size = 0;
  bool more_to_go = true;
  int vdr_idx = mVdrIdx;
  
  while (more_to_go) {
    snprintf(pathbuf, sizeof(pathbuf), mFileStructure.c_str(), (mRequest->mPath).c_str(), vdr_idx);
    if (stat(pathbuf, statbuf) >= 0) {
      *(mLog->log())<< " found for " <<   pathbuf << endl;
      file_size += statbuf->st_size;
    }
    else {
      more_to_go = false;
    }
    vdr_idx ++;
  }
  mRemLength = file_size - offset;
 
  *(mLog->log()) << DEBUGPREFIX
		 << " Done. Start Streaming " 
		 << endl;

  if ((mRequest->rangeHdr).isRangeRequest) {
    snprintf(pathbuf, sizeof(pathbuf), "Content-Range: bytes 0-%lld/%lld", (mRemLength -1), mRemLength);
    sendHeaders(206, "Partial Content", pathbuf, "video/mpeg", mRemLength, statbuf->st_mtime);
  }
  else {
    sendHeaders(200, "OK", NULL, "video/mpeg", mRemLength, -1);
  }  
  return true;
#else
  return false;
#endif
}

// Needed by createRecordings.xml and byCreateManifest
void cResponseVdrDir::checkRecording() {
  // sets mIsRecording to true when the recording is still on-going
  mIsRecording = false;

#ifndef STANDALONE
  time_t now = time(NULL);

  //  cRecordings* recordings = mFactory->getRecordings();
  cRecordings* recordings = &Recordings;
#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX 
		<< " GetByName(" <<(mRequest->mPath).c_str() << ")"
		<< endl;
#endif
  cRecording* rec = recordings->GetByName((mRequest->mPath).c_str());  
  if (rec != NULL) {
    const cEvent *ev = rec->Info()->GetEvent();
    if (ev != NULL) {
      if (now  < ev->EndTime()) {
	// still recording
	mIsRecording = true;

	// mRecProgress * curFileSize = estimated File Size
	mRecProgress = (ev->EndTime() - ev->StartTime()) *1.1 / (rec->NumFrames() / rec->FramesPerSecond()); 
	//	mRecProgress = (ev->EndTime() - ev->StartTime()) *1.0/ (now - ev->StartTime());
#ifndef DEBUG
	*(mLog->log())<< DEBUGPREFIX
		      << " **** is still recording for mIsRecording= " 
		      << mIsRecording 
		      << " mRecProgress= " << mRecProgress << endl;
#endif
      }
    }

#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX  
		  << " checking, whether recording is on-going"
		  << " now= " << now << " start= " << rec->Start()
		  << " curDur= " << rec->LengthInSeconds()
		  << endl;
#endif
  }
#ifndef DEBUG
  else {
    *(mLog->log())<< DEBUGPREFIX
		  << " **** Recording Entry Not found **** " << endl;
  }
#endif
#endif
}



int cResponseVdrDir::sendVdrDir(struct stat *statbuf) {

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX  << " *** sendVdrDir mPath= "  << mRequest->mPath  << endl;
#endif  

  char pathbuf[4096];
  char f[400];
  int vdr_idx = 0;
  uint64_t total_file_size = 0; 
  //  int ret = OKAY;
  string vdr_dir = mRequest->mPath;
  vector<sVdrFileEntry> file_sizes;
  bool more_to_go = true;

  if (isHeadRequest())
    return OKAY;

  checkRecording();

  mVdrIdx = 1;
  mFileStructure = "%s/%03d.vdr";

  snprintf(pathbuf, sizeof(pathbuf), mFileStructure.c_str(), (mRequest->mPath).c_str(), 1);
  if (stat(pathbuf, statbuf) < 0) {
    mFileStructure = "%s/%05d.ts";    
#ifndef DEBUG
    *(mLog->log())<< DEBUGPREFIX  << " using dir format: " << mFileStructure.c_str() << endl;
#endif
  }

  // The range request functions are activated, when a time header is detected
  if (isTimeRequest(statbuf)) {
    *(mLog->log())<< DEBUGPREFIX
		  << " isTimeRequest is true"
		  << endl;
    return OKAY;
  }

  // --- looup all vdr files in the dir ---
  while (more_to_go) {
    vdr_idx ++;
    snprintf(pathbuf, sizeof(pathbuf), mFileStructure.c_str(), (mRequest->mPath).c_str(), vdr_idx);
    if (stat(pathbuf, statbuf) >= 0) {
#ifndef DEBUG
      *(mLog->log())<< " found for " <<   pathbuf << endl;
#endif
      file_sizes.push_back(sVdrFileEntry(statbuf->st_size, total_file_size, vdr_idx));
      total_file_size += statbuf->st_size;
    }
    else {
      more_to_go = false;
    }
  }
  if (file_sizes.size() < 1) {
    // There seems to be vdr video file in the directory
    *(mLog->log())<< DEBUGPREFIX
	 << " No video file in the directory" 
	 << endl;
    sendError(404, "Not Found", NULL, "003 File not found.");
    return OKAY;
  }

#ifndef DEBUG
  *(mLog->log())<< DEBUGPREFIX
       << " vdr filesize list " 
       << DEBUGHDR << endl;
  for (uint i = 0; i < file_sizes.size(); i++)
    *(mLog->log())<< " i= " << i << " size= " << file_sizes[i].sSize << " firstOffset= " << file_sizes[i].sFirstOffset << endl;
  *(mLog->log())<< " total_file_size= " << total_file_size << endl << endl;
#endif

  // total_file_size (on disk)
  
  // ---------------- file sizes ---------------------

  uint cur_idx = 0;

#ifndef DEBUG
    if (mIsRecording) {
      snprintf(f, sizeof(f), " CurFileSize= %lld mRecProgress= %f ExtFileSize= %lld", total_file_size, mRecProgress, (long long int)(mRecProgress * total_file_size));
      *(mLog->log()) << DEBUGPREFIX
		     << endl << " isRecording: " << f 
		     << endl;      
    }
#endif

    if (!(mRequest->rangeHdr).isRangeRequest) {
    snprintf(pathbuf, sizeof(pathbuf), mFileStructure.c_str(), (mRequest->mPath).c_str(), file_sizes[cur_idx].sIdx);

    if (openFile(pathbuf) != OKAY) {
      sendError(403, "Forbidden", NULL, "001 Access denied.");
      return OKAY;
    }

    mRemLength = total_file_size;

    sendHeaders(200, "OK", NULL, "video/mpeg", ((mIsRecording) ? (mRecProgress * total_file_size): total_file_size ), statbuf->st_mtime);
  }
  else { // Range request
    // idenify the first file
#ifndef DEBUG
    *(mLog->log()) << DEBUGPREFIX
		   << endl <<" --- Range Request Handling ---" 
		   << DEBUGHDR << endl;
#endif
    if (mIsRecording && ((mRequest->rangeHdr).begin > total_file_size)) {
      *(mLog->log()) << DEBUGPREFIX
		     << " ERROR: Not yet available" << endl;     
      sendError(404, "Not Found", NULL, "003 File not found.");
      return OKAY;
    }
    cur_idx = file_sizes.size() -1;
    for (uint i = 1; i < file_sizes.size(); i++) {
      if ((mRequest->rangeHdr).begin < file_sizes[i].sFirstOffset  ) {
	cur_idx = i -1;
	break;
      }
    }

#ifndef DEBUG
    *(mLog->log())<< " Identified Record i= " << cur_idx << " file_sizes[i].sFirstOffset= " 
	 << file_sizes[cur_idx].sFirstOffset << " rangeHdr.begin= " << rangeHdr.begin 
	 << " vdr_no= " << file_sizes[cur_idx].sIdx << endl;
#endif

    mVdrIdx = file_sizes[cur_idx].sIdx;
    snprintf(pathbuf, sizeof(pathbuf), mFileStructure.c_str(), (mRequest->mPath).c_str(), file_sizes[cur_idx].sIdx);
#ifndef DEBUG
    *(mLog->log())<< " file identified= " << pathbuf << endl;
#endif
    if (openFile(pathbuf) != OKAY) {
      *(mLog->log())<< "----- fopen failed dump ----------" << endl;
      *(mLog->log())<< DEBUGPREFIX
		    << " vdr filesize list " 
		    << endl;
      for (uint i = 0; i < file_sizes.size(); i++)
	*(mLog->log())<< " i= " << i << " size= " << file_sizes[i].sSize << " firstOffset= " << file_sizes[i].sFirstOffset << endl;
      *(mLog->log())<< " total_file_size= " << total_file_size << endl << endl;
      
      *(mLog->log())<< " Identified Record i= " << cur_idx << " file_sizes[i].sFirstOffset= " 
		    << file_sizes[cur_idx].sFirstOffset << " rangeHdr.begin= " << (mRequest->rangeHdr).begin 
		    << " vdr_no= " << file_sizes[cur_idx].sIdx << endl;
      *(mLog->log())<< "---------------" << endl;
      sendError(403, "Forbidden", NULL, "001 Access denied.");
      return OKAY;
    }
    mRequest->mDir = mRequest->mPath;
    mRequest->mPath = pathbuf;
#ifndef DEBUG
    *(mLog->log())<< " Seeking into file= " << (rangeHdr.begin - file_sizes[cur_idx].sFirstOffset) 
	 << " cur_idx= " << cur_idx
	 << " file_sizes[cur_idx].sFirstOffset= " << file_sizes[cur_idx].sFirstOffset
	 << endl;
#endif
    fseek(mFile, ((mRequest->rangeHdr).begin - file_sizes[cur_idx].sFirstOffset), SEEK_SET);
    if ((mRequest->rangeHdr).end == 0)
      (mRequest->rangeHdr).end = ((mIsRecording) ? (mRecProgress * total_file_size): total_file_size);

    mRemLength = ((mRequest->rangeHdr).end-(mRequest->rangeHdr).begin);

    snprintf(f, sizeof(f), "Content-Range: bytes %lld-%lld/%lld", (mRequest->rangeHdr).begin, ((mRequest->rangeHdr).end -1), 
    	     ((mIsRecording) ? (long long int)(mRecProgress * total_file_size): total_file_size));
    
    sendHeaders(206, "Partial Content", f, "video/mpeg", ((mRequest->rangeHdr).end-(mRequest->rangeHdr).begin), statbuf->st_mtime);
  }

#ifndef DEBUG
  *(mLog->log())<< " ***** Yes, vdr dir found ***** mPath= " << mRequest->mPath << endl;
#endif

  return OKAY; // handleRead() done
}




//-----------------------------------------------------------------
// ----- Send Segment -----
//-----------------------------------------------------------------

int cResponseVdrDir::sendMediaSegment (struct stat *statbuf) {
  if (isHeadRequest())
    return OKAY;

#ifndef STANDALONE

  *(mLog->log()) << DEBUGPREFIX << " sendMediaSegment " << mRequest->mPath << endl;
  size_t pos = (mRequest->mPath).find_last_of ("/");

  mRequest->mDir = (mRequest->mPath).substr(0, pos);
  string seg_name = (mRequest->mPath).substr(pos+1);
  int seg_number; 

  int seg_dur = mRequest->mFactory->getConfig()->getSegmentDuration();
  int frames_per_seg = 0;

  sscanf(seg_name.c_str(), "%d-seg.ts", &seg_number);

  //FIXME: Do some consistency checks on the seg_number 
  //* Does the segment exist 

  cRecordings* recordings = &Recordings;
  cRecording* rec = recordings->GetByName((mRequest->mDir).c_str());  
  if (rec != NULL) {
    frames_per_seg = seg_dur * rec->FramesPerSecond();
  }
  else {
    *(mLog->log()) << DEBUGPREFIX << " ERROR: Ooops, rec is NULL, assuming 25 fps "  << endl;
    frames_per_seg = seg_dur * 25;
  }
  //FIXME: HD Fix
  //  frames_per_seg = seg_dur * 25;

  *(mLog->log()) << DEBUGPREFIX 
		 << " mDir= " << mRequest->mDir
		 << " seg_name= " << seg_name
		 << " seg_number= "<< seg_number
		 << " fps= " << rec->FramesPerSecond()
		 << " frames_per_seg= " << frames_per_seg
		 << endl;
  int start_frame_count = (seg_number -1) * frames_per_seg;

  FILE* idx_file = fopen((mRequest->mDir +"/index").c_str(), "r");
  if (idx_file == NULL){
    *(mLog->log()) << DEBUGPREFIX
		   << " failed to open idx file = "<< (mRequest->mDir +"/index").c_str()
		   << endl;
    sendError(404, "Not Found", NULL, "004 Failed to open Index file");
    return OKAY;
  }

  char *index_buf = new char[(frames_per_seg +3) *8];

  // fseek to start_frame_count * sizeof(in_read)
  fseek(idx_file, start_frame_count * 8, SEEK_SET);

  // read to (seg_number  * frames_per_seg  +1) *  sizeof(in_read)
  // buffersize is frames_per_seg * seg_number * sizeof(in_read)
  int buffered_indexes = fread(index_buf, 8, (frames_per_seg +2), idx_file);

  fclose(idx_file);

  if(buffered_indexes <= 0 ) {
    *(mLog->log())<<DEBUGPREFIX
		  << " issue while reading" << endl;
    delete[] index_buf;
    sendError(404, "Not Found", NULL, "005 Failed to read Index file");
    return OKAY;
  }

  // Reading the segment
  mFileStructure = "%s/%05d.ts";
  int start_offset = -1;
  int start_idx = -1;

  tIndexTs in_read_ts;
  memcpy (&in_read_ts, &(index_buf[0]), 8);
  
  start_offset = in_read_ts.offset;
  start_idx = in_read_ts.number;

  char  seg_fn[200];
  mVdrIdx = start_idx;

  snprintf(seg_fn, sizeof(seg_fn), mFileStructure.c_str(), (mRequest->mDir).c_str(), mVdrIdx);
  (mRequest->mPath) = seg_fn;

  /*
   * Now we determine the end of the segment
   */
  memcpy (&in_read_ts, &(index_buf[(frames_per_seg)*8]), 8);

  int end_idx = in_read_ts.number;
  int end_offset = in_read_ts.offset;

  /*#ifndef DEBUG*/
  *(mLog->log()) << DEBUGPREFIX
		 << " GenSegment: start (no/idx)= " << start_idx << " / " << start_offset
		 << " to (no/idx)= " << end_idx << " / " << end_offset
		 << endl;
  /*#endif*/

  delete[] index_buf;

  int rem_len = 0;
  bool error = false;
  if (start_idx == end_idx){
    mRemLength = (end_offset - start_offset);

#ifndef DEBUG
    *(mLog->log()) << DEBUGPREFIX
		   << " start_idx == end_idx: mRemLength= " <<mRemLength
		   << endl;
#endif
  }
  else {
#ifndef DEBUG
    *(mLog->log()) << DEBUGPREFIX
		   << " start_idx < end_idx " 
		   << endl;
#endif
    snprintf(seg_fn, sizeof(seg_fn), mFileStructure.c_str(), (mRequest->mDir).c_str(), mVdrIdx);
    if (stat(seg_fn, statbuf) < 0) {
      *(mLog->log()) << DEBUGPREFIX
		     << " file=  " <<seg_fn << " does not exist" 
		     << endl;
      error= true;
      // issue: 
    }
    rem_len = statbuf->st_size - start_offset; // remaining length of the first segment

    // loop over all idx files between start_idx and end_idx
    for (int idx = (start_idx+1); idx < end_idx; idx ++) {
      snprintf(seg_fn, sizeof(seg_fn), mFileStructure.c_str(), (mRequest->mDir).c_str(), idx);
      if (stat(seg_fn, statbuf) < 0) {
	*(mLog->log()) << DEBUGPREFIX
		       << " for loop file=  " <<seg_fn << " does not exist" 
		       << endl;
	error = true;
	break;
	// issue: 
      }
      rem_len += statbuf->st_size; // remaining length of the first segment
    }
    rem_len += end_offset; // 
    mRemLength = rem_len;
    snprintf(seg_fn, sizeof(seg_fn), mFileStructure.c_str(), (mRequest->mDir).c_str(), mVdrIdx);

#ifndef DEBUG
    *(mLog->log()) << DEBUGPREFIX
		   << " start_idx= " << start_idx << " != end_idx= "<< end_idx <<": mRemLength= " <<mRemLength
		   << endl;    
#endif
  }

  if (error){
    sendError(404, "Not Found", NULL, "006 Not all inputs exists");
    return OKAY;
  }
  
  //  mContentType = VDRDIR;
 
  if (openFile(seg_fn) != OKAY) {
    *(mLog->log())<< DEBUGPREFIX << " Failed to open file= " << seg_fn 
		  << " mRemLength= " << mRemLength<< endl;
    sendError(404, "Not Found", NULL, "003 File not found.");
    return OKAY;
  }
  fseek(mFile, start_offset, SEEK_SET);

  sendHeaders(200, "OK", NULL, "video/mpeg", mRemLength, -1);

#endif
  return OKAY;
}

int cResponseVdrDir::openFile(const char *name) {
  mFile = fopen(name, "r");
  if (!mFile) {
    *(mLog->log())<< DEBUGPREFIX
	 << " fopen failed pathbuf= " << name 
	 << endl;
    //    sendError(403, "Forbidden", NULL, "Access denied.");
    return ERROR;
  }
  return OKAY;
}


int cResponseVdrDir::fillDataBlk() {
  char pathbuf[4096];

  if (mError)
    return ERROR;

  mBlkPos = 0;
  int to_read = 0;


  // Range requests are assumed to be all open
  if (mFile == NULL) {
    *(mLog->log()) << DEBUGPREFIX << " no open file anymore "
		   << "--> Done " << endl;
    return ERROR;
  }
  if ((mRemLength == 0) && !mStreamToEnd){
#ifndef DEBUG
    *(mLog->log()) << DEBUGPREFIX << " mRemLength is zero "
		   << "--> Done " << endl;
#endif
    fclose(mFile);
    mFile = NULL;      
    return ERROR;
  }
  if (!mStreamToEnd)
    to_read = ((mRemLength > MAXLEN) ? MAXLEN : mRemLength);
  else
    to_read = MAXLEN;
  
  mBlkLen = fread(mBlkData, 1, to_read, mFile);
  if (!mStreamToEnd)
    mRemLength -= mBlkLen;
  
  if ((mRemLength == 0) && (!mStreamToEnd)) {
#ifndef DEBUG
    *(mLog->log()) << DEBUGPREFIX << " last Block read "
		   << "--> Almost Done " << endl;
#endif
    return OKAY;
  }

  //    if (mBlkLen != MAXLEN) { // thlo verify
  if (mBlkLen != to_read) {
    fclose(mFile);
    mFile = NULL;
    mVdrIdx ++;
    
    snprintf(pathbuf, sizeof(pathbuf), mFileStructure.c_str(), (mRequest->mDir).c_str(), mVdrIdx);
    mRequest->mPath = pathbuf;

    if (openFile(pathbuf) != OKAY) {
      *(mLog->log())<< DEBUGPREFIX << " Failed to open file= " << pathbuf << " mRemLength= " << mRemLength<< endl;
      mFile = NULL;
      if  (mBlkLen == 0) {
	*(mLog->log()) << DEBUGPREFIX << " mBlkLen is zero --> Done "  << endl;
	return ERROR;
      }
      else
	*(mLog->log()) << DEBUGPREFIX << " Still data to send mBlkLen= " << mBlkLen <<" --> continue "  << endl;
      return OKAY;
    } // Error: Open next file failed 
    
    if (mBlkLen == 0) {
      if (!mStreamToEnd)
	to_read = ((mRemLength > MAXLEN) ? MAXLEN : mRemLength);
      else
	to_read = MAXLEN;
      mBlkLen = fread(mBlkData, 1, to_read, mFile);
      if (!mStreamToEnd)
	mRemLength -= mBlkLen ;  
    }
  }
  return OKAY;
}
