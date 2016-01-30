/*
 * httpclient.c: VDR on Smart TV plugin
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

#include "httpclient.h"
#include "smarttvfactory.h"

#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#include <cstdlib>
#include <sstream>

#define OKAY 0
#define ERROR (-1)


#define DEBUG

#define DEBUGPREFIX mLog->getTimeString() << ": mClient= " << mReqId << " fd= " << mFd

cHttpClientBase::cHttpClientBase(int f, int id, int port, SmartTvServer* factory, string peer) : cHttpResourceBase(f, id, port, "-", factory),
  mLog(), mRequestMessage(""), mRequestMessagePos(0), mConnState(0), mResponseHdr(), mRespBdyLen(-1), 
  mStatus(-1), mIsChunked(false), mResponseBdy(), 
  mPeer(peer), mTransCount(0) {

  mLog = Log::getInstance();

#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX
		 << "cHttpClientBase Constructor" << endl; 
#endif
  mRequestMessage = "";
}

cHttpClientBase::~cHttpClientBase() {
  *(mLog->log()) << "cHttpClientBase Destructor" << endl; 
}

int cHttpClientBase::handleRead() {
  if ((mConnState == 0) || (mConnState ==3)) {
    *(mLog->log()) << DEBUGPREFIX
		   << " Read during write or wait state. Ok, return." << endl; 
    return OKAY;    
  }
#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX
		 << "  handleRead" << endl; 
#endif

  const size_t bufflen = 4096; 
  ssize_t bytesreceived = 0; 
  char buff[bufflen]; 

  string tmp = "";
  bytesreceived = recv(mFd, buff, bufflen, 0);   
  if (bytesreceived <0 ) { 
    *(mLog->log()) << DEBUGPREFIX << " ERROR while receiving" << endl; 
    return ERROR; 
  } 

  if (bytesreceived ==0 ) { 
#ifndef DEBUG
    *(mLog->log()) << DEBUGPREFIX << " Done: No bytes received anymore -> Closing" 
      		   << " mRespBdyLen= " << mRespBdyLen
		   << " mResponseBdy.size()= " << mResponseBdy.size()
		   << endl; 
#endif
    return ERROR; 
  } 

  tmp = string(buff, bytesreceived);

  size_t pos ;
  switch (mConnState) {
  case 1:
    // looking for header end
    pos = tmp.find("\r\n\r\n");

    if (pos == string::npos)
      mResponseHdr += tmp;
    else {
      // Header End found
#ifndef DEBUG
      *(mLog->log()) << DEBUGPREFIX
		     << " Header End Found. Setting mConnState to 2"
		     << endl;
#endif

      mResponseHdr += tmp.substr(0, pos);
      if (pos+4 < tmp.size())
	mResponseBdy = tmp.substr(pos+4);
      mConnState = 2;
      processResponseHeader();      
    }
    
    break;
  case 2:
    // end of state 2 is determined in checkTransactionCompletion 
    mResponseBdy += tmp;
    break;
  default:
    *(mLog->log()) << DEBUGPREFIX
		   << " ERROR in handleRead: Def: " <<  tmp << endl; 
    break;
  }

#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX
		 << " handleRead - end" << endl; 
#endif  
  return checkTransactionCompletion();
}

int cHttpClientBase::handleWrite() {
  if (mConnState == 3) {
    // waiting
    timeval now;
    gettimeofday(&now, 0);

    long diff; // in ms
    diff = (now.tv_sec - mWaitStart.tv_sec) *1000;
    diff += (now.tv_usec - mWaitStart.tv_usec) /1000;
    mWaitCount++;

    if ((diff > 40) || (mWaitCount>10000)) {
      createRequestMessage("");
    }
    return OKAY;

  }
  if (mConnState >0) {
    return OKAY;
  }
  
#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX << " ++++ handleWrite ++++" << endl; 
#endif

  int rem_len = mRequestMessage.size() - mRequestMessagePos;
  if (rem_len == 0)  {
    mConnState = 1; // Change state to Read
    *(mLog->log()) << DEBUGPREFIX 
		   << " WARNING: Should not be here " << endl;
    return OKAY;
  }
  
  string tmp = mRequestMessage.substr(mRequestMessagePos, rem_len);

#ifndef DEBUG
  *(mLog->log()) << DEBUGPREFIX
		 << " handleWrite: mTransCount= " << mTransCount
		 << " Msg.size= " << mRequestMessage.size() 
		 << endl;
#endif
  int snd = send(mFd, tmp.c_str(), (size_t) tmp.size(), 0);
  
  if (snd <0) { 
    *(mLog->log()) << DEBUGPREFIX << " ERROR while sending" << endl; 
    return ERROR; 
  } 

  if (snd == rem_len) {
    // done with sending. Reading now
    mConnState = 1;
#ifndef DEBUG
    *(mLog->log()) << DEBUGPREFIX << " -> Done with Sending. Reading now" << endl;
#endif
  }
  else {
    *(mLog->log()) << DEBUGPREFIX << " Sent " << snd << " byte. Continue writing request." << endl;
  }
  mRequestMessagePos+= snd;
  return OKAY;
}

int cHttpClientBase::checkStatus() {
  // TODO: Should check for stalled client
  return OKAY;
}

void cHttpClientBase::createRequestMessage(string path) {
  mResponseHdr= "";
  mResponseBdy= "";
  mRespBdyLen = -1;
  mRequestMessagePos = 0;  
  mStatus = -1;
  mConnState = 0; // WriteRequest

  string req_body = "";
  stringstream cont_len;

  string device_id = "12331";
  string device_name = "VdrOnTv";
  string vendor = "mVdrOnTv";
  string product = "SMARTDev";

    
  switch (mTransCount) {
  case 0:
    mRequestMessage = "POST /ws/app/VdrOnTv/connect HTTP/1.1\r\n";
    mRequestMessage += "Host: " + mPeer + "\r\n";
    mRequestMessage += "SLDeviceID: "+device_id +"\r\n";
    mRequestMessage += "ProductID: "+product+"\r\n";
    mRequestMessage += "VendorID: "+vendor+"\r\n";
    mRequestMessage += "DeviceName: "+device_name+"\r\n";
    mRequestMessage += "Connection: keep-alive\r\n";
    mRequestMessage += "Content-Length: 0\r\n";
    mRequestMessage += "Accept: */*\r\n";   
    mRequestMessage += "\r\n";
    
    break;
  case 1:
