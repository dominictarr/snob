
set -e
count=1

plan () {
  echo $count..$1
}

assert () {
  set +e
  "$@" &> assert.out
  ret=$?
  set -e

  if [ $ret -eq 0 ]; then
    echo ok $count "$@"
  else
    echo not ok $count "$@"
    cat assert.out
    echo TEST FAILED.
    exit 1
  fi
  let count=$count+1
}

# bash is easier if you don't try to be clever
# that is why I just copy and paste assert and change one thing.
assert_not () {
  set +e
  "$@" &> assert.out
  ret=$?
  set -e

  if [ $ret -ne 0 ]; then
    echo ok $count "$@"
  else
    echo not ok $count "$@"
    cat assert.out
    echo TEST FAILED.
    exit 1
  fi
  let count=$count+1
}
