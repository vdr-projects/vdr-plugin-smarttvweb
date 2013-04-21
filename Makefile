#
# Makefile for a Video Disk Recorder plugin
#
#
# The official name of this plugin.
# This name will be used in the '-P...' option of VDR to load the plugin.
# By default the main source file also carries this name.
#
PLUGIN = smarttvweb

### The version number of this plugin (taken from the main source file):

VERSION = $(shell grep 'static const char \*VERSION *=' $(PLUGIN).c | awk '{ print $$6 }' | sed -e 's/[";]//g')

### The C++ compiler and options:


CXX      ?= g++
#ifdef DEBUG
CXXFLAGS ?= -g -O0 -fPIC -Wall -Woverloaded-virtual #-Werror
#else
#CXXFLAGS ?= -fPIC -Wall -Woverloaded-virtual #-Werror
#CXXFLAGS ?= -O2 -fPIC -Wall -Woverloaded-virtual #-Werror
#endif

### The directory environment:

VDRDIR = ../../..
LIBDIR = ../../lib
TMPDIR = /tmp

### Allow user defined options to overwrite defaults:

#-include $(VDRDIR)/Make.config

### read standlone settings if there
-include .standalone

### The version number of VDR (taken from VDR's "config.h"):

VDRVERSION = $(shell grep 'define VDRVERSION ' $(VDRDIR)/config.h | awk '{ print $$3 }' | sed -e 's/"//g')
APIVERSION = $(shell sed -ne '/define APIVERSION/s/^.*"\(.*\)".*$$/\1/p' $(VDRDIR)/config.h)

### The name of the distribution archive:

ARCHIVE = $(PLUGIN)-$(VERSION)
PACKAGE = vdr-$(ARCHIVE)

### Includes and Defines (add further entries here):

INCLUDES += -I$(VDRDIR)/include -I$(DVBDIR)/include

DEFINES += -D_GNU_SOURCE -DPLUGIN_NAME_I18N='"$(PLUGIN)"' 
DEFINES += -D_FILE_OFFSET_BITS=64 -D_LARGEFILE_SOURCE -D_LARGEFILE64_SOURCE

### The object files (add further files here):

OBJS = $(PLUGIN).o smarttvfactory.o httpresource.o httpclient.o mngurls.o log.o url.o stvw_cfg.o responsebase.o responsefile.o responsevdrdir.o responsememblk.o

OBJS2 = 

### Implicit rules:

%.o: %.c
	$(CXX) $(CXXFLAGS) -c $(DEFINES) $(INCLUDES) -o $@ $<

# Dependencies:

MAKEDEP = g++ -MM -MG
DEPFILE = .dependencies
$(DEPFILE): Makefile
	@$(MAKEDEP) $(DEFINES) $(INCLUDES) $(OBJS:%.o=%.c) > $@

-include $(DEPFILE)

### Targets:

all: allbase libvdr-$(PLUGIN).so
standalone: standalonebase smarttvweb-standalone

objectsstandalone: $(OBJS)
objects: $(OBJS) $(OBJS2)

allbase:
	( if [ -f .standalone ] ; then ( rm -f .standalone; make clean ; make objects ) ; else exit 0 ;fi )
standalonebase:
	( if [ ! -f .standalone ] ; then ( make clean; echo "DEFINES+=-DSTANDALONE" > .standalone; echo "DEFINES+=-D_FILE_OFFSET_BITS=64" >> .standalone; make objectsstandalone ) ; else exit 0 ;fi )

libvdr-$(PLUGIN).so: objects
	$(CXX) $(CXXFLAGS) -shared $(OBJS) $(OBJS2) -o $@
	@cp $@ $(LIBDIR)/$@.$(APIVERSION)

smarttvweb-standalone: objectsstandalone
	$(CXX) $(CXXFLAGS) $(OBJS) -lpthread -o $@
	chmod u+x $@

dist: clean
	@-rm -rf $(TMPDIR)/$(ARCHIVE)
	@mkdir $(TMPDIR)/$(ARCHIVE)
	@cp -a * $(TMPDIR)/$(ARCHIVE)
	@tar czf $(PACKAGE).tgz -C $(TMPDIR) $(ARCHIVE)
	@-rm -rf $(TMPDIR)/$(ARCHIVE)
	@echo Distribution package created as $(PACKAGE).tgz

clean:
	rm -f $(OBJS) $(OBJS2) $(DEPFILE) libvdr*.so.* *.tgz core* *~ .standalone smarttvweb-standalone

