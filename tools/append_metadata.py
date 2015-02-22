#!/usr/bin/python

#
# append_metadata.py: VDR on Smart TV plugin
# 
# Copyright (C) 2015 T. Lohmar
# 
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
# 
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA
# Or, point your browser to http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
#


import sys, os

class AssetMetadata:
    def __init__(self, vdr_dir):
        self.mTitle = ""
        self.mImage = ""
        self.mDesc = ""
        self.mChannel = ""
        self.mShort = ""
        self.mImagePath = None

        self.mRecTime =-1

        print vdr_dir
        
        if (os.path.exists(vdr_dir+"info.vdr")):
            self._parseInfo(vdr_dir+"info.vdr")
        elif (os.path.exists(vdr_dir+"info")):
            self._parseInfo(vdr_dir+"info")
        
        if (os.path.isfile(vdr_dir+"preview_vdr.png")):
            self.mImagePath= vdr_dir+"preview_vdr.png"
            pass
        pass

    def _parseInfo(self, p):
        infd= open(p, "r")
        for line in infd:
            if line[0] == 'T':
                self.mTitle = line[2:-1]
            elif line[0] == 'C':
                comp = line.split()
                self.mChannel = "".join(comp[2:])
            elif line[0] == 'S':
                # Short Text
                self.mShort = line[2:-1]
            elif line[0] == 'D':
                # Description
                self.mDesc = line[2:-1]
            elif line[0] == 'E':
                # Event Info
                elm = line.split()
                try:
                    self.mRecTime = int(elm[2])
                except:
                    print "WARNING: Not a number",elm[2]

    def Summary(self):
        print "Title: ", self.mTitle
        print "Channel: ", self.mChannel
        print "Short: ", self.mShort
        print "Desc: ", self.mDesc
        print "RecTime: ", self.mRecTime


class MP4FileReader:
    def __init__(self, fn):
        self.mFilename = fn
        self.mParentBox= "root"
        self.mMoovPos = -1
        self.mMoovSize = -1
        self.mMoov64 = False
        self.mIsMoovLast = False
        self.mHaveUdta = False

        self.mUdtaPos = -1
        self.mUdtaSize = -1
        self.mUdta64 = False
        self.mMetaPos = -1
        self.mMetaSize = -1
        self.mMeta64 = False

        self.mIlstPos = -1
        self.mIlstSize = -1
        self.mIlst64 = False

        self.mIlstKeys = []

        self.mMvhdPos = -1
        self.mMvhdVer = -1

        self._findRelevantBoxes()
    
    def readInt(self, n, ifd):
        "Read n-byte uint from file (MSB first). Return -1 if no more bytes"
        bStr = ifd.read(n)
        if len(bStr)<n:
            return -1
        bytes = [ord(b) for b in bStr]
        sum = 0
        for i in range(n):
            sum += bytes[i]<<((n-1-i)*8)
        return sum

    def readString(self, n, ifd):
        "Read n-char string."
        return ifd.read(n)

    def readBoxHdr(self, ifd):
        b_size = self.readInt(4, ifd)
        if b_size == -1:
            return b_size, "", 0
        b_name = self.readString(4, ifd)
        b_hdr = 8
        if (b_size == 1):
            b_size = self.readInt(8, ifd)
            b_hdr += 8
        return b_size, b_name, b_hdr

    def readFullBoxHdr(self, ifd):
        b_version = self.readInt(1, ifd)
        b_flags = self.readInt(3, ifd)        
        return b_version, b_flags

    def readDataHdr(self, ifd):
        b_type = self.readInt(4, ifd)
        b_locale = self.readInt(4, ifd)        
        return b_type, b_locale

    def _walkBoxTree (self, t_size, ifd, pref, b_name):
        self.mParentBox= b_name
        cur_size = 0
        while cur_size < t_size:
            pos = ifd.tell()
            b_size, b_name, b_hdr = self.readBoxHdr(ifd)
            if b_size == -1:
                break