#ifndef DEBUG
    *(mLog->log()) << DEBUGPREFIX
		   << " NextMessage: mTransCount= " << mTransCount
		   << endl;
#endif

    req_body = getMsgBody(mTransCount);
    cont_len << "Content-Length: " << req_body.size() << "\r\n";

    mRequestMessage = "POST /ws/app/VdrOnTv/queue HTTP/1.1\r\n";
    mRequestMessage += "Host: " + mPeer + "\r\n";
    mRequestMessage += "SLDeviceID: "+device_id +"\r\n";
    mRequestMessage += "Accept: */*\r\n";   
    mRequestMessage += "Connection: keep-alive\r\n";
    mRequestMessage += "Content-Type: application/json\r\n";
    mRequestMessage += cont_len.str();
    
    mRequestMessage += "Accept-Charset: ISO-8859-1,utf-8;q=0.7,*;q=0.3\r\n";
    mRequestMessage += "\r\n";
    
    mRequestMessage += req_body; 
    
    break;

  default:
    *(mLog->log()) << DEBUGPREFIX
		   << " ############ ERROR, mTransCount= " << mTransCount
		   << endl;
    break;
    
  }
}


void cHttpClientBase::processResponseHeader() {
  mRespBdyLen = -1;

  size_t s_sp = mResponseHdr.find(" ");
  size_t s_sp2 = mResponseHdr.find(" ", s_sp+1);

  mStatus = atoi(mResponseHdr.substr(s_sp, (s_sp2-s_sp)).c_str());
  *(mLog->log()) << DEBUGPREFIX
		 << " mStatus= " << mStatus
		 << endl;
  size_t c_start = mResponseHdr.find("Content-Length:");
  if (c_start != string::npos) {
    size_t c_col = mResponseHdr.find(':', c_start);
    size_t c_end = mResponseHdr.find('\r', c_start);
		  
    mRespBdyLen = atoi(mResponseHdr.substr(c_col +1, (c_end -c_col -1)).c_str());
    *(mLog->log()) << DEBUGPREFIX 
		   << " Content-Length(val)= " << mRespBdyLen
		   << endl;
    
  } // if (c_start != string::npos) {
  else {
    *(mLog->log()) << DEBUGPREFIX
		   << " Content-Length not found "
		   << endl;
  }

  size_t tr_start = mResponseHdr.find("Transfer-Encoding:");
  if (tr_start != string::npos) {
    size_t tr_col = mResponseHdr.find(':', tr_start);
    size_t tr_end = mResponseHdr.find('\r', tr_start);

    string chunked = mResponseHdr.substr(tr_col +1, (tr_end -tr_col -1));
    *(mLog->log()) << DEBUGPREFIX 
		   << " Transfer-Encoding(val)= " << chunked
		   << endl;
    mIsChunked = false;

  } // if (tr_start != string::npos) {

}


