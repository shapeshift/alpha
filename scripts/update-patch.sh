#!/bin/bash -e
rm -f 1
pushd web
git format-patch --numbered-files -o .. HEAD~1
mv ../1 ../web.patch
git checkout HEAD~1
popd
git add web web.patch
