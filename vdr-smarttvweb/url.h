/*
 * url.h: VDR on Smart TV plugin
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


#ifndef __URL_H__
#define __URL_H__

#include <string>

using namespace std;

class cUrlEncode {

 public:
  cUrlEncode() {};
  cUrlEncode(string &) {};

  static string doUrlSaveEncode (string);
  static string doUrlSaveDecode (string);

  static string doXmlSaveEncode (string);
  static string removeEtChar(string line, bool xml=true);
  static string hexDump(char *line, int line_len);
  static string hexDump(string);

 private:

};

#endif
