# Snob

Snob is a Distributed Version Control System implemented is js. 
You can think of it as a Model layer for realtime collaborative applications,
or as a peer to peer database. 

Each node has a `Repo` object, and they replicate by sending change sets to each other.

Snob has the same architecture as `git`, but with plugable diff-tools. That means,
it can support any kind of objects, if you can `diff`, `diff3`, and `patch` them.

by default, snob uses [xdiff](https://github.com/dominictarr/xdiff)

## Self Hosting!

snob became self hosting. 

```
4f63d2637ae35e9313fd4f23ea6cf4e8e527ba3c null Sun, 18 Mar 2012 08:20:34 GMT
```

## Example

// create two Repos and pipe them together.

```
var Repo = require('snob')
var A = new Repo()
var B = new Repo()
var as

// pipe in a circle, like this.

(as = A.createStream())
  .pipe(B.createStream())
  .pipe(as)

// of course, the streams can also be stringified and
// passed over a text stream. )

A.commit({hello: ['whatever']})

console.log(A.checkout())
console.log(B.checkout())

```

### API

just like git. read the source.