int cHttpClientBase::checkTransactionCompletion() {
  // hmm, here I assume that the response is received in first byte chunk
  // should first check that I am in state 2 (hdr received)
  if (mConnState < 2)
    return OKAY;

  //OK, header received
  if (mStatus != 200) {
    *(mLog->log()) << DEBUGPREFIX
		   << " Closing.... Status= " << mStatus
		   << endl;
    return ERROR;
  }
  
  if ((mRespBdyLen <= mResponseBdy.size()) || (mRespBdyLen == 0)) {
    
    *(mLog->log()) << DEBUGPREFIX
		   << " Transaction completed. mTransCount= " << mTransCount
		   << endl;

    if (mTransCount ==0 ) {
      // ok
      gettimeofday(&mWaitStart, 0);
      mWaitCount = 0;
      mConnState = 3;
      mTransCount++;
      return OKAY;
    }
    else
      return ERROR;
  }
  return OKAY;
}

//------------------------------
//----- cHttpYtPushClient ------
//------------------------------

cHttpYtPushClient::cHttpYtPushClient(int f, int id, int port, SmartTvServer* fac, string peer, string vid, bool store) : cHttpClientBase(f, id, port, fac, peer), 
  mVideoId(vid), mStore(store) {

  createRequestMessage("");
}

cHttpYtPushClient::~cHttpYtPushClient() {
}

string cHttpYtPushClient::getMsgBody(int) {
  return "{\"type\":\"YT\",payload:{\"id\":\"" + mVideoId +"\", \"store\":"+((mStore)?"true":"false")+"}}";
}

//------------------------------
//----- cHttpCfgPushClient ------
//------------------------------

cHttpCfgPushClient::cHttpCfgPushClient(int f, int id, int port, SmartTvServer* fac, string peer) : cHttpClientBase(f, id, port, fac, peer) {
  createRequestMessage("");
}

cHttpCfgPushClient::~cHttpCfgPushClient() {
}

string cHttpCfgPushClient::getMsgBody(int) {
  return "{\"type\":\"CFGADD\",payload:{\"serverAddr\":\"" + mPeer +"\"" +"}}";
}

//------------------------------
//----- cHttpInfoClient ------
//------------------------------
cHttpInfoClient::cHttpInfoClient(int f, int id, int port, SmartTvServer* fac, string peer, string bdy) : cHttpClientBase(f, id, port, fac, peer), mBody(bdy) {

  createRequestMessage("");
}

cHttpInfoClient::~cHttpInfoClient() {
}

string cHttpInfoClient::getMsgBody(int) {
  return "{\"type\":\"INFO\",payload:" + mBody +"}";;
}


//--------------------------------
//----- cHttpMesgPushClient ------
//--------------------------------
cHttpMesgPushClient::cHttpMesgPushClient(int f, int id, int port, SmartTvServer* fac, string peer, string mesg) : cHttpClientBase(f, id, port, fac, peer), mMesg(mesg) {

  createRequestMessage("");
}

cHttpMesgPushClient::~cHttpMesgPushClient() {
}

string cHttpMesgPushClient::getMsgBody(int) {
  return "{\"type\":\"MESG\",payload:\"" + mMesg +"\"}";;
}
