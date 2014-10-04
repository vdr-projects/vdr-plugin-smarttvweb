/*
 * url.c: VDR on Smart TV plugin
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

#include <cstdio>
#include"url.h"


//http://www.blooberry.com/indexdot/html/topics/urlencoding.htm
string cUrlEncode::doUrlSaveEncode(string in) {
  string res = "";
  unsigned char num = 0;
  char buf[5];
  
  bool done = false;
  unsigned int idx = 0;
  while (!done) {
    if (idx == in.size()) {
      done = true;
      continue;
    }
    num = in[idx];
    switch (num) {
    case '"':
      res += "%22";
      break;
    case '&':
      res += "%26";
      break;
    case '?':
      res+= "%3f";
      break;
    case '%':
      res += "%25";
      break;
    case '#':
      //      break;
      /*
      if (in.compare(idx, 3, "#3F") == 0) {
	res += "%3F";
	idx +=3;
	continue;
      }
      if (in.compare(idx, 3, "#3A") == 0) {
	res += "%3A";
	idx += 3;
	continue;
      }
      if (in.compare(idx, 3, "#2F") == 0) {
	res += "%2F";
	idx += 3;
	continue;
      }
*/
      res += "%23"; // just a '#' char
      break;
    default:
      // Copy the normal chars
      if (num < 128)
	res += char(num);
      else {
	sprintf (buf, "%02hhX", num);
	res += "%";
	res += buf;
      }
      break;
    } // switch

    idx ++;
  }
  return res;
}


string cUrlEncode::doUrlSaveDecode(string input) {
  string res = "";
  unsigned int idx = 0;
  int x;
  while (idx < input.size()){
    if (input[idx] == '%') {
      string num = input.substr(idx+1, 2);
      sscanf(num.c_str(), "%X", &x);
      idx+= 3;
      switch (x) {
      case 0x22: // '"'
	res += '"';
	break;
      case 0x23: // '#'
	res += "#";
	break;
      case 0x25: // '%'
	res += "%";
	break;
      case 0x26: // '&'
	res += "&";
	break;
      case 0x2f: // '/'
	res += "#2F";
	break;
      case 0x3a: // ':'
	res += "#3A";
	break;
      case 0x3f: // '?'
	res += "?";
	break;
      default:
	res += char(x);
	break;
      }
    }
    else {
      res += input[idx];
      idx ++;
    }
  }
  return res;
}

string cUrlEncode::doXmlSaveEncode(string in) {
  string res = "";
  unsigned char num = 0;
  //  char buf[5];
  
  bool done = false;
  unsigned int idx = 0;
  while (!done) {
    if (idx == in.size()) {
      done = true;
      continue;
    }
    num = in[idx];
    switch (num) {
    case 0x26: // '&':
      res += "&amp;";
      break;
    case 0x27: // '\'':
      res += "&apos;";
      break;
    case 0x3c: // '<':
      res += "&lt;";
      break;
    case 0x3e: // '>':
      res += "&gt;";
      break;
    case 0x22: // '\"':
      res += "&quot;";
      break;

      /*    case 0xc4: // Ä
      res += "&#196;";
      break;
    case 0xe4: //'ä':
      res += "&#228;";
      break;
    case 0xd6: // Ö
      res += "&#214;";
      break;
    case 0xf6: // 'ö':
      res += "&#246;";
      break;
    case 0xdc: //'Ü':
      res += "&#220;";
      break;
    case 0xfc: //'ü':
      res += "&#252;";
      break;
    case 0xdf: //'ß':
      res += "&#223;";
      break;
*/
    default:
      // Copy the normal chars
      res += char(num);
      break;
    } // switch

    idx ++;
  }
  return res;
}

string cUrlEncode::doXmlSaveDecode(string input) {
  string res = "";
  unsigned int idx = 0;
  while (idx < input.size()){
    if (input[idx] == '&') {
      if (input.compare(idx, 4, "&lt;") == 0){
	res += "<";
	idx += 4;
      }
      else if (input.compare(idx, 4, "&gt;") == 0){
	res += ">";
	idx += 4;
      }
      else if (input.compare(idx, 5, "&amp;") == 0){
	res += "&";
	idx += 5;
      }
      else if (input.compare(idx, 6, "&quot;") == 0){
	res += "\"";
	idx += 6;
      }
      else if (input.compare(idx, 6, "&apos;") == 0){
	res += "\'";
	idx += 6;
      }
      else {
	// ERROR
	idx = input.size();
	res = "";
      }
    }
    else {
      res += input[idx];
      idx ++;
    }

  }
  return res;
}

string cUrlEncode::removeEtChar(string line, bool xml) {
  bool done = false;
  size_t cur_pos = 0;
  size_t pos = 0;
  string res = "";

  int end_after_done = 0;
  
  while (!done) {
    pos = line.find('&', cur_pos);
    if (pos == string::npos) {
      done = true;
      res += line.substr(cur_pos);
      break;
    }
    if (pos >= 0) {
      if (xml)
	res += line.substr(cur_pos, (pos-cur_pos)) + "&#38;";  // xml save encoding
      else
	res += line.substr(cur_pos, (pos-cur_pos)) + "%26";  // url save encoding
      //      cur_pos = cur_pos+ pos +1;
      cur_pos = pos +1;
      end_after_done ++;
    }
  }
  return res;
}

string cUrlEncode::hexDump(char *line, int line_len) {
  string res = "";
  string ascii = "";
  char buf[10];

  int line_count = 0;
  for (unsigned int i = 0; i < line_len; i++) {
    unsigned char num = line[i];
    sprintf (buf, "%02hhX", num);
    res += buf;
    if ((num >= 32) && (num < 127)) {
      ascii += char(num);
    }
    else
      ascii += '.';
    
    line_count++;
    switch (line_count) {
    case 8:
      res += "  ";
      ascii += " ";
      break;
    case 17:
      res += "  " + ascii;
      res += "\r\n";
      ascii = "";
      line_count = 0;
      break;
    default:
      res += " ";
      break;
    }
  }
  if (line_count != 0) {
    for (int i = 0; i < ((17 - line_count) * 3 ); i++)
      res += " ";
    if (line_count >= 8)
             res += " ";
    
    res += "  ";
    res += ascii;
  }
  return res;
}

string cUrlEncode::hexDump(string in) {
  string res = "";
  string ascii = "";
  char buf[10];

  int line_count = 0;
  for (unsigned int i = 0; i < in.size(); i++) {
    unsigned char num = in[i];
    sprintf (buf, "%02hhX", num);
    res += buf;
    if ((num >= 32) && (num < 127)) {
      ascii += char(num);
    }
    else
      ascii += '.';
    
    line_count++;
    switch (line_count) {
    case 8:
      res += "  ";
      ascii += " ";
      break;
    case 16:
      res += "  " + ascii;
      res += "\r\n";
      ascii = "";
      line_count = 0;
      break;
    default:
      res += " ";
      break;
    }
  }
  if (line_count != 0) {
    for (int i = 0; i < ((16 - line_count) * 3 ); i++)
      res += " ";
    if (line_count >= 8)
             res += " ";
    res += ascii;
  }
  return res;
}