#            print pref, b_name, pos, b_size, " n= %x %x %x %x" %(ord(b_name[0]), ord(b_name[1]), 
#                                                                 ord(b_name[2]), ord(b_name[3])), b_hdr

            if self.mParentBox == "ilst":
                self.mIlstKeys.append((b_name, pos, b_size))
            if b_name == "udta":
                self.mUdtaPos = pos
                self.mUdtaSize = b_size
                if b_hdr == 16:
                    self.mUdta64 = True
                self._walkBoxTree(b_size - b_hdr, ifd, pref+"-", b_name)
            elif b_name == "meta":
                b_ver, b_flags = self.readFullBoxHdr(ifd)
                self.mMetaPos = pos
                self.mMetaSize = b_size
                if b_hdr == 16:
                    self.mMeta64 = True
                self._walkBoxTree(b_size - b_hdr, ifd, pref+"-", b_name)
            elif b_name == "hdlr":
                self.skip(ifd, b_size - b_hdr)
#                self.hexDump(ifd, b_size - b_hdr)
            elif b_name == "mvhd":
                self.mMvhdPos = pos + b_hdr + 4
                self.mMvhdVer, f = self.readFullBoxHdr(ifd)
                ifd.seek((b_size - b_hdr -4), 1)
            elif b_name == "ilst":
                self.mIlstPos= pos
                self.mIlstSize= b_size
                if b_hdr == 16:
                    self.mIlst64 = True
                self._walkBoxTree(b_size - b_hdr, ifd, pref+"-", b_name)
            elif b_name == "\xA9\x6E\x61\x6D":
                self._walkBoxTree(b_size - b_hdr, ifd, pref+"-", b_name)
            elif b_name == "\xA9\x74\x6F\x6F":
                self._walkBoxTree(b_size - b_hdr, ifd, pref+"-", b_name)
            elif b_name == "ldes":
                self._walkBoxTree(b_size - b_hdr, ifd, pref+"-", b_name)
            elif b_name == "covr":
                self._walkBoxTree(b_size - b_hdr, ifd, pref+"-", b_name)
#            elif b_name == "data":
#                t, l = self.readDataHdr(ifd)
##                print "type= 0x%02x locale= 0x%02x" %( t, l)
#                self.hexDump(ifd, b_size - b_hdr -8, 32)
            else:
                self.skip(ifd, (b_size - b_hdr))
#                ifd.seek((b_size - b_hdr), 1)
            cur_size += b_size
        pass

    def _findRelevantBoxes(self):
        f_size = os.path.getsize(self.mFilename)
        ifd = open (self.mFilename, "r")
        pos = 0
        while True:
            pos = ifd.tell()
            b_size, b_name, b_hdr = self.readBoxHdr(ifd)
            if b_size == -1:
                break
#            print b_name, pos, b_size, b_hdr
            if b_name == "moov":
                self.mMoovPos = pos
                if b_hdr == 16:
                    self.mMoov64 = True
                self.mMoovSize = b_size
                if (self.mMoovPos + self.mMoovSize) == f_size:
                    self.mIsMoovLast = True
                self._walkBoxTree(b_size - b_hdr, ifd, "-", b_name)
            else:
                ifd.seek((b_size - b_hdr), 1)

        ifd.close()

        print "##############################"
        print "Filesize=", f_size
        print "Moov Pos=", self.mMoovPos, " size=", self.mMoovSize, "next=", self.mMoovPos+self.mMoovSize 
        print "Udta Pos=", self.mUdtaPos, " size=", self.mUdtaSize
        print "Meta Pos=", self.mMetaPos, " size=", self.mMetaSize
        print "Ilst Pos=", self.mIlstPos, " size=", self.mIlstSize
        print "isMoovLast", self.mIsMoovLast
