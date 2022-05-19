#!/bin/bash -e

# Build microbundle
yarn microbundle
yarn prettier -w ./dist/alpha.modern.js
cp ./dist/alpha.modern.* ./web/public/

# Build web
pushd web
yarn install --frozen-lockfile
cp -f sample.env .env
yarn build
popd
