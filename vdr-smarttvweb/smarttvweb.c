/*
 * smarttvweb.c: VDR on Smart TV plugin
 *
 * Copyright (C) 2012 Thorsten Lohmar
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


#ifndef STANDALONE
#include <vdr/plugin.h>
#endif

#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <sys/socket.h>
#include <netdb.h>
#include <sys/stat.h>
#include <sys/select.h>
#include <errno.h>

#include <dirent.h>

#include "smarttvfactory.h"


static const char *VERSION        = "0.9.0";
static const char *DESCRIPTION    = "SmartTV Web Server";


using namespace std;

#ifndef STANDALONE
class cPluginSmartTvWeb : public cPlugin
{
public:
  cPluginSmartTvWeb(void);
  virtual ~cPluginSmartTvWeb();
  virtual const char *Version(void) { return VERSION; }
  virtual const char *Description(void) { return DESCRIPTION; }
  virtual const char *CommandLineHelp(void);
  virtual bool ProcessArgs(int argc, char *argv[]);
  virtual bool Initialize(void);
  virtual bool Start(void);
  virtual bool SetupParse(const char *Name, const char *Value);
#if VDRVERSNUM > 10300
  virtual cString Active(void);
#endif

private:
  SmartTvServer mServer;
  string mConfigDir;
};

cPluginSmartTvWeb::cPluginSmartTvWeb(void)  {
  // Initialize any member variables here.
  // DON'T DO ANYTHING ELSE THAT MAY HAVE SIDE EFFECTS, REQUIRE GLOBAL
  // VDR OBJECTS TO EXIST OR PRODUCE ANY OUTPUT!
  mConfigDir = "";
}

bool cPluginSmartTvWeb::Start(void) {
  // Start any background activities the plugin shall perform.
  
  if (mConfigDir.compare("") == 0) {
    const char* dir_name = cPlugin::ConfigDirectory(Name());
    if (!dir_name)  {
      dsyslog("SmartTvWeb: Could not get config dir from VDR");      
    }
    else
      mConfigDir = string(dir_name);
  }

  mServer.initServer(mConfigDir);
  int success = mServer.runAsThread();

  esyslog("SmartTvWeb: started %s", (success == 1) ? "sucessfully" : "failed!!!!");

  return ((success == 1) ? true: false);
}

cPluginSmartTvWeb::~cPluginSmartTvWeb() {
  // Clean up after yourself!
  mServer.cleanUp();
}

const char *cPluginSmartTvWeb::CommandLineHelp(void)
{
  // Return a string that describes all known command line options.
  return " \n";
}

bool cPluginSmartTvWeb::ProcessArgs(int argc, char *argv[]) {
  // Implement command line argument processing here if applicable.
  return true;
}

bool cPluginSmartTvWeb::Initialize(void) {
  // Initialize any background activities the plugin shall perform.
  esyslog("SmartTvWeb: Initialize called");

  return true;
}

bool cPluginSmartTvWeb::SetupParse(const char *Name, const char *Value)
{
  // Parse your own setup parameters and store their values.
  return false;
}

#if VDRVERSNUM > 10300

cString cPluginSmartTvWeb::Active(void) {
  esyslog("SmartTvWeb: Active called Checkme");
  if (mServer.isServing())
    return tr("SmartTV client(s) serving");
  else
    return NULL;
}

#endif

VDRPLUGINCREATOR(cPluginSmartTvWeb); // Don't touch this!

#else //VOMPSTANDALONE


int main(int argc, char *argv[]) {
  printf ("Starting up\n");

  SmartTvServer server;
  server.initServer(".");
  server.loop();
}
#endif
