/*
 * responselive.c: VDR on Smart TV plugin
 *
 * Copyright (C) 2013 T. Lohmar
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
/*
 *
 * TODO: Stop, when the channel is unavailable
 *
*/
#include "responselive.h"
#include "httpresource.h"
#include "smarttvfactory.h"
#include "log.h"

#include <vdr/remux.h>

#include <vector>
#include <sys/stat.h>

#define DEBUGPREFIX "mReqId= " << mRequest->mReqId << " fd= " << mRequest->mFd 
#define OKAY 0
#define ERROR (-1)
#define DEBUG


cLiveRelay::cLiveRelay(cChannel* channel, cDevice* device, string chan_id, int req_id, cHttpResource* req) : cReceiver(channel, 0), 
  mChannelId(chan_id), mRingBuffer(), mReqId(req_id), mRequest(req), mNotifFd(0), mNotifRequired(true)
{

  mLog = Log::getInstance();

  pthread_mutex_init(&processedRingLock, NULL);

  mNotifFd = mRequest->mFactory->openPipe();
  if (mNotifFd == 0) {
    *(mLog->log()) << "mReqId= " << mReqId
		   << " cLiveRelay::cLiveRelay - Constructor ERROR, mNotifId is ZERO" << endl;
  }

  SetPids(channel);

  //  AddPid(channel->Tpid()); 
  //  AddPid(channel->Vpid()); 
  //  AddPid(channel->Apid(0)); 

  device->SwitchChannel(channel, false);
  device->AttachReceiver(this);

  //  mRingBuffer = new cRingBufferLinear(60000*188, MIN_TS_PACKETS_FOR_FRAME_DETECTOR * TS_SIZE, true, "responselive");
  mRingBuffer = new cRingBufferLinear(60000*188);
  mRingBuffer->SetTimeouts(0, 100);

#ifndef DEBUG
  *(mLog->log()) << "mReqId= " << mReqId << " cLiveRelay::cLiveRelay created for chan_id= " << chan_id << endl;
#endif
};

cLiveRelay::~cLiveRelay() {
  close(mNotifFd);
  cReceiver::Detach();
  delete mRingBuffer;
};

void cLiveRelay::Activate(bool On) {
  // this method is called by vdr
  if (On) {
    //    Start();
    *(Log::getInstance()->log()) << "mReqId= " << mReqId 
				 << " cLiveRelay::Activate called by VDR for chan_id= " << mChannelId <<endl;
  }
  else {
    //    Cancel();
    *(Log::getInstance()->log()) << "mReqId= " << mReqId 
				 << " cLiveRelay::Deactivate for chan_id= " << mChannelId <<endl;
  }
}

void cLiveRelay::detachLiveRelay() {
  Detach();
}

void cLiveRelay::Receive(uchar* data, int length) {
  
  if (length != 188) {
    *(Log::getInstance()->log()) << "ERROR: ******* ts packet unequal 188 Byte Length= " << length << endl;
  }
  if (data[0] != 0x47) {
    *(Log::getInstance()->log()) << "ERROR: ******* Out of Sync " << endl;
  }

  pthread_mutex_lock(&processedRingLock);
  int p = mRingBuffer->Put(data, length);
  pthread_mutex_unlock(&processedRingLock);
  if (p != length ) {
    *(Log::getInstance()->log()) << "cLiveRelay::Receive: Overflow" << endl;
    mRingBuffer->ReportOverflow(length - p); 
  }

  if (mNotifRequired ) {
    //    *(Log::getInstance()->log()) << "cLiveRelay::Receive: Sending Notification" << endl;
    mRequest->mFactory->setWriteFlag(mRequest->mFd);
    mNotifRequired = false;
    ssize_t res = write (mNotifFd, " ", 1);
    if (res <= 0)
      *(Log::getInstance()->log()) << "cLiveRelay::Receive: Notification NOT sent" << endl;
  }
  
}


//----------------------------------------------
//----------------------------------------------
//----------------------------------------------

cResponseLive::cResponseLive(cHttpResource* req, string chan_id) : cResponseBase(req), mChannelId(chan_id), 
  mPatPmtGen(NULL), mInStartPhase(true), mFrameDetector(NULL), mVpid(0), mVtype(0), mPpid(0), mStartThreshold(75*188) {

  mStartThreshold= mRequest->mFactory->getConfig()->getBuiltInLivePktBuf4Sd() * 188;
  *(mLog->log()) << DEBUGPREFIX << " cResponseLive::cResponseLive - Constructor" << endl;

  if (InitRelay(chan_id)) {
    mRelay->setNotifRequired();
    mRequest->mFactory->clrWriteFlag(mRequest->mFd);
  }

  if (mRelay != NULL) {
    sendHeaders(200, "OK", NULL, "video/mpeg", -1, -1);
  }
  else {
    sendError(404, "Not Found.", NULL, "004 Resource Busy");
  }
}

