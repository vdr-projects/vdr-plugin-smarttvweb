/*
 * mp4.c: VDR on Smart TV plugin
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


#include "mp4.h"
#include <stdio.h>
#include <stdlib.h>
#include <iostream> 
#include <cstring> 

#define DEBUGPREFIX mLog->getTimeString() << " MP4:"

//#define DEBUG


uint32_t parseUInt32(uint8_t *p) {
  return
    (((uint32_t) p[0]) << 24) |
    (((uint32_t) p[1]) << 16) |
    (((uint32_t) p[2]) << 8) |
    ((uint32_t) p[3]) ;
}

uint64_t parseUInt64 ( uint8_t *p) {
 return  (((uint64_t)p[0]) << 56) |
   (((uint64_t)p[1]) << 48) |
   (((uint64_t)p[2]) << 40) |
   (((uint64_t)p[3]) << 32) |
   (((uint64_t)p[4]) << 24) |
   (((uint64_t)p[5]) << 16) |
   (((uint64_t)p[6]) << 8) |
   ((uint64_t)p[7]);
}

class cDataHdr {
 public:
  uint32_t mType;
  uint32_t mLocale;

  bool readDataHdr(FILE*);
};

bool cDataHdr::readDataHdr(FILE* ifd) {
  uint8_t p[16];
  size_t res;

  res = fread (p, 1, 4, ifd);
  if (res < 4) 
    return false;

  mType = parseUInt32(p);

  res = fread (p, 1, 4, ifd);
  if (res < 4) 
    return false;

  mLocale = parseUInt32(p);
  return true;
}

class cBoxHdr {
 public:
  uint64_t mSize;
  string mName;

  uint8_t mVersion;
  uint32_t mFlags;
  int mHdrLen;

  cBoxHdr();
  void reset();
  bool readHdr(FILE*);
  bool readFullHdr(FILE*);
};

cBoxHdr::cBoxHdr() : mSize(0), mName(""), mHdrLen(0) {
  reset();
};

void cBoxHdr::reset() {
  mSize = 0;
  mName = "";
  mHdrLen = 0;
}

bool cBoxHdr::readFullHdr (FILE* ifd) {
  uint8_t p[4];
  //size_t res;

  fread (p, 1, 4, ifd);
  mVersion = p[0];
  mFlags = (((uint32_t) p[1]) << 16) |
    (((uint32_t) p[2]) << 8) |
    ((uint32_t) p[3]) ;

  return true;
}

bool cBoxHdr::readHdr(FILE* ifd) {
  uint8_t p[16];
  size_t res;

  res = fread (p, 1, 8, ifd);
  if (res < 8) 
    return false;

  mSize = parseUInt32(p);

  char f[10];
  snprintf(f, sizeof(f), "%c%c%c%c", p[4], p[5], p[6], p[7]);
  mName = f;
  mHdrLen = 8;

  if (mSize == 1) {
    mHdrLen +=8;
    res = fread (p, 1, 8, ifd);
    if (res < 8) 
      return false;

    mSize = 0;	
    mSize= parseUInt64(p);
  }
  return true;
}


cMp4Metadata::cMp4Metadata(string fn, uint64_t size) : mIsValidFile(false), mHaveTitle(false), 
  mHaveShortDesc(false), mHaveLongDesc(false), mHaveCovrPos(false),
  mFilename(fn),
  mFilesize(size), mDuration(0.0), mTitle(""), mTVNetwork ("NA"), 
  mShortDesc ("NA"), mLongDesc("NA"), mCovrPos(0), mCovrSize(0), mCovrType(0), mCovr(NULL) {

  mLog = Log::getInstance();

  *(mLog->log())<< DEBUGPREFIX << " mp4 fn= " << fn << " size= " << size << endl;

}

cMp4Metadata::~cMp4Metadata() {
  if (mCovr != NULL)
    delete[] mCovr; 
}
void cMp4Metadata::parseMetadata() {
  FILE * ifd;
  ifd = fopen (mFilename.c_str(), "r");

  if (ifd == NULL)
    return ; 
  
  cBoxHdr m_box;

  if (!m_box.readHdr(ifd)) {
    *(mLog->log())<< DEBUGPREFIX << " " << mFilename << " first read header failed" << endl;
    fclose (ifd);
    return ;
  }

  if (m_box.mName != "ftyp") {
    *(mLog->log())<< DEBUGPREFIX << " " << mFilename << " is not an MP4 file" << endl;
    fclose (ifd);
    return;
  }

  if (fseek(ifd, (m_box.mSize - m_box.mHdrLen), SEEK_CUR) != 0) {
    *(mLog->log())<< DEBUGPREFIX << " mp4 seek-error " << endl;
  }

  if (findMetadata(ifd, root)) {
    mIsValidFile = true;
    *(mLog->log())<< DEBUGPREFIX << " IsValidFile " << endl;
  }
  fclose (ifd);
}

bool cMp4Metadata::parseMovieHeader (FILE* ifd, uint64_t s) {
  cBoxHdr m_box;
  int read_size =4;
  m_box.readFullHdr(ifd); // 4Byte

  mDuration=0.0;
  uint8_t p[28];
  size_t res;

  if (m_box.mFlags == 1) {
    uint32_t ts;
    uint64_t dur;
    uint64_t ct;

    read_size += 28;
    res = fread (p, 1, 28, ifd);
    if (res < 28) 
      return false;

    ct = parseUInt64(p);
    if (ct != 0) {
      mCreationTime = ct - 2082844800;
    }
    ts = parseUInt32 (&(p[16]));
    dur = parseUInt64 (&(p[20]));

    mDuration = dur *1.0/ ts;
    *(mLog->log())<< DEBUGPREFIX << " parseMovieHeader 64bit ts= " << ts 
		  << " dur= " << dur << " mDuration= " << mDuration<< endl;
  }
  else {
    uint32_t ts;
    uint32_t dur;
    uint32_t ct;

    read_size += 16;
    res = fread (p, 1, 16, ifd);
    if (res < 16) 
      return false;

    ct = parseUInt32(p) ;
    if (ct != 0) {
      mCreationTime = ct- 2082844800;
    }
    ts= parseUInt32(&(p[8]));
    dur= parseUInt32(&(p[12]));

    mDuration = dur *1.0/ ts;
#ifdef DEBUG
    *(mLog->log())<< DEBUGPREFIX << " parseMovieHeader 32bit ts= " << ts 
		  << " dur= " << dur << " mDuration= " << mDuration<< endl;
#endif
  }

  
  if (fseek(ifd, (s - read_size), SEEK_CUR) != 0)
    *(mLog->log()) << DEBUGPREFIX << " mp4 mvhd seek-error " << endl;

  return true;
}


string cMp4Metadata::parseString(FILE* ifd, uint64_t s) {

  uint64_t rem= s;
  char buf[1024];
  string val = "";

  while (rem != 0) {
    int tgt = (rem > sizeof(buf)) ? sizeof(buf): rem;
    rem -= tgt;
    int res = fread (buf, 1, tgt, ifd);
    if (res < tgt) 
      return val;
    val += string(buf, tgt); 
  }
  
  return val;
}


bool cMp4Metadata::findMetadata(FILE* ifd, eBoxes parent) {
  cBoxHdr m_box;
  long int pos = ftell (ifd);
  int box_count = 0;
  int res;
  
  //  *(mLog->log())<< DEBUGPREFIX << " mp4 findMetadata "  << " pos= " << pos << endl;

  if (pos < 0) {
      *(mLog->log())<< DEBUGPREFIX << " end reached" << endl;
    return false;
  }
  if (pos >= (ssize_t)mFilesize) {
      *(mLog->log())<< DEBUGPREFIX << " end reached. pos larger filesize - done" << endl;
      return true;
  }
  while(true) {
    if (box_count >= 40) {
      *(mLog->log())<< DEBUGPREFIX << " box_count is 40 - done" << endl;      
      return true;
    }
    box_count++;

    if ((m_box.mHdrLen !=0) && (m_box.mSize == 0)) {
      *(mLog->log())<< DEBUGPREFIX << " last box was of length zero (until eof)" << endl;
      return true;
    }
    pos = ftell (ifd);

    if (!m_box.readHdr(ifd)) {
      // done reading.
      //      *(mLog->log())<< DEBUGPREFIX << " readHdr returns false - done" << endl;      
      return true;
    }
    
    
#ifdef DEBUG
    *(mLog->log())<< DEBUGPREFIX << " pos= " << pos << " Name= " << m_box.mName 
    		  << " size= " << m_box.mSize << " HdrLen= " << m_box.mHdrLen
		  << endl;
#endif
    
    if (m_box.mName == "moov") {
#ifdef DEBUG
      *(mLog->log())<< DEBUGPREFIX << " moov found" << endl;
#endif
      return findMetadata(ifd, moov);
    }

    if (m_box.mName == "mvhd") {
#ifdef DEBUG
       *(mLog->log())<< DEBUGPREFIX << " mvhd found" << endl; 
#endif
      parseMovieHeader (ifd, (m_box.mSize - m_box.mHdrLen));
    }

    else if (m_box.mName == "udta") {
#ifdef DEBUG
      *(mLog->log())<< DEBUGPREFIX << " udta found" << endl;
#endif
      return findMetadata(ifd, udta);
    }
    else if (m_box.mName == "meta") {
#ifdef DEBUG
      *(mLog->log())<< DEBUGPREFIX << " meta found" << endl;
#endif
      m_box.readFullHdr(ifd);
      return findMetadata(ifd, meta);
    }
    else if (m_box.mName == "ilst") {
#ifdef DEBUG
      *(mLog->log())<< DEBUGPREFIX << " ilst found" << endl;
#endif
      return findMetadata(ifd, ilst);
    }
    else if (m_box.mName == "covr") {
      return findMetadata(ifd, covr);
    }
    else if (m_box.mName == "tvnn") {
      return findMetadata(ifd, tvnn);
    }
    else if (m_box.mName == "desc") {
      return findMetadata(ifd, desc);
    }
    else if (m_box.mName == "ldes") {
      return findMetadata(ifd, ldes);
    }
    else if (((uint8_t)m_box.mName[0] == 0xa9) && (m_box.mName.compare(1, 3, "nam") == 0)) {
      return findMetadata(ifd, cnam);
    }

    else if (m_box.mName == "data") {
      cDataHdr d_hdr;
      d_hdr.readDataHdr(ifd);
      
      switch (parent) {
      case cnam:
	mTitle = parseString(ifd, (m_box.mSize - m_box.mHdrLen)-8);
	mHaveTitle= true;
#ifdef DEBUG
	*(mLog->log())<< DEBUGPREFIX << " title= " << mTitle << endl;
#endif
	break;
      case tvnn:
	mTVNetwork = parseString(ifd, (m_box.mSize - m_box.mHdrLen)-8);
#ifdef DEBUG
	*(mLog->log())<< DEBUGPREFIX << " tvnn= " << mTVNetwork << endl;
#endif
	break;
      case desc:
	mShortDesc = parseString(ifd, (m_box.mSize - m_box.mHdrLen)-8);
	mHaveShortDesc= true;
#ifdef DEBUG
	*(mLog->log())<< DEBUGPREFIX << " desc= " << mShortDesc << endl;
#endif
	break;
      case ldes:
	mLongDesc = parseString(ifd, (m_box.mSize - m_box.mHdrLen)-8);
	mHaveLongDesc= true;
#ifdef DEBUG
	*(mLog->log())<< DEBUGPREFIX << " ldes " << endl;
#endif
	break;
      case covr:
#ifdef DEBUG
      *(mLog->log())<< DEBUGPREFIX << " covr found" << endl;
#endif
	mCovrType = d_hdr.mType;
	if ((mCovrType != 14) && (mCovrType != 13)) {
	  *(mLog->log())<< DEBUGPREFIX << " COVR (type= " << mCovrType << ") is neither PNG nor JPG - Ignore " 
			<< endl;
	  if (fseek(ifd, (m_box.mSize - m_box.mHdrLen)-8, SEEK_CUR) != 0)
	    *(mLog->log())<< DEBUGPREFIX << " mp4 seek-error " << endl;
	  break;
	}
	mCovrPos =  ftell (ifd);
	mCovrSize = m_box.mSize - m_box.mHdrLen -8;
	mHaveCovrPos= true;
	*(mLog->log())<< DEBUGPREFIX << " covr found pos= " << mCovrPos
		      << " size= " << mCovrSize << endl;
	mCovr = new char[mCovrSize];
	res = fread (mCovr, 1, m_box.mSize - m_box.mHdrLen -8, ifd);
	if (res < (ssize_t)(m_box.mSize - m_box.mHdrLen -8)) {
	  *(mLog->log())<< DEBUGPREFIX << " covr read ERROR. res= " << res << endl;
	}
	break;
      default:
	*(mLog->log())<< DEBUGPREFIX << " unhandled data field " << endl;
	if (fseek(ifd, (m_box.mSize - m_box.mHdrLen)-8, SEEK_CUR) != 0)
	      *(mLog->log())<< DEBUGPREFIX << " mp4 seek-error " << endl;
	break;
      }
    }

    else {
      if (fseek(ifd, (m_box.mSize - m_box.mHdrLen), SEEK_CUR) != 0)
	*(mLog->log())<< DEBUGPREFIX << " mp4 seek-error " << endl;
      
	
    }
  }
}
