var d = require('./')

if(!module.parent) {

  var assert = require('assert')
  function split(a) {
    if('string' === typeof a)
      return a.split('')
  }

  function test (a, b, lcs) {
    a = split(a)
    b = split(b)
    lcs = split(lcs)
    var _lcs = d.lcs(a, b)
    console.log(a.join(''),b.join(''),_lcs.join(''))
    assert.deepEqual(_lcs, lcs)
    var changes = d.diff(a,b)
    console.log('changes>', changes)
    var newA = d.patch(a, changes)
    assert.deepEqual(newA, b)
  }

  test('AA', 'AA', 'AA')

  test('AB', 'BA', 'A')
  test('ABA', 'BAA', 'AA')
  test('TANYANA', 'BANANA', 'ANANA')
  // the naive model takes 2.5 seconds to find this:
  // time to optimise...
  test('aoenuthooao', 'eukmcybkraoaeuo', 'aoeuo')
  test('aoenuthooaeuoao', 'eukipoimcybkraoaeuo', 'euooaeuo')
  // added caching... now it's way faster.

}
