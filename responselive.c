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

#define DEBUGPREFIX mLog->getTimeString() << "mReqId= " << mRequest->mReqId << " fd= " << mRequest->mFd 
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
    *(Log::getInstance()->log()) << DEBUGPREFIX
				 << " cLiveRelay::Activate called by VDR for chan_id= " << mChannelId <<endl;
  }
  else {
    //    Cancel();
    *(Log::getInstance()->log()) << DEBUGPREFIX
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
  mPatPmtGen(NULL), mInStartPhase(true), mFrameDetector(NULL), mVpid(0), mVtype(0), mPpid(0), mStartThreshold(75*188),
  mCurOffset (0), mTuneInState(0), mFirstPcr (-1), mFirstPcrOffset(0), mCurPcr(-1), mCurPcrOffset(0), mNoFrames(0) ,
  mIFrameOffset(-1), mLowerOffset(0) {

  mStartThreshold= mRequest->mFactory->getConfig()->getBuiltInLivePktBuf4Sd() * 188;
  *(mLog->log()) << DEBUGPREFIX << " cResponseLive - Constructor "
		 << "mStartThreshold= " << mStartThreshold/188 << " Pkts" 
		 << " Mode= " << mRequest->mFactory->getConfig()->getBuiltInLiveStartMode()
		 << endl;

  if (InitRelay(chan_id)) {
    mRelay->setNotifRequired();
    mRequest->mFactory->clrWriteFlag(mRequest->mFd);
  }

  if (mRelay == NULL) {
    *(mLog->log()) << DEBUGPREFIX << " cResponseLive::cResponseLive - Constructor - sending Error" << endl;
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
		   << " " << channel_id << " No channel found! " << endl;
    mRequest->mFactory->OsdStatusMessage("Channel not found!");
    return false;
  }

  char buf [40];
  snprintf(buf, 40, "%s", *(channel->GetChannelID()).ToString());

  *(mLog->log()) << DEBUGPREFIX 
		 << " vpid= " << channel->Vpid()
		 << " vtype= " << channel->Vtype()
		 << " ppid= " << channel->Ppid()
		 << endl;

  if (channel->Vpid() == 0) {
    mStartThreshold= 10 * 188;
    
    *(mLog->log()) << DEBUGPREFIX << " cResponseLive::InitRelay Audio Only service  detected. mStartThreshold is " << mStartThreshold 
		   << " (" << mStartThreshold/188 << " Pkts)" << endl;
    mInStartPhase = true;
  }

  if (channel->Vpid() != 0) {
    mVpid = channel->Vpid();
    mVtype = channel->Vtype();
    mPpid = channel->Ppid();

    if (mVtype == 27) {
      mStartThreshold= mRequest->mFactory->getConfig()->getBuiltInLivePktBuf4Hd() * 188;
      
      *(mLog->log()) << DEBUGPREFIX << " cResponseLive::InitRelay H.264 detected. mStartThreshold is " << mStartThreshold 
		     << " (" << mStartThreshold/188 << " Pkts)" << endl;
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
  //  mBlkPos = 0;
  //  mBlkLen = 0;
  
  uchar* ptr = mPatPmtGen->GetPat();
  memcpy(mBlkData + mBlkLen, ptr, 188);
  mBlkLen += 188;

  int idx = 0;
  while ((ptr = mPatPmtGen->GetPmt(idx)) != NULL) {
    memcpy(mBlkData+mBlkLen, ptr, 188);
    mBlkLen += 188;
  };
}

int cResponseLive::fillDataBlk() {
  if (mError)
    return ERROR;

  switch (mRequest->mFactory->getConfig()->getBuiltInLiveStartMode()){
  case 0:
    return fillDataBlk_straight();
    break;
  case 3: 
    return fillDataBlk_duration();
    break;
  case 4: 
  default:
    return fillDataBlk_iPlusDuration();
    break;
  };

  *(mLog->log()) << DEBUGPREFIX
		 << " cResponseLive::fillDataBlk() - ERROR: should not be here " << endl;
  
  return ERROR;
}

//--------------------------------------------------------------------------
//--------------------------------------------------------------------------
//--------------------------------------------------------------------------
//--------------------------------------------------------------------------

int cResponseLive::fillDataBlk_straight() {
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
      if (mInStartPhase)
	sendHeaders(200, "OK", NULL, "video/mpeg", -1, -1);

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

//--------------------------------------------------------------------------
//--------------------------------------------------------------------------
//--------------------------------------------------------------------------
//--------------------------------------------------------------------------

int cResponseLive::fillDataBlk_duration() {
  mBlkPos = 0;
  mBlkLen = 0;
  
  if (mError)
    return ERROR;
  
  if (mInStartPhase) {
    pthread_mutex_lock(&(mRelay->processedRingLock));
    int r;
    char *b = (char*)mRelay->mRingBuffer->Get(r);

    if (b != NULL) {
      if ((r % 188) != 0) {
	*(mLog->log()) << DEBUGPREFIX << " ERROR: r= " << r << " %188 = " << (r%188) << endl;	
      }
      
      *(mLog->log()) << DEBUGPREFIX 
		     << " --------------- pkts= " << r / 188 << endl;

      while ((mCurOffset +188) <= r) {
	//      while ((offset +188) <= r) {
	if (TsPid((const uchar*) (b+mCurOffset)) == mPpid){    
	  int64_t pcr = TsGetPcr((const uchar*) (b+mCurOffset));
	  if (pcr != -1) {
	    // pcr found	    
	    //	    *(mLog->log()) << DEBUGPREFIX << " pcr found offset= " << offset << " pcr= " <<pcr << " pkt= " << offset / 188<< endl;
	    
	    if (mCurPcr == -1){
	      mCurPcr = pcr;

	      *(mLog->log()) << DEBUGPREFIX
			     << " cResponseLive::fillDataBlk_duration() - first_pcr= " << mCurPcr
			     << " pkt= " << mCurOffset / 188 << endl;
	      if (mCurOffset != 0) {
		// deleting the packets before the pcr packet.
		*(mLog->log()) << DEBUGPREFIX
			       << " cResponseLive::fillDataBlk_duration() - deleting packets " << mCurOffset 
			       << " pkt= " << mCurOffset / 188 << endl;
		mRelay->mRingBuffer->Del(mCurOffset);

		pthread_mutex_unlock(&(mRelay->processedRingLock));

		// sleep for a while
		mRequest->mFactory->clrWriteFlag(mRequest->mFd);
		mRelay->setNotifRequired();
		return OKAY;
	      }

	      mCurOffset += 188;
	      continue; // process next packet
	    }
	    if (mCurPcr > pcr) {
	      mCurPcr = pcr;

	      *(mLog->log()) << DEBUGPREFIX
			     << " cResponseLive::fillDataBlk_duration() - ERROR - wired. setting new first_pcr= " << mCurPcr
			     << " pkt= " << mCurOffset / 188 << endl;

	      mCurOffset += 188;
	      continue; // process next packet
	      
	    }
	    //	    if ((pcr - first_pcr) > (0.8 * 27000000.0)) {
	    if ((pcr - mCurPcr) > (mRequest->mFactory->getConfig()->getBuiltInLiveBufDur()  * 27000000.0)) {
	      
	      // ok start now
	      *(mLog->log()) << DEBUGPREFIX 
			     << " cResponseLive::fillDataBlk_duration() - starting " 
			     << "pcr= " << pcr 
			     << "(pcr - first_pcr) / 27000000.0 =  "
			     << (pcr - mCurPcr) / 27000000.0
			     << " ts pkts= " << ((mCurOffset +188)/ 188)
			     << endl;
	      
	      mInStartPhase = false;
	      sendHeaders(200, "OK", NULL, "video/mpeg", -1, -1);
	      WritePatPmt();
	      int len = (r > (MAXLEN - mBlkLen)) ? (MAXLEN - mBlkLen): r;
      
	      if (r > (MAXLEN - mBlkLen)) {
		*(mLog->log()) << DEBUGPREFIX 
			       << " cResponseLive::fillDataBlk_duration() mInStartPhase = false - ((r - offset ) > (MAXLEN - mBlkLen)) len= " << len 
			       << " MAXLEN= " << MAXLEN
			       << " mBlkLen= " << mBlkLen
			       << endl; 
	      }
	      memcpy(mBlkData + mBlkLen, b, len);
	      
	      mBlkLen += len;
	      mRelay->mRingBuffer->Del(len);

	      break;
	    } // if ((pcr - first_pcr) > (0.25 * 90000.0)) {
	  } // if (pcr != -1) {
	} // if (TsPid((const uchar*) (b+offset)) == mPpid){
	mCurOffset += 188;
      } // while ((offset +188) <= r) {
    } // if (b != NULL) {
    else 
      *(mLog->log()) << DEBUGPREFIX
		     << " cResponseLive::fillDataBlk_duration() - b is ZERO" << endl;
    
    if (mInStartPhase) {
      // still in start Phase, so wait
      *(mLog->log()) << DEBUGPREFIX
		     << " cResponseLive::fillDataBlk_duration() - still in start phase, so wait" << endl;
      mRequest->mFactory->clrWriteFlag(mRequest->mFd);
      mRelay->setNotifRequired();
    }

    pthread_mutex_unlock(&(mRelay->processedRingLock));


  } // if (mInStartPhase) {
  else {
    if (mRelay->mRingBuffer->Available() < 188) {
      // nothing to send, sleep
      mRequest->mFactory->clrWriteFlag(mRequest->mFd);
      mRelay->setNotifRequired();
      return OKAY;
    }
    
    pthread_mutex_lock(&(mRelay->processedRingLock));
    int r;
    char *b = (char*)mRelay->mRingBuffer->Get(r);
    
    if (b != NULL) {
      if ((r % 188) != 0) {
	*(mLog->log()) << DEBUGPREFIX << " ERROR: r= " << r << " %188 = " << (r%188) << endl;	
      }
      
      WritePatPmt();
      int len = (r > (MAXLEN - mBlkLen)) ? (MAXLEN - mBlkLen): r;
      
      if (r > (MAXLEN - mBlkLen)) {
	*(mLog->log()) << DEBUGPREFIX 
		       << " cResponseLive::fillDataBlk_duration() mInStartPhase = false - ((r - offset ) > (MAXLEN - mBlkLen)) len= " << len 
		       << " MAXLEN= " << MAXLEN
		       << " mBlkLen= " << mBlkLen
		       << endl; 
      }
      memcpy(mBlkData + mBlkLen, b, len);
      
      mBlkLen += len;
      mRelay->mRingBuffer->Del(len);
      
    }
    else {
      *(mLog->log()) << DEBUGPREFIX
		     << " cResponseLive::fillDataBlk_duration() - b is ZERO" << endl;
    }

    pthread_mutex_unlock(&(mRelay->processedRingLock));	
  } // else
  
  return OKAY;
}

//--------------------------------------------------------------------------
//--------------------------------------------------------------------------
//--------------------------------------------------------------------------
//--------------------------------------------------------------------------

bool cResponseLive::findIFrame(char *b, int r) {
  // search from mCurOffset onwards for the iframe. 
  // return true, when found

  cFrameDetector frame_detector(mVpid, mVtype);
  *(mLog->log()) << DEBUGPREFIX
		 << " fillDataBlk_iPlusDuration findIFrame continue in state " << mTuneInState << " at ts " << mCurOffset/188
		 << endl;

  // run here only if mTuneInState is ZERO
  if (mTuneInState != 0) 
    return true;

  while ((mCurOffset +188) <= r) {

    if ((b+mCurOffset)[0] != 0x47) {
      *(mLog->log()) << " fillDataBlk_iPlusDuration - ERROR: ******* Out of Sync " << endl;
    }
    
    if (TsPid((const uchar*) (b+mCurOffset)) == mPpid){    
      int64_t pcr = TsGetPcr((const uchar*) (b+mCurOffset));
      if (pcr != -1) {
	if (mFirstPcr == -1) {

	  mFirstPcr = pcr;
	  mFirstPcrOffset = mCurOffset;
	  *(mLog->log()) << DEBUGPREFIX
			 << " fillDataBlk_iPlusDuration - setting mFirstPcr " << mFirstPcr
			 << endl;
	}
	mCurPcr = pcr;
	mCurPcrOffset = mCurOffset;
      }
    } // if (TsPid((const uchar*) (b+offset)) == mPpid){
    if (TsPid((const uchar*) (b+mCurOffset)) == mVpid){    

      //ok. point to frame start now. check whether i frame
      if (TsIsScrambled((const uchar*) (b+mCurOffset)))
	*(mLog->log()) << DEBUGPREFIX 
		       << " fillDataBlk_iPlusDuration - TsIsScrambled" << endl;

      if (frame_detector.Analyze((const uchar*) (b+mCurOffset), (r - mCurOffset) ) == 0) {
	// not sufficient data. delete and return
	return false;
      }

      if (frame_detector.NewFrame()) {
	mNoFrames ++;
      }
      else  {
	mCurOffset += 188;
	continue;
      }

      if (frame_detector.IndependentFrame()) {
	*(mLog->log()) << DEBUGPREFIX 
		       << " fillDataBlk_iPlusDuration iframe found at " << mCurOffset/188 
		       << " pkts r= " << r/188 << " mCurPcr= " << mCurPcr
		       << " at " << (mCurPcrOffset/188) <<  endl;
	*(mLog->log()) << DEBUGPREFIX 
		       << " fillDataBlk_iPlusDuration mFirstPcr= " << mFirstPcr
		       << " (mCurPcr - mFirstPcr) / 27MHz= " << (mCurPcr - mFirstPcr) / 27000000.0
		       << endl;
	mIFrameOffset = mCurOffset;

	mTuneInState = 1;
	return true;
	break;
      }
      
    } // if (TsPid((const uchar*) (b+offset)) == mVpid){
    mCurOffset += 188;
  } // while ((offset +188) <= r) {

  // I should have now the offset of the iframe.
  if (mIFrameOffset == -1){
    return false;
  }

  return false;
}

bool cResponseLive::bufferData(char* b, int r) {
  // buffer additional data, after the iframe.
  *(mLog->log()) << DEBUGPREFIX
		 << " fillDataBlk_iPlusDuration bufferData continue in state " << mTuneInState << " at ts "<< mCurOffset/188
		 << " with mCurPcr= " << mCurPcr 
		 << endl;
  
  while ((mCurOffset +188) <= r) {
    if (TsPid((const uchar*) (b+mCurOffset)) == mPpid){    
      int64_t pcr = TsGetPcr((const uchar*) (b+mCurOffset));
      if (pcr != -1) {

	if (mFirstPcr == -1) {
	  *(mLog->log()) << DEBUGPREFIX
			 << " fillDataBlk_iPlusDuration - WARNING - re setting mFirstPcr " << mCurOffset/188 
			 << endl;
	  mFirstPcr = pcr;
	  mFirstPcrOffset = mCurOffset;
	  *(mLog->log()) << DEBUGPREFIX
			 << " fillDataBlk_iPlusDuration - setting mFirstPcr " << mFirstPcr
			 << endl;

	}

	if (mCurPcr == -1){
	  mCurPcr = pcr;
	  mCurPcrOffset = mCurOffset;
	  mCurOffset += 188;
	  continue; // process next packet
	}
	if (mCurPcr > pcr) {
	  mCurPcr = pcr;
	  mCurPcrOffset = mCurOffset;
	  
	  *(mLog->log()) << DEBUGPREFIX
			 << " fillDataBlk_iPlusDuration - ERROR - wired. setting new mCurPcr= " << mCurPcr 
			 << " pkt= " << mCurOffset / 188 << endl;
	  mCurOffset += 188;
	  continue; // process next packet
	}
	//	    if ((pcr - first_pcr) > (0.8 * 27000000.0)) {
	if ((pcr - mCurPcr) > (mRequest->mFactory->getConfig()->getBuiltInLiveBufDur() * 27000000.0)) {
	  // OK, sufficient data to start
	  *(mLog->log()) << DEBUGPREFIX 
			 << " fillDataBlk_iPlusDuration - starting " 
			 << "pcr= " << pcr
			 << " mCurPcr= " << mCurPcr
			 << " (pcr - mCurPcr ) / 27MHz =  "
			 << (pcr - mCurPcr) / 27000000.0
			 << endl ;
	  
	  *(mLog->log()) << DEBUGPREFIX 
			 << " fillDataBlk_iPlusDuration --- " 
			 << " pcr= " << pcr
			 << " mFirstPcr= " << mFirstPcr
			 << " (pcr - mFirstPcr) / 27MGz= " << (pcr - mFirstPcr ) / 27000000.0
			 << endl;

	  *(mLog->log()) << DEBUGPREFIX 
			 << " fillDataBlk_iPlusDuration mFirstPcr= " << mFirstPcr
			 << " (mCurPcr - mFirstPcr) / 27MHz= " << (mCurPcr - mFirstPcr) / 27000000.0
			 << endl;
	  *(mLog->log()) << DEBUGPREFIX 
			 << " fillDataBlk_iPlusDuration " 
			 << " no_frames " << mNoFrames
			 << " ts pkts= " << ((mCurOffset +188)/ 188)
			 << " offset= " << mCurOffset
			 << endl;


	  mInStartPhase = false;
	  mTuneInState = 2; 
	  
	  sendHeaders(200, "OK", NULL, "video/mpeg", -1, -1);
	  WritePatPmt();

	  return true;
	  break;
	  
	} // if ((pcr - first_pcr) > (0.8 * 27000000.0)) {
      }
    } // if (TsPid((const uchar*) (b+offset)) == mPpid){ // find pcr 
    mCurOffset += 188;
  } //while ((offset +188) <= r) { // find pcr

  return false;
}

bool cResponseLive::setLowerOffset(char *b, int r) {
  mLowerOffset = 0;  

  if (mCurPcr != -1) {
    int idx = 0;
    while ((idx +188) <= mIFrameOffset) {
      // I only need to run until the offset of the i frame.
      if (TsPid((const uchar*) (b+idx)) == mPpid){
	int64_t pcr = TsGetPcr((const uchar*) (b+idx));
	if (pcr != -1) {
	  *(mLog->log()) << DEBUGPREFIX
			 << " fillDataBlk_iPlusDuration find lower_offset pkt= " << idx / 188
			 << " pcr= " << pcr
			 << " ((mCurPcr - pcr) / 27000000.0)= " << ((mCurPcr - pcr) / 27000000.0)
			 << endl;
	  if (((mCurPcr - pcr) / 27000000.0) < 0.55) {
	    if (((mCurPcr - pcr) / 27000000.0) > 0.48) {			
	      // from here.
	      mLowerOffset = idx;
	      *(mLog->log()) << DEBUGPREFIX
			     << " fillDataBlk_iPlusDuration - lower_offset= " << mLowerOffset
			     << " pcr= " << pcr 
			     << " ((pcr - mFirst_pcr) / 27MHz)= " << (( pcr - mFirstPcr) / 27000000.0)
			     << endl;
	      *(mLog->log()) << DEBUGPREFIX
			     << " fillDataBlk_iPlusDuration - lower_offset= "
			     << " ((mCurPcr - pcr ) / 27MHz)= " << (( mCurPcr - pcr ) / 27000000.0)
			     << endl;
			
	    }
	    break;
	  }
	}
      }
      idx += 188;
    } // while ((idx +188) <= offset)
  }
  return true;
}

void cResponseLive::justFillDataBlk(char *b, int r) {
  int len = ((r - mLowerOffset) > (MAXLEN - mBlkLen)) ? (MAXLEN - mBlkLen): (r - mLowerOffset);
      
  if (( r - mLowerOffset) > (MAXLEN - mBlkLen)) {
    *(mLog->log()) << DEBUGPREFIX 
		   << " fillDataBlk_iPlusDuration - mInStartPhase = false - ((r - offset ) > (MAXLEN - mBlkLen)) len= " << len 
		   << " MAXLEN= " << MAXLEN
		   << " mBlkLen= " << mBlkLen
		   << endl; 
      }
  memcpy(mBlkData + mBlkLen, (b + mLowerOffset), len);
  
  mBlkLen += len;
  mRelay->mRingBuffer->Del(mLowerOffset + len);

};

// new method: 200ms after the IFrame
int cResponseLive::fillDataBlk_iPlusDuration() {
  //TODO: Prapably, I need to delete some data before the i_frame offset

  mBlkPos = 0;
  mBlkLen = 0;
  
  if (mError)
    return ERROR;
  
  if (mInStartPhase) {
    pthread_mutex_lock(&(mRelay->processedRingLock));
    int r;
    char *b = (char*)mRelay->mRingBuffer->Get(r);

    if (b != NULL) {
      if ((r % 188) != 0) {
	*(mLog->log()) << DEBUGPREFIX 
		       << " fillDataBlk_iPlusDuration - ERROR: r= " << r << " %188 = " << (r%188) << endl;	
      }

      *(mLog->log()) << DEBUGPREFIX 
		     << " fillDataBlk_iPlusDuration --------------- pkts= " << r / 188 << endl;

      if((r / 188) > 40000) {	
	*(mLog->log()) << DEBUGPREFIX 
		       << " fillDataBlk_iPlusDuration Risk an overrun, so starting " << r / 188 << endl;

	sendHeaders(200, "OK", NULL, "video/mpeg", -1, -1);
	WritePatPmt();

	justFillDataBlk(b,r); 
	mInStartPhase = false;
	pthread_mutex_unlock(&(mRelay->processedRingLock));
	return OKAY;
      }

      if (!findIFrame(b, r)) {

	pthread_mutex_unlock(&(mRelay->processedRingLock));
	
	// sleep for a while, not sufficient data
	mRequest->mFactory->clrWriteFlag(mRequest->mFd);
	mRelay->setNotifRequired();
	return OKAY;
      }

      if (!bufferData(b, r)) {
	// return;
	pthread_mutex_unlock(&(mRelay->processedRingLock));
	
	// sleep for a while, not sufficient data
	mRequest->mFactory->clrWriteFlag(mRequest->mFd);
	mRelay->setNotifRequired();
	return OKAY;
      }
      else {
	// have all data now!
	//    pthread_mutex_unlock(&(mRelay->processedRingLock));
	//	return OKAY;
      }

      // here I have all data.
      setLowerOffset(b,r);
      justFillDataBlk(b,r); 
      
    } // if (b != NULL) { in startPhase
    else 
      *(mLog->log()) << DEBUGPREFIX
		     << " fillDataBlk_iPlusDuration - b is ZERO" << endl;
    pthread_mutex_unlock(&(mRelay->processedRingLock));

  } //  if (mInStartPhase) {
  else {
    // not in start phase

    if (mRelay->mRingBuffer->Available() < 188) {
      // nothing to send, sleep
      mRequest->mFactory->clrWriteFlag(mRequest->mFd);
      mRelay->setNotifRequired();
      return OKAY;
    }
    
    pthread_mutex_lock(&(mRelay->processedRingLock));
    int r;
    char *b = (char*)mRelay->mRingBuffer->Get(r);
    
    if (b != NULL) {
      if ((r % 188) != 0) {
	*(mLog->log()) << DEBUGPREFIX 
		       << " fillDataBlk_iPlusDuration - ERROR: r= " << r << " %188 = " << (r%188) << endl;	
      }      
      WritePatPmt();
      int len = (r > (MAXLEN - mBlkLen)) ? (MAXLEN - mBlkLen): r;
      
      if (r > (MAXLEN - mBlkLen)) {
	*(mLog->log()) << DEBUGPREFIX 
		       << " fillDataBlk_iPlusDuration - mInStartPhase = false - ((r - offset ) > (MAXLEN - mBlkLen)) len= " << len 
		       << " MAXLEN= " << MAXLEN
		       << " mBlkLen= " << mBlkLen
		       << endl; 
      }
      memcpy(mBlkData + mBlkLen, b, len);
      
      mBlkLen += len;
      mRelay->mRingBuffer->Del(len);
      
    } // if (b != NULL) {
    else {
      *(mLog->log()) << DEBUGPREFIX
		     << " fillDataBlk_iPlusDuration - b is ZERO" << endl;
      
    }

    pthread_mutex_unlock(&(mRelay->processedRingLock));	

  } // else
  
  return OKAY;
}

