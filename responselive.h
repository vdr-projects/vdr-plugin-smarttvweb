/*
 * responselive.h: VDR on Smart TV plugin
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

#ifndef __RESPONSE_LIVE_H__
#define __RESPONSE_LIVE_H__

#include "responsebase.h"

#include <cstdio>
#include <string>
#include <sys/time.h>

#include <vdr/ringbuffer.h>
#include <vdr/receiver.h>

//class cHttpResource;

using namespace std;

#if VDRVERSNUM < 10732
#define PCRFACTOR 300 // conversion from 27MHz PCR extension to 90kHz PCR base

inline int64_t TsGetPcr(const uchar *p)
{
  if (TsHasAdaptationField(p)) {
     if (p[4] >= 7 && (p[5] & TS_ADAPT_PCR)) {
        return ((((int64_t)p[ 6]) << 25) |
                (((int64_t)p[ 7]) << 17) |
                (((int64_t)p[ 8]) <<  9) |
                (((int64_t)p[ 9]) <<  1) |
                (((int64_t)p[10]) >>  7)) * PCRFACTOR +
               (((((int)p[10]) & 0x01) << 8) |
                ( ((int)p[11])));
        }
     }
  return -1;
}
#endif


//class SmartTvServer;
class cPatPmtGenerator;

class cLiveRelay : public cReceiver {
 public:
  cLiveRelay(cChannel* channel, cDevice* device, string chan_id, int req_id, cHttpResource*);
  ~cLiveRelay();
  //  static cLiveRelay *create(string channel_id, int req_id, cHttpResource*);

  //  void addClient();
  //  int removeClient();

  void setNotifRequired() { mNotifRequired = true; }; 
  string mChannelId;
  cRingBufferLinear *mRingBuffer;
  pthread_mutex_t processedRingLock;

protected:
  virtual void Activate(bool On);
  virtual void Receive(uchar *Data, int Length);
  void detachLiveRelay();
  // cThread
  //  virtual void Action(void);

  Log* mLog;
 private:
  //  SmartTvServer *mFactory;
  int            mReqId;
  cHttpResource* mRequest;
  //  int            mNumClients;
  //  timeval        mStartTime;

  int            mNotifFd;
  bool           mNotifRequired;
};

class cResponseLive : public cResponseBase {
 public:
  cResponseLive(cHttpResource*, string chan_id );
  virtual ~cResponseLive(); 

  int fillDataBlk();
  
  int fillDataBlk_straight();
  //  int fillDataBlk_pcr();
  //  int fillDataBlk_iframe();
  int fillDataBlk_duration();
  int fillDataBlk_iPlusDuration();

  bool findIFrame(char *b, int r);
  bool bufferData(char *b, int r);
  bool setLowerOffset(char *b, int r);
  void justFillDataBlk(char *b, int r);

 private:
  bool              InitRelay(string chan_id);
  void              WritePatPmt();

  string            mChannelId;
  cLiveRelay*       mRelay;

  cPatPmtGenerator* mPatPmtGen; 
  bool              mInStartPhase;
  cFrameDetector*   mFrameDetector;
  int               mVpid;
  int               mVtype;
  int               mPpid;

  int               mStartThreshold;

  // Mode 4
  int               mCurOffset;
  int               mTuneInState;
  int64_t           mFirstPcr;
  int               mFirstPcrOffset;
  int64_t           mCurPcr;
  int               mCurPcrOffset;
  int               mNoFrames;
  int               mIFrameOffset;

  int               mLowerOffset;
};

#endif