cResponseLive::~cResponseLive() {
  if (mRelay != NULL)
    delete mRelay;
  if (mPatPmtGen != NULL)
    delete mPatPmtGen;

  if (mFrameDetector != NULL) 
    delete mFrameDetector;
}

bool cResponseLive::InitRelay(string channel_id) {

  cChannel * channel = Channels.GetByChannelID(tChannelID::FromString(channel_id.c_str()));

  int priority = 99;
  if (!channel ){
    *(mLog->log()) << DEBUGPREFIX 
		   << " " << channel_id << " No channel found: " << endl;
    return false;
  }

  char buf [40];
  snprintf(buf, 40, "%s", *(channel->GetChannelID()).ToString());

  if (channel->Vpid() != 0) {
    mVpid = channel->Vpid();
    mVtype = channel->Vtype();
    mPpid = channel->Ppid();

    if (mVtype == 27) {
      //      mStartThreshold = 150 * 188;
      mStartThreshold= mRequest->mFactory->getConfig()->getBuiltInLivePktBuf4Hd() * 188;
      
      *(mLog->log()) << DEBUGPREFIX << " cResponseLive::InitRelay H.264 detected. mStartThreshold is " << mStartThreshold << endl;
    }

    mFrameDetector = new cFrameDetector(channel->Vpid(), channel->Vtype());
    mInStartPhase = true;
  }
  else {
    mInStartPhase = false;
  }

  *(mLog->log()) << DEBUGPREFIX << " cResponseLive::InitRelay channel " << buf << " found" << endl;
#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX << " vpid= " << channel->Vpid() << " vtype= " << channel->Vtype() << endl;

  for (int n = 0; channel->Apid(n); n++) {
    *(mLog->log()) << DEBUGPREFIX << " apid= " << channel->Apid(n) << " atype= " << channel->Atype(n) 
		   << " lang= " << channel->Alang(n) << endl;
  }
  for (int n = 0; channel->Dpid(n); n++) {
    *(mLog->log()) << DEBUGPREFIX << " dpid= " << channel->Dpid(n) << " dtype= " << channel->Dtype(n) << endl;    
  }
  for (int n = 0; channel->Spid(n); n++) {
    *(mLog->log()) << DEBUGPREFIX << " spid= " << channel->Spid(n) << " stype= " << channel->SubtitlingType(n) 
		   << " lang= " << channel->Slang(n)  << endl;    
  }
#endif

  cDevice* device = cDevice::GetDevice(channel, priority, true); // last param is live-view

  if (!device) {
    *(mLog->log()) << DEBUGPREFIX << " cLiveRelay::create: No device found to receive this channel at this priority. chan_id= " 
		   << channel_id << endl;

    return false;
  }

  mRelay = new cLiveRelay(channel, device, channel_id, mRequest->mReqId, mRequest);
  
  mPatPmtGen = new cPatPmtGenerator(channel);

  return true;
}

void cResponseLive::WritePatPmt() {
  mBlkPos = 0;
  mBlkLen = 0;
  
  uchar* ptr = mPatPmtGen->GetPat();
  memcpy(mBlkData, ptr, 188);
  mBlkLen = 188;

  int idx = 0;
  while ((ptr = mPatPmtGen->GetPmt(idx)) != NULL) {
    memcpy(mBlkData+mBlkLen, ptr, 188);
    mBlkLen += 188;
  };
}

int cResponseLive::fillDataBlk() {
  switch (mRequest->mFactory->getConfig()->getBuiltInLiveStartMode()){
  case 0:
    return fillDataBlk_straight();
    break;
  case 1:
    return fillDataBlk_pcr();
    break;
  case 2:
    return fillDataBlk_iframe();
    break;
  };
}

