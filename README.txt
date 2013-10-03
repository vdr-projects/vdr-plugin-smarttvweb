This VDR Project contains a server plugin and a Smart TV Widget.

History:

Widget Version 0.9.5:
* new widget.conf element playKeyBehavior, which is of Type Integer. 0: key value * 100 is target percentage, 1: key value is skip duration 
* new Server Select Menu item, which allows the re-selection of the VDR server (note, the widget.conf is always )
* timezone correction
* Rendering of an image for a recording, if the recording folder contains a preview_vdr.png file.
* Toggle 3D viewing options (Side-by-Side and Top-to-Bottom)
* Timer menu entry, which gives an overview of the timers and allows deletion of timers.
* widget.conf configurable InfoOverlay timeout (new widget.conf entry <infoTimeout>)
* YouTube entry becomes optional. Add <youtubemenu>true</youtubemenu>  to your widget.conf
* Image Viewer in Media Folder.
* Improved server error feedback through widget GUI
* Widget configurable Info Overlay timeout (<infoTimeout> element value). 

* Allow Verbose start for debugging.
* Scrolling debug popup
* Timer activation and deactivation
* Key Binding helpoverlay using tools key
* Code Improvements
* Fixes in timer update handling (HTTP interactions)


Plugin Version 0.9.9:
* Provide server timestamp (To allow timezone check)
* Provide server name to increase readability during server select
* Provide time-sorted list of timers (/timers.xml)
* Fixed deleteTimer function
* Add function to activate and deactivate a timer.
* Allow creation of partially overlapping timers.
* First Version of Commands and Recording Commands (RecCmds) handling.
* New API /deleteFile, which allows the deletion of a file from the media folder.


Folders:
vdr-smarttvweb: Contains the vdr server plugin, incl. the web front end
smarttv-client: Contains the source code of the Smart TV widget
release: Contains Smart TV Widget files ready for deplyoment.

Check http://projects.vdr-developer.org/projects/plg-smarttvweb/wiki for a description, installation instructions and configuration instructions.

