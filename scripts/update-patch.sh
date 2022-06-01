#!/bin/bash -e
rm -f 1
pushd web
if ! git log --format=%B -n 1 | head -n 1 | grep -Eq '^ALPHA PATCH, DO NOT MERGE$'; then
  echo "error: HEAD of submodule must be titled 'ALPHA PATCH, DO NOT MERGE'" 1>&2
  exit 1
fi
git format-patch --numbered-files -o .. HEAD~1
git checkout -q HEAD~1
popd
tail -n +2 ./1 > ./web.patch
rm ./1
git add web web.patch