int cResponseLive::fillDataBlk_pcr() {
  mBlkPos = 0;
  mBlkLen = 0;
  
  if (mError)
    return ERROR;

  int threshold = (mInStartPhase) ? mStartThreshold : (1*188);

  if (mRelay->mRingBuffer->Available() >= threshold) {
    
    pthread_mutex_lock(&(mRelay->processedRingLock));
    int r;
    char *b = (char*)mRelay->mRingBuffer->Get(r);
    
    if (b != NULL) {
      //      mInStartPhase = false;

      if ((r % 188) != 0) {
	*(mLog->log()) << DEBUGPREFIX << " ERROR: r= " << r << " %188 = " << (r%188) << endl;	
      }

      if (mInStartPhase) {
	int offset = 0;
	bool already_deleted = false;
	while ((offset +188) <= r) {
	  
	  if (TsPid((const uchar*) (b+offset)) == mPpid){    
	    int64_t pcr = TsGetPcr((const uchar*) (b+offset));
	    if (pcr != -1) {
	      // pcr pkt found
	      if ((r  - (offset+188)) < threshold) {
		already_deleted = true;
		mRelay->mRingBuffer->Del(offset + 188);
		break;
	      }
	      *(mLog->log()) << DEBUGPREFIX
			     << " cResponseLive::fillDataBlk() - PCR found, starting now pcr= " 
			     << pcr << endl;

	      // fill the memblock
	      mInStartPhase = false;
	      WritePatPmt();
	      int len = ((r - offset ) > (MAXLEN - mBlkLen)) ? (MAXLEN - mBlkLen): (r - offset );
	      
	      if ((r - offset ) > (MAXLEN - mBlkLen)) {
		*(mLog->log()) << DEBUGPREFIX 
			       << " cResponseLive::fillDataBlk() mInStartPhase = true - ((r - offset ) > (MAXLEN - mBlkLen))" 
			       << endl; 
	      }
	      memcpy(mBlkData + mBlkLen, b+offset, len);
	      
	      mBlkLen += len;
	      already_deleted = true;
	      mRelay->mRingBuffer->Del(len + offset);
	      break;
	    } // if (pcr != 0) 
	  } // if (TsPid((
	  
	  // end of find pcr

	  offset += 188;
	} // while (offset < r) {
	
	if (!already_deleted) {
	  *(mLog->log()) << DEBUGPREFIX << " cResponseLive::fillDataBlk() - Not sufficient data. Deleting " 
			 << offset +188 << " Byte corresponding to " << (offset / 188) +1 << " pkts" << endl;	
	  mRelay->mRingBuffer->Del(offset + 188);
	}
      } // if (mInStartPhase)

      else {
	
	WritePatPmt();
	int len = (r > (MAXLEN - mBlkLen)) ? (MAXLEN - mBlkLen): r;
	
	if (r > (MAXLEN - mBlkLen)) {
	  *(mLog->log()) << DEBUGPREFIX 
			 << " cResponseLive::fillDataBlk() mInStartPhase = false - ((r - offset ) > (MAXLEN - mBlkLen)) len= " << len 
			 << " MAXLEN= " << MAXLEN
			 << " mBlkLen= " << mBlkLen
			 << endl; 
	}
	memcpy(mBlkData + mBlkLen, b, len);
	
	mBlkLen += len;
	mRelay->mRingBuffer->Del(len);
      } // else
    } // if (b != NULL)
    else {
      *(mLog->log()) << DEBUGPREFIX << " WARNING - cResponseLive::fillDataBlk() - b== NULL" << endl;
    }
    pthread_mutex_unlock(&(mRelay->processedRingLock));
  }
  else { 
    mRequest->mFactory->clrWriteFlag(mRequest->mFd);
    mRelay->setNotifRequired();
  }

  return OKAY;
}