#        print "IlstKeys:",self.mIlstKeys 
#        print "Next Ilst Pos: ", self.mIlstKeys[-1][1] +self.mIlstKeys[-1][2]
        print "##############################"
        if not self.mIsMoovLast:
            print "use AVConv to create the MP4 File: Moov box must be last in file."
            sys.exit(0)
        if self.mUdtaPos == -1:
            print "use AVConv to create the MP4 File: Udta box must be present and last in file."
            sys.exit(0)
        print
        print "Appending metadata..."
        


    def printBoxLevel(self, t_size, ifd, pref):
        cur_size = 0
        while cur_size < t_size:
            pos = ifd.tell()
            b_size, b_name, b_hdr = self.readBoxHdr(ifd)
            if b_size == -1:
                break
            print pref, b_name, pos, b_size, " n= %x %x %x %x" %(ord(b_name[0]), ord(b_name[1]), 
                                                                 ord(b_name[2]), ord(b_name[3])), b_hdr
            if b_name == "udta":
                self.printBoxLevel(b_size - b_hdr, ifd, pref+"-")
            elif b_name == "meta":
                b_ver, b_flags = self.readFullBoxHdr(ifd)
                self.printBoxLevel(b_size - b_hdr, ifd, pref+"-")
            elif b_name == "hdlr":
                self.hexDump(ifd, b_size - b_hdr)
            elif b_name == "ilst":
                self.printBoxLevel(b_size - b_hdr, ifd, pref+"-")
            elif b_name == "\xA9\x6E\x61\x6D":
                self.printBoxLevel(b_size - b_hdr, ifd, pref+"-")
            elif b_name == "ldes":
                self.printBoxLevel(b_size - b_hdr, ifd, pref+"-")
            elif b_name == "covr":
                self.printBoxLevel(b_size - b_hdr, ifd, pref+"-")
            elif b_name == "data":
                t, l = self.readDataHdr(ifd)
                print "type= 0x%02x locale= 0x%02x" %( t, l)
                self.hexDump(ifd, b_size - b_hdr -8, 32)
            else:
                ifd.seek((b_size - b_hdr), 1)
            cur_size += b_size
            
            
    def printTopLevel (self):
        ifd = open (self.mFilename, "r")
        pos = 0
        while True:
            pos = ifd.tell()
            b_size, b_name, b_hdr = self.readBoxHdr(ifd)
            if b_size == -1:
                break
            print b_name, pos, b_size, b_hdr
            if b_name == "moov":
                self.printBoxLevel(b_size - b_hdr, ifd, "-")
            else:
                ifd.seek((b_size - b_hdr), 1)

#                self.hexDump(ifd, b_size - b_hdr)
            
    def skip(self, ifd, n):
        ifd.seek(n, 1)

    def hexDump(self, ifd, n, n_max= 0):
        in_str = ifd.read(n)
        if len(in_str) < n:
            return
        asc_str = ""
        hex_str = ""
        tgt = n
        if n_max != 0:
            if len(in_str) > n_max:
                tgt = n_max
        for i in range (0, tgt):
            if ((i % 16) == 0) and (i != 0):
                print "%s %s" % (hex_str, asc_str)
                asc_str = ""
                hex_str = ""

            if (i % 16) == 8:
                asc_str += " "
                hex_str += " "

            hex_str += "%02X " % ord(in_str[i])
            if (ord(in_str[i]) >= 32 ) and (ord(in_str[i]) < 128 ):
                asc_str += in_str[i]
            else:
                asc_str += "."

                
        if len(hex_str) > 0:
            for i in range (0, (16*3) - len(hex_str) +1):
                hex_str += " "
            print "%s %s\n" % (hex_str, asc_str)


