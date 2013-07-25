/*
 * log.c: VDR on Smart TV plugin
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


#include "log.h"
#include <time.h>
#include <cstring>

Log* Log::instance = NULL;

Log::Log() {
  if (instance) 
    return;
  instance = this;
  mLogFile = NULL;
}

Log::~Log() {
  instance = NULL;
}

Log* Log::getInstance() {
  return instance;
}
int Log::init(string fileName) {
  char timebuf[128];
  time_t now  = time(NULL);
  strftime(timebuf, sizeof(timebuf), "%a, %d %b %Y %H:%M:%S GMT", localtime(&now));

  if (fileName != "") {
    mLogFile = new ofstream();

    mLogFile->open(fileName.c_str(), ios::out );
    *mLogFile << "Log Created: " << timebuf << endl;
  }
  else
    mLogFile = new ofstream("/dev/null");
  return 0;
}

int Log::init(char* fileName) {

  char timebuf[128];
  time_t now  = time(NULL);
  strftime(timebuf, sizeof(timebuf), "%a, %d %b %Y %H:%M:%S GMT", gmtime(&now));

  if (strcmp(fileName, "") !=0) {
    mLogFile = new ofstream();
    mLogFile->open(fileName, ios::out );
    *mLogFile << "Log Created: " << timebuf << endl;
  }
  else
    mLogFile = new ofstream("/dev/null");
  return 0;
}

int Log::shutdown() {
  if (mLogFile) 
    mLogFile->close();
  return 1;
}

ofstream* Log::log() {
  return mLogFile;
}