int cResponseLive::fillDataBlk_iframe() {
  mBlkPos = 0;
  mBlkLen = 0;

  if (mError)
    return ERROR;

  int threshold = (mInStartPhase) ? mStartThreshold : (10*188);

  if (mRelay->mRingBuffer->Available() >= threshold) {
    
    pthread_mutex_lock(&(mRelay->processedRingLock));
    int r;
    char *b = (char*)mRelay->mRingBuffer->Get(r);
    
    if (b != NULL) {
      //      mInStartPhase = false;

      if ((r % 188) != 0) {
	*(mLog->log()) << DEBUGPREFIX << " ERROR: r= " << r << " %188 = " << (r%188) << endl;	
      }

      if (mInStartPhase) {
	int offset = 0;
	bool already_deleted = false;
	cFrameDetector frame_detector(mVpid, mVtype);

	while ((offset +188) <= r) {
	  
	  if (TsPid((const uchar*) (b+offset)) == mVpid){    
	    // check payload unit start ind
	    if (!TsPayloadStart((const uchar*) (b+offset))) {
	      offset += 188;
	      continue;
	    }

	    //ok. point to frame start now. check whether i frame
	    if (frame_detector.Analyze((const uchar*) (b+offset), (r - offset) ) == 0) {
	      // not sufficient data. delete and return
	      already_deleted = true;
	      mRelay->mRingBuffer->Del(offset + 188);
	      break;
	    }
	    if (frame_detector.IndependentFrame()) {
	      // was an I-Frame
	      if ((r - (offset +188)) < threshold) {
		*(mLog->log()) << DEBUGPREFIX 
			       << " IFrame found, but not sufficient data to start. " << endl;
		already_deleted = true;
		mRelay->mRingBuffer->Del(offset);
		break;
	      }

	      *(mLog->log()) << DEBUGPREFIX 
			     << " IFrame found, starting now " << endl;
	      mInStartPhase = false;
	      WritePatPmt();
	      int len = ((r - offset ) > (MAXLEN - mBlkLen)) ? (MAXLEN - mBlkLen): (r - offset );
	      if ((r - offset ) > (MAXLEN - mBlkLen)) {
		*(mLog->log()) << DEBUGPREFIX 
			       << " cResponseLive::fillDataBlk_iframe() mInStartPhase = true - ((r - offset ) > (MAXLEN - mBlkLen))" 
			       << endl; 
	      }
	      memcpy(mBlkData + mBlkLen, b+offset, len);
	      
	      mBlkLen += len;
	      already_deleted = true;
	      mRelay->mRingBuffer->Del(len + offset);
	      break;
	    }
	    
	  } // if (TsPid((
	  
	  offset += 188;
	} // while (offset < r) {
	
	if (!already_deleted) {
	  *(mLog->log()) << DEBUGPREFIX << " cResponseLive::fillDataBlk() - Not sufficient data. Deleting " 
			 << offset << " Byte" << endl;	
	  mRelay->mRingBuffer->Del(offset + 188);
	}
      } // if (mInStartPhase)

      else {
	
	WritePatPmt();
	int len = (r > (MAXLEN - mBlkLen)) ? (MAXLEN - mBlkLen): r;
	
	if (r > (MAXLEN - mBlkLen)) {
	  *(mLog->log()) << DEBUGPREFIX 
			 << " cResponseLive::fillDataBlk() mInStartPhase = false - ((r - offset ) > (MAXLEN - mBlkLen)) len= " << len 
			 << " MAXLEN= " << MAXLEN
			 << " mBlkLen= " << mBlkLen
			 << endl; 
	}
	memcpy(mBlkData + mBlkLen, b, len);
	
	mBlkLen += len;
	mRelay->mRingBuffer->Del(len);
      } // else
    } // if (b != NULL)
    else {
      *(mLog->log()) << DEBUGPREFIX << " WARNING - cResponseLive::fillDataBlk() - b== NULL" << endl;
    }
    pthread_mutex_unlock(&(mRelay->processedRingLock));
  }
  else { 
    mRequest->mFactory->clrWriteFlag(mRequest->mFd);
    mRelay->setNotifRequired();
  }

  return OKAY;
}


int cResponseLive::fillDataBlk_straight() {
  mBlkPos = 0;
  mBlkLen = 0;
  
  if (mError)
    return ERROR;
  
  int threshold = (mInStartPhase) ? mStartThreshold : (10*188);
  
  if (mRelay->mRingBuffer->Available() >= threshold) {
    
    pthread_mutex_lock(&(mRelay->processedRingLock));
    int r;
    char *b = (char*)mRelay->mRingBuffer->Get(r);
    
    if (b != NULL) {
      mInStartPhase = false;

      if ((r % 188) != 0) {
	*(mLog->log()) << DEBUGPREFIX 
		       << " ERROR: r= " << r << " %188 = " << (r%188) << endl;
	
      }

      WritePatPmt();
      int len = (r > (MAXLEN - mBlkLen)) ? (MAXLEN - mBlkLen): r;
      
      if (r > (MAXLEN - mBlkLen)) {
	*(mLog->log()) << DEBUGPREFIX 
		       << " cResponseLive::fillDataBlk() mInStartPhase = false - ((r - offset ) > (MAXLEN - mBlkLen)) len= " << len 
		       << " MAXLEN= " << MAXLEN
		       << " mBlkLen= " << mBlkLen
		       << endl; 
      }
      memcpy(mBlkData + mBlkLen, b, len);
      
      mBlkLen += len;
      mRelay->mRingBuffer->Del(len);
      

    } // if (b != NULL)
    else {
      *(mLog->log()) << DEBUGPREFIX << " WARNING - cResponseLive::fillDataBlk() - b== NULL" << endl;
    }
    pthread_mutex_unlock(&(mRelay->processedRingLock));
  }
  else { 
    mRequest->mFactory->clrWriteFlag(mRequest->mFd);
    mRelay->setNotifRequired();
  }

  return OKAY;
}
