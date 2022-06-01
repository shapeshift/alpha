#!/bin/bash -e

# Reset web and apply patch
rm -rf ./build
mkdir ./build
git reset web
git submodule update --init --recursive
pushd web
git am --abort 2>/dev/null || true
git rebase --abort 2>/dev/null || true
git reset --hard
git clean -fdxe node_modules
git config --local core.excludesFile ../web.exclude
git -c "user.name=build.sh" -c "user.email=build.sh" am ../web.patch
ln -s ../build build
popd
