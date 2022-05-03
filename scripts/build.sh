#!/bin/bash -e

# Build microbundle
yarn microbundle
cp ./dist/alpha.modern.* ./web/public/

# Build web
pushd web
yarn install --frozen-lockfile
cp -f sample.env .env
yarn build
popd
