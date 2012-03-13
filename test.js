var d = require('./')

if(!module.parent) {

  var assert = require('assert')
  function split(a) {
    if('string' === typeof a)
      return a.split('')
    return a
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

  function test3way(args, expected) {
  args = args.map(split)

  //    var args = [].slice.call(arguments).map(split) 
    console.log('***********')
    console.log('TEST', args)
    console.log('***********')
    var r = d.merge.apply(null, args)
    assert.deepEqual(r, split(expected))

  }

  // [this, concestor, other], expected
  test3way(['abaaaa','aaaaa', 'aacaa'], 'abacaa')  // simple change
  test3way(['abaaa','aaaa', 'aacca'], 'abacca') // simple change
  test3way(['abaaa','aaaaa', 'abaaa'], 'abaaa') // same change aka 'false conflict'
  test3way(['aaaaa','aaccaaa', 'aaccaaba'], 'aaaaba') // simple delete
  // since b is deleted.
  test3way(['abaaa','abaaa', 'aacaa'], 'aacaa')
  // delete from middle and add to end.
  test3way(['aaa','axaa', 'axaab'], 'aaab') 
  test3way(['abaaba','aaaaa', 'aaacca'],
      ['a', 'b', 'a', 'a', {'?': [['b'], ['c','c']]}, 'a'])
}
