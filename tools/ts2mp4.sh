#!/bin/bash


# Adjustments for your system
out_folder=/hd2/mpeg
app_metadata=/multimedia/Ordner-Thorsten/vdr/vdr-2.0.2/PLUGINS/src/smarttvweb/tools/append_metadata.py

#####


if [ ! -f "$app_metadata" ]
then
    echo "python script append_metadata.py not found. Please check the app_metadata variable!"
    exit 0
fi 

name=$1

outdir=${out_folder%/}   # no trailing slash

#removing possible trailing slash
name=${name%/}

if [[ "$name" == *\/* ]] ; then 
    echo "Only relative path allowed (i.e. no absolute path or sub-folders)"; 
    exit 0
fi

echo "Name: "$name
if [ ! -d "$name" ]; then
        echo $name "is not a directory ---> EXIT"
        exit 0
fi

subdir=$name/`ls $name`
if [ ! -d "$subdir" ]; then
        echo " only single subdirs allowed ---> exit"
        exit 0
fi

mpg_f=$outdir/${name#%}".mp4"   #target MP4 URI (path + name)
if [ -f $mpg_f ]
then
    echo "Target File: "$mpg_f
    echo "Target MP4 File already exists ---> EXIT"
    exit 0
fi

cd $subdir

avconv_cli="-i concat:"

for i in `ls 000??.ts`; do
    echo $i
    avconv_cli=$avconv_cli$i"|"
done
avconv_cli=${avconv_cli%"|"}

avconv_cli=$avconv_cli" -map 0 -c copy "$mpg_f
#avconv_cli=$avconv_cli" -map 0 -codec:v libx264 -profile:v high -b:v 1000k -maxrate 1200k -bufsize 1200k -vf scale=-1:480 -threads 0 -codec:a libvo_aacenc -b:a 128k "$mpg_f

echo "avconv command line: "$avconv_cli
echo "------------------------------------------------------"
avconv $avconv_cli
echo "------------------------------------------------------"
echo "avconv command line: "$avconv_cli

#/multimedia/tools/append_metadata.py ./ $mpg_f
$app_metadata ./ $mpg_f