class Mp4FileModifyer (MP4FileReader):
    def __init__(self, fn):
        MP4FileReader.__init__(self, fn)
        self.mMetadata = []
        
    def writeIntAtPos(self, val, n, ofd, pos):
        ofd.seek(pos)
        for i in range(n):
            ofd.write(chr((val >> 8*(n-i-1))&255))

    def writeInt(self, val, n, b):
        for i in range(n):
            b.append((val >> 8*(n-i-1))&255)
        return b
        
    def writeString(self, val, b):
        for i in range(len(val)):
            b.append(ord(val[i]))
        return b

    def createBoxHdr(self, size, name, b):        
        b= self.writeInt(size, 4, b)
        b= self.writeString(name, b)
        return b

    def createDataBoxHdr(self, size, t, l, b):
        b= self.createBoxHdr(size + 16, "data", b) 
        b= self.writeInt(t, 4, b)
        b= self.writeInt(l, 4, b)
        return b
    
    def appendBlob(self, b):
        for i in range(len(b)):
            self.mMetadata.append(b[i])

    def addTitle(self, title):
        # add title box into the temp container
        print "addTitle (size= %d): %s" %(len(title), title) 
        b = []
        b= self.createBoxHdr(len(title) + 8 + 16, "\xA9\x6E\x61\x6D", b) # nam
        b= self.createDataBoxHdr(len(title), 1, 0, b)
        b= self.writeString(title, b)

        self.appendBlob(b)
        pass
        
    def addLongDesc(self,desc):
        print "addLongDesc (size= %d)" %(len(desc)) 
        b = []
        b= self.createBoxHdr(len(desc) + 8 + 16, "ldes", b) 
        b= self.createDataBoxHdr(len(desc), 1, 0, b)
        b= self.writeString(desc.replace('|', "\n"), b)

        self.appendBlob(b)

    def addShortDesc(self, desc):
        print "addShortDesc (size= %d): %s" %(len(desc), desc) 
        size = len(desc)
        if size > 255:
            size = 255
        b = []
        b= self.createBoxHdr(size + 8 + 16, "desc", b) 
        b= self.createDataBoxHdr(size, 1, 0, b)
        b= self.writeString(desc[0:size].replace('|', "\n"), b)

        self.appendBlob(b)

    def addTvNetwork(self, desc):
        print "addTvNetwork (size= %d): %s" %(len(desc), desc) 
        size = len(desc)
        if size > 255:
            size = 255
        b = []
        b= self.createBoxHdr(size + 8 + 16, "tvnn", b) 
        b= self.createDataBoxHdr(size, 1, 0, b)
        b= self.writeString(desc[0:size].replace('|', "\n"), b)

        self.appendBlob(b)
        

    def addImage(self, path):
        # add title box into the temp container
        b = []
        f_size = os.path.getsize(path)
        print "addImage size= ", f_size
        
        b= self.createBoxHdr(f_size + 8 + 16, "\x63\x6F\x76\x72", b) # nam
        b= self.createDataBoxHdr(f_size, 0x0e, 0, b)

        idx = 0
        ifd = open(path, "r")
        for i in range (f_size):
            c = ifd.read(1)
            b.append(ord(c))
#            if (idx % 100) == 0:
#                print idx
            idx += 1
        self.appendBlob(b)
        ifd.close()

    def appendMetadataToFile(self):
        # TODO: check the case of moov-size goes beyong 32bit space
        if self.mMoov64 == False:
            if (self.mMoovSize + len(self.mMetadata) ) > 0xffffffff:
                print "ERROR: moov box sizes becomes larger that 32bit"
                sys.exit(0)
        ofd = open (self.mFilename, "r+b")
        if not self.mMoov64:
            self.writeIntAtPos(self.mMoovSize+ len(self.mMetadata), 4, ofd, self.mMoovPos)
        else:
            print "Moov box header is 64 bit"
            self.writeIntAtPos(self.mMoovSize+ len(self.mMetadata), 8, ofd, self.mMoovPos +8)

        if not self.mUdta64:
            self.writeIntAtPos(self.mUdtaSize+ len(self.mMetadata), 4, ofd, self.mUdtaPos)
        else:
            print "Udta box header is 64 bit"
            self.writeIntAtPos(self.mUdtaSize+ len(self.mMetadata), 8, ofd, self.mUdtaPos +8)

        if not self.mMeta64:
            self.writeIntAtPos(self.mMetaSize+ len(self.mMetadata), 4, ofd, self.mMetaPos)
        else:
            print "Meta box header is 64 bit"
            self.writeIntAtPos(self.mMetaSize+ len(self.mMetadata), 8, ofd, self.mMetaPos +8)

        if not self.mIlst64:
            self.writeIntAtPos(self.mIlstSize+ len(self.mMetadata), 4, ofd, self.mIlstPos)
        else:
            print "Ilst box header is 64 bit"
            self.writeIntAtPos(self.mIlstSize+ len(self.mMetadata), 4, ofd, self.mIlstPos)

        ofd.seek(0, 2)
        for i in range (len(self.mMetadata)):
            ofd.write(chr( self.mMetadata[i]))
        
        ofd.close()
            
if __name__ == "__main__":
    meta = AssetMetadata(sys.argv[1])
    
    mp4 = Mp4FileModifyer (sys.argv[2])
    mp4.addTitle(meta.mTitle)
    mp4.addTvNetwork(meta.mChannel)
    mp4.addShortDesc(meta.mShort)
    mp4.addLongDesc(meta.mDesc)

    if meta.mImagePath != None:
        mp4.addImage(meta.mImagePath)

    mp4.appendMetadataToFile()
