#!/bin/bash -e

# Reset web and apply patch
rm -rf ./build
mkdir ./build
git reset web
git submodule update --init --recursive
pushd web
git reset --hard
git clean -fdxe node_modules
git -c "user.name=build.sh" -c "user.email=build.sh" am ../web.patch
ln -s ../build build
popd

# Build microbundle
yarn microbundle
cp ./dist/alpha.modern.* ./web/public/

# Build web
pushd web
yarn install --frozen-lockfile
cp -f sample.env .env
yarn build
popd
