#! /usr/bin/env bash

cd ${0%/*}
SNOB=`dirname $PWD`/cli.js

. ./assert.sh

# i'm gonna use this function, 
# so that the rest of this test works like 
# you've gone `npm install snob -g`

function snob () {
  echo '> snob' "$@"
  $SNOB "$@"
}

#make a clean dir for testing in.
rm -rf /tmp/snobtest
mkdir /tmp/snobtest
cd /tmp/snobtest

plan 8

snob init

# check that the init created the right files
assert test -e .snob
assert test -e .snob/state
assert test -e .snob/commits

# create a file and save it in the repo.

echo 'hello snob!' > hi
snob commit hi -m initial

snob log

# we haven't changed anything, so commiting again should error.
assert_not snob commit hi -m initial

#lets create a branch.
snob branch branchy
#list branches
snob branch

# this could fail if something is wrong, so I'm gonna assert
assert snob checkout branchy

echo 'snob is not the only javascript DVCS' >> hi
snob commit hi -m 'teaser'
echo 'there is another: synchnotron' >> hi
snob commit hi -m 'relief'

# there are now 3 lines in `hi`
assert test `wc -l < hi` -eq 3

#go back to master
snob checkout master

#now, in master hi should have only 1 line.

assert test `wc -l < hi` -eq 1

#now, prepend something to make a merge a little interesting.

echo '<......drumroll!!!!!>' | cat - hi > hi2
mv hi2 hi

snob commit hi

#okay! now, master and branchy have diverged!
#lets merge them!

snob merge branchy

cat hi
#by coincidence, the other javascript dvcs is also by a New Zealander.

#now we've got 4 lines after a successful merge!
assert test `wc -l < hi` -eq 4

