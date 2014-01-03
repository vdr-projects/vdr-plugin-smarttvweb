/*
 * log.h: VDR on Smart TV plugin
 *
 * Copyright (C) 2012 - 2014 T. Lohmar
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


#ifndef LOG_H
#define LOG_H

#include <iostream>
#include <fstream>

using namespace std;

class Log
{
  public:
    Log();
    ~Log();
    static Log* getInstance();

    int init(char* fileName);
    int init(string fileName);
    string getTimeString();
    int shutdown();
    ofstream* log();

  private:
    static Log* instance;

    ofstream *mLogFile;
};

#endif
