#!/bin/bash -e
pushd web
git fetch origin
git rebase origin/develop
popd
