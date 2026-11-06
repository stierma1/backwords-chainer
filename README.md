# backwords-chainer

A small Prolog-like logic programming engine written in JavaScript.

`backwords-chainer` implements a **first-order Horn-clause solver**: facts, rules, unification, backtracking search, recursive predicates, lists, numbers, strings, negation-as-failure, and all-solutions predicates. It is intended to feel familiar to Prolog users while remaining usable as an embeddable JavaScript library.

It is **not** a general-purpose first-order theorem prover. It supports the Horn-clause fragment of first-order logic, not arbitrary quantified formulas, full resolution, or non-Horn clauses.

## Status

Current highlights:

- SLD-style backward chaining with backtracking
- Depth-first search by default, with an explicit breadth-first mode
- Unification with a partial occurs check
- Facts, rules, recursion, conjunction, and disjunction in rule bodies
- Lists, numbers, strings, nested compound terms, and object atoms
- Negation-as-failure via `not(...)` and `\+`
- Cut (`!`) and if-then-else (`Cond -> Then ; Else`)
- `once(...)`, `call(...)`, `apply(...)`, and `functor(...)`
- `true/0`, `fail/0`, and zero-arity predicates
- Standard `is/2` arithmetic with infix expressions
- Infix comparisons (`=:=`, `=\=`, `=<`, `>=`, `<`, `>`)
- Infix unification and disequality (`=`, `\=`)
- Delayed disequality constraints via `dif/2`
- Configurable occurs checking and `unify_with_occurs_check/2`
- Exact integer and bignum arithmetic
- Line/block comments, quoted atoms, and string escape handling
- Basic user-defined infix operators via `op/3`
- Existential `^` qualification in `bagof/3` and `setof/3`
- Parse errors with line and column information
- Type checks: `var/1`, `nonvar/1`, `atom/1`, `number/1`, `compound/1`, and `ground/1`
- Term inspection: `arg/3`, `copy_term/2`, and `term_variables/2`
- Higher-order `call/N`
- All-solutions predicates: `findall/3`, `findall/4`, `bagof/3`, `setof/3`, and `forall/2`
- Aggregation: `aggregate/3` and `aggregate_all/3`
- Standard list library: `length/2`, `reverse/2`, `nth0/3`, `nth1/3`, `last/2`, `between/3`, `succ/2`, `sort/2`, `msort/2`, `keysort/2`, `sum_list/2`, `max_list/2`, `min_list/2`, `memberchk/2`, and `selectchk/3`
- Higher-order list predicates: `maplist/N`, `include/3`, `exclude/3`, and `foldl/N`
- Dynamic database predicates: `assert/1`, `asserta/1`, `assertz/1`, `retract/1`, `abolish/1`, and `clause/2`
- Built-in list/planning predicates via `loadDefaults()`
- Custom JavaScript system calls
- Rule serialization and retraction
- 259 tests covering unification, statements, the parser, search strategies, arithmetic, constraints, syntax, term inspection, higher-order predicates, and the standard list library

## Installation

```bash
npm install backwords-chainer
```

Or, when working from a checkout:

```js
const { BackwordsChainer } = require(".");
```

`BackwordsChainer` is the `RuntimeEngine` class exported by `index.js`. The package also exports lower-level unification utilities through `Unification`.

## Quick start

```js
const { BackwordsChainer } = require("backwords-chainer");

const rt = new BackwordsChainer();

rt.parseRules(`
  parent(james, jack).
  parent(jim, james).
  parent(susan, james).

  grandParent(X, Y) :- parent(X, Z), parent(Z, Y).
`);

for (const solution of rt.run("grandParent(X, Y)")) {
  console.log(solution.X.toString(), solution.Y.toString());
}
```

Output:

```text
jim jack
susan jack
```

Query results are objects whose keys are the uppercase variable names from the query. Values are term objects:

- `Atom` / `StringAtom` / `NumberAtom`: use `.toString()`, `.getValue()`, `.removeQuotes()`, or `.toNumber()`
- `List`: use `.toString()`
- `Predicate`: use `.toString()`

## Language overview

### Facts and rules

```prolog
parent(james, jack).
parent(jim, james).

grandParent(X, Y) :- parent(X, Z), parent(Z, Y).
```

Variables begin with an uppercase letter. Predicate and atom names begin with a lowercase letter.

### Conjunction and disjunction

```prolog
adult(X) :- person(X), >=(age(X), 18).
choice(X) :- =(X, red); =(X, blue).
```

### Lists

```prolog
append([], L, L).
append([X | Y], L, [X | Z]) :- append(Y, L, Z).
```

The engine represents lists in cons notation. For example:

```js
rt.run("=(X, [a,b,c])")
```

produces `X.toString() === "[a | [b | [c | []]]]"`.

### Arithmetic and comparison

Standard Prolog-style arithmetic is supported:

```prolog
sum(X) :- X is 1 + 2.
precedence(X) :- X is 1 + 2 * 3.
integerDivision(X) :- X is 7 // 2.
remainder(X) :- X is 7 mod 2.
power(X) :- X is 2 ** 10.
```

Infix arithmetic comparisons:

```prolog
1 + 2 =:= 3.
1 + 2 =\= 4.
2 =< 3.
3 >= 2.
1 < 2.
2 > 1.
```

Unification and disequality:

```prolog
X = a.
a \= b.
```

`\=` succeeds only when the terms are not unifiable. `dif/2` delays the disequality constraint until variables become bound:

```prolog
dif(X, a), X = b.
dif(X, a), X = a.
```

The older relational arithmetic forms remain available:

```prolog
sum(X) :- +(1, 2, X).
product(X) :- *(3, 4, X).
>(2, 1).
<=(2, 2).
```

### Negation

```prolog
notPrimary(X) :- color(X), not(primary(X)).
notBlue(X) :- color(X), \+ =(X, blue).
```

`not(...)` and `\+` are negation-as-failure, not logical negation.

### Cut and if-then-else

```prolog
first(X) :- member(X, [a,b,c]), !.

choice(X) :- (primary(X) -> =(X, primary) ; =(X, secondary)).
```

`!` commits to choices made since entering the current predicate. `(Cond -> Then ; Else)` commits to the first solution of `Cond` and then runs `Then`; it runs `Else` only when `Cond` fails. Cut pruning follows Prolog's depth-first control flow; breadth-first search does not currently implement cut pruning.


### Term inspection and aggregation

Type checks are available directly as predicates:

```prolog
var(X).
nonvar(a).
atom(a).
number(3).
compound(f(a)).
ground(f(a, b)).
```

Term inspection and copying:

```prolog
arg(1, f(a, b), X).
copy_term(f(X, X), Y).
term_variables(f(X, Y, X), Variables).
```

`call/N` appends extra arguments to a closure:

```prolog
call(add(1, 2), X).
call(add, 1, 2, X).
```

`findall/4` builds a difference list, and `aggregate/3` / `aggregate_all/3` support count, sum, average, min, max, bag, and set templates:

```prolog
findall(X, member(X, [a,b]), List, Tail).
aggregate_all(count, member(X, [a,b,c]), Count).
aggregate_all(sum(X), member(X, [1,2,3]), Total).
```

### Standard list library

Everyday list and numeric relations are built in:

```prolog
length([a,b,c], N).
reverse([a,b,c], R).
nth0(0, [a,b], X).
nth1(1, [a,b], X).
last([a,b,c], X).
between(2, 4, X).
succ(2, X).
sum_list([1,2,3], S).
max_list([3,1,2], M).
min_list([3,1,2], M).
```

Higher-order list predicates use the same closure syntax as `call/N`:

```prolog
maplist(double, [1,2,3], Ys).
maplist(add, [1,2], [10,20], Ys).
include(positive, [-1,0,1,2], Positives).
exclude(positive, [-1,0,1,2], NonPositives).
foldl(add, [1,2,3], 0, Total).
```

`memberchk/2` and `selectchk/3` return only the first matching solution. `sort/2` and `msort/2` operate on ordinary lists; `keysort/2` expects key-value pairs represented as two-element lists (`[Key, Value]`).

### Dynamic database

Run these as goals:

```prolog
assert(foo(a))
assertz(foo(b))
asserta(foo(z))

assert(rule(X) :- base(X))
retract(foo(a))
retract(rule(X) :- base(X))
abolish(foo/1)
```

`clause(Head, Body)` exposes stored facts and rules:

```js
rt.run("clause(foo(X), Body)");
```

Facts return `Body = true`; rules return their body term. `abolish(Name/Arity)` removes every clause for that predicate indicator.

### Strings, numbers, and object atoms

```prolog
=("stuff", X).
=(-01.99, X).
```

Object atoms bind JavaScript objects supplied through `setCurrentObjectBindings`:

```js
rt.setCurrentObjectBindings({ "0": { hello: "world" } });
rt.parseRules(`
  other({0}).
`);

const [solution] = [...rt.run("other(X)")];
console.log(solution.X.getValue().hello); // "world"
```

### Comments, quoted atoms, and operators

Line and block comments are supported:

```prolog
% a line comment
p(a). /* a block comment */
```

Quoted atoms may contain spaces and escaped quotes:

```prolog
'my predicate'(a).
value('hello world').
value('it''s').
```

Double-quoted strings support common escapes such as `\n`, `\t`, `\\`, and `\"`.

Basic user-defined infix operators can be declared with `op/3`:

```prolog
:- op(500, xfx, likes).
john likes mary.
friends(X, Y) :- X likes Y.
```

`^` marks variables as existentially quantified inside `bagof/3` and `setof/3`:

```prolog
bagof(Y, X^pair(X, Y), Bag).
setof(Y, X^pair(X, Y), Bag).
```

### Built-in list/planning defaults

Call:

```js
rt.loadDefaults();
```

to add predicates such as:

- `append/3`, `member/2`, `select/3`, `delete/3`, `permutation/2`
- `insert/3`, `count/2`
- `subset2/2`, `equivalent/2`
- `nextto/3`, `push/3`, `pop/3`, `peek/2`
- `max/2`, `max/3`, `min/2`, `min/3`, `inRange/3`, `inRangeInclusive/3`
- `planner/5`, `agent/4`, and related planning helpers

## All-solutions predicates

### `findall/3`

Collect every solution, including duplicates. `findall/3` succeeds with `[]` when the goal has no solutions.

```js
const values = [...rt.run("findall(X, member(X, [a,b,c]), Bag)")];
console.log(values[0].Bag.toString()); // [a | [b | [c | []]]]
```

### `bagof/3`

Collect all solutions, grouped by free variables in the goal. Fails when the goal has no solutions.

```js
rt.parseRules(`
  pair(a, 1).
  pair(b, 1).
  pair(c, 2).
`);

for (const solution of rt.run("bagof(Y, pair(X,Y), Bag)")) {
  console.log(solution.X.toString(), solution.Bag.toString());
}
```

### `setof/3`

Like `bagof/3`, but sorts and deduplicates each result bag.

```js
const values = [...rt.run("setof(X, member(X, [b,a,b]), Bag)")];
console.log(values[0].Bag.toString()); // [a | [b | []]]
```

### `forall/2`

Succeed only when every solution of the condition satisfies the action. If the condition has no solutions, `forall/2` succeeds vacuously.

```js
rt.parseRules(`
  allowed(a).
  allowed(b).
`);

rt.run("forall(member(X, [a,b]), allowed(X))"); // one solution
rt.run("forall(member(X, [a,b,c]), allowed(X))"); // no solutions
```

Meta-goals may be single predicates or parenthesized compound goals:

```prolog
findall(X, (member(X, [a,b]), member(X, [b,c])), Bag).
forall(member(X, [a,b]), (=(X,a); =(X,b))).
```

## Search strategies

Depth-first search is the default and preserves the original generator-based behavior.

```js
rt.run("goal(X)");                         // depth-first
rt.runDepthFirst("goal(X)");               // explicit depth-first
rt.run("goal(X)", { search: "bfs" });      // breadth-first
rt.run("goal(X)", { strategy: "breadth-first" });
rt.run("goal(X)", "bfs");
rt.runBreadthFirst("goal(X)");
rt.solve("goal(X)", { search: "bfs" });
```

BFS can be bounded:

```js
rt.runBreadthFirst("goal(X)", {
  maxDepth: 10,
  maxNodes: 1000
});
```

BFS is implemented as FIFO expansion over resolution states. All-solutions predicates use the active search strategy when collecting their internal goal solutions.

## Custom system calls

Pass a callback to the runtime constructor. It receives the predicate term and the current substitution set. Return a substitution set to succeed, `null` to fail, or a generator to yield multiple results.

```js
const { BackwordsChainer } = require("backwords-chainer");

const rt = new BackwordsChainer((argument, substitutionSet) => {
  if (argument.name === "now") {
    return substitutionSet;
  }
  return null;
});

rt.parseRules(`
  check(ok) :- systemCall(now).
`);
```

Generator example:

```js
const rt = new BackwordsChainer(function* (argument, substitutionSet) {
  if (argument.name === "many") {
    yield substitutionSet;
    yield substitutionSet;
  }
});
```

## Runtime API

### `new BackwordsChainer([systemCalls])`

Creates a runtime engine. `systemCalls` is an optional JavaScript callback or generator function.

### `parseRules(source)`

Parses a source string containing facts and rules. Returns the parsed clauses.

### `addRule(rule)`

Adds a parsed `HornClause` to the runtime database.

### `retractRule(rule)`

Removes one matching clause from the runtime database. The argument may be a parsed rule object; a rule with the same `raw` text can also be used.

### `run(goal, [options])`

Parses and runs a goal. Returns a generator of solution objects. Options:

- `search` or `strategy`: `"depth-first"` (default), `"breadth-first"`, `"bfs"`, or `"breadth"`
- `maxDepth`: BFS depth limit
- `maxNodes`: BFS expansion limit

### `solve(goal, [options])`

Alias for `run`.

### `runDepthFirst(goal, [options])`

Explicit depth-first search.

### `runBreadthFirst(goal, [options])`

Explicit breadth-first search.

### `loadDefaults()`

Loads the standard predicate library.

### `setCurrentObjectBindings(map)`

Supplies JavaScript objects for `{key}` object atoms.

### `getPredicatesByName(name)`

Materializes facts with the given predicate name, for example:

```js
rt.getPredicatesByName("parent");
```

### `toString()`

Serializes the current rule database.

## Lower-level API

`index.js` also exports `Unification`, including:

- `unify`
- `andUnify`
- `orUnify`
- `SubstitutionSet`
- `Atom`, `Variable`, `Predicate`, `List`, `NumberAtom`, `StringAtom`
- statement classes such as `AndStatements`, `OrStatements`, `UnionStatement`, `PredicateStatement`, `HornClause`, `FindAllStatement`, `BagOfStatement`, `SetOfStatement`, and `ForallStatement`

This is useful for embedding the resolution engine in another system or for direct unit testing.

## Current limitations

- Only Horn clauses are supported; this is not a full first-order theorem prover.
- Variables in rules are implicitly universally quantified; query variables are implicitly existential.
- `not(...)` is negation-as-failure, not logical negation.
- The occurs check is partial for some cyclic variable constructions; use `unify_with_occurs_check/2` for an explicit check.
- Cut pruning is implemented for depth-first execution; BFS does not yet apply cut pruning.
- `assert/1` and `retract/1` support facts and rules, but there is no `retractall/1`.
- `assert/1` does not currently accept zero-arity clauses because the parser cannot distinguish them from atoms in clause arguments.
- Integer and bignum arithmetic is exact in `is/2`; rational division currently produces decimal floating-point results rather than exact rationals.
- The occurs-check setting is process-global in the current implementation.
- User-defined operators currently support infix declarations (`xfx`, `xfy`, `yfx`); prefix/postfix forms and full operator precedence tables are still limited.
- `aggregate/3` and `aggregate_all/3` support `count`, `sum`, `avg`, `min`, `max`, `bag`, and `set` templates; the full Prolog aggregate library is not implemented.
- `keysort/2` accepts two-element list pairs rather than Prolog's `Key-Value` pair syntax.
- Modules, DCGs, exceptions, and I/O predicates are not implemented.
- DFS can loop on left-recursive programs; BFS can find shallow solutions but may consume large amounts of memory without visited-state deduplication.

## Roadmap

The goal is to become progressively closer to a practical Prolog implementation.

### Phase 1: Prolog control and database semantics (implemented)

| Feature | Benefit | Status |
| --- | --- | --- |
| Cut `!` | Prunes choice points, making deterministic predicates and committed-choice logic possible | Done for DFS |
| If-then-else `-> ;` | Expresses conditional logic without auxiliary predicates | Done |
| `\+` alias for negation | Standard Prolog syntax and compatibility | Done |
| `true/0` and `fail/0` | Removes special-case handling and enables zero-arity goals | Done |
| `assert/1`, `asserta/1`, `assertz/1`, `retract/1`, `abolish/1` | Enables stateful logic programs, dynamic knowledge bases, and meta-programming | Done |
| `clause/2` | Supports introspection and meta-interpreters | Done |

### Phase 2: Arithmetic, equality, and term semantics (implemented)

| Feature | Benefit | Status |
| --- | --- | --- |
| `is/2` and an expression parser | Familiar `X is 1 + 2 * 3` arithmetic | Done |
| `=:=`, `=\=`, `=<`, `>=`, `<`, `>` | Standard evaluated numeric comparisons | Done |
| `=/2` and `\=/2` | Standard unification and disequality syntax | Done |
| `dif/2` | Delayed, sound disequality constraints | Done |
| Configurable occurs check | Better compatibility and safer cyclic-term handling | Done |
| Rational/integer and bignum support | Accurate arithmetic beyond floating-point numbers | Integers/bignums done; exact rationals pending |

### Phase 3: Syntax and parser compatibility (implemented)

| Feature | Benefit | Status |
| --- | --- | --- |
| `%` line comments and `/* ... */` block comments | Makes programs readable and familiar | Done |
| Infix and user-defined operators | Reduces reliance on prefix forms such as `+(A,B,C)` | Infix done; prefix/postfix limited |
| Zero-arity predicates and facts | Enables `true`, `fail`, and natural Prolog programs | Done |
| Quoted atoms and escape handling | Better string/atom fidelity | Done |
| `^` existential qualification for `bagof`/`setof` | Full free-variable grouping semantics | Done |
| Better parse errors with locations | Faster debugging | Done |

### Phase 4: Term inspection and meta-predicates (implemented)

| Feature | Benefit | Status |
| --- | --- | --- |
| `var/1`, `nonvar/1`, `atom/1`, `number/1`, `compound/1`, `ground/1` | First-class type checks instead of `systemCall(isAtom(...))` | Done |
| `functor/3` and `arg/3` | Term decomposition and construction | Done |
| `copy_term/2` and `term_variables/2` | Safe meta-programming and term rewriting | Done |
| `call/N` | Higher-order logic and generic collection predicates | Done |
| `findall/4`, `aggregate/3`, `aggregate_all/3` | More collection and aggregation patterns | Done |

### Phase 5: Standard library (implemented)

| Feature | Benefit | Status |
| --- | --- | --- |
| `length/2`, `reverse/2`, `nth0/3`, `nth1/3`, `last/2` | Everyday list programming | Done |
| `between/3`, `succ/2` | Generator-style numeric relations | Done |
| `sort/2`, `msort/2`, `keysort/2` | Standard ordering and deduplication | Done |
| `sum_list/2`, `max_list/2`, `min_list/2` | Common aggregation | Done |
| `maplist/N`, `include/3`, `exclude/3`, `foldl/N` | Higher-order list processing | Done |
| `memberchk/2`, `selectchk/3` | Deterministic convenience predicates | Done |

### Phase 6: Larger-program features

| Feature | Benefit |
| --- | --- |
| Modules and `use_module/1` | Namespacing and reusable libraries |
| DCG support (`-->`, `phrase/2`) | Natural parsing and grammar definitions |
| Exceptions (`throw/1`, `catch/3`) | Robust error handling |
| Basic I/O (`write/1`, `nl/0`, `read/1`) | Interactive and scripting use cases |
| `format/2` | Prolog-compatible formatted output |

### Phase 7: Performance and search quality

| Feature | Benefit |
| --- | --- |
| First-argument indexing | Avoids scanning irrelevant clauses |
| Tail-call/last-call optimization | Supports long recursive loops without stack growth |
| BFS visited-state deduplication | Prevents repeated exploration of equivalent states |
| Cut-aware BFS semantics | Keeps pruning behavior consistent across search modes |
| Clause compilation/caching | Faster repeated predicate calls |
| Memory-bounded search and cancellation | More predictable behavior for large problems |

## Project layout

```text
index.js                     Package entry point
lib/unification/
  atom.js                    Atomic terms
  variable.js                Logic variables
  predicate.js               Compound terms/predicates
  list.js                    Cons-list terms
  number.js, string.js       Specialized atoms
  unification.js             Unification and substitution sets
  statements.js              Resolution statements and all-solutions predicates
  default-horn-clauses.js    Built-in list/planning clauses
  trs.js                     Substitution/term rewriting
  utils.js                   Runtime variable generation
lib/grammar/
  grammar.bison              Rule grammar source
  goal.bison                 Goal grammar source
  grammar.js, goal.js        Generated parsers
  if-then-else.js            Arrow-syntax rewrite helper
  phase2.js                  Infix arithmetic/equality rewrite helper
  comments.js                Comment stripping
  operators.js               User-defined operator directives and rewriting
  context.js                 Parser callbacks and rule database
  runtime-engine.js          Public runtime engine and search strategies
tests/unification/           Jest test suites
```

The generated parsers are produced with Jison 0.4.17. After changing a `.bison` grammar file:

```bash
npx -p jison@0.4.17 jison lib/grammar/goal.bison -o lib/grammar/goal.js
npx -p jison@0.4.17 jison lib/grammar/grammar.bison -o lib/grammar/grammar.js
```

## Testing

```bash
npm install
npm test
```

The suite currently contains 259 tests and exercises unification, statements, parsing, arithmetic, constraints, comments, quoted atoms, operators, type checks, term inspection, higher-order calls, aggregation, the standard list library, lists, negation, cut, if-then-else, dynamic database predicates, all-solutions predicates, DFS/BFS search, serialization, and error handling.

## Design notes

- Resolution is generator-based for depth-first search, which keeps backtracking lazy and preserves the original API.
- Breadth-first search uses an explicit FIFO queue of resolution states.
- Terms are represented as JavaScript classes rather than plain objects, making unification and serialization explicit.
- Every user-defined predicate invocation freshens its clause variables through `getRuntimeInstance()`.
- Cut is implemented with a per-predicate control context; predicate invocations do not leak cut state into their callers.
- If-then-else arrow syntax is rewritten to an internal `ifThenElse` statement before parsing.
- Infix arithmetic, comparisons, equality, and disequality are rewritten to internal prefix predicates before parsing.
- Comments are stripped with string awareness before rewriting and parsing.
- User-defined infix operators are registered from `:- op(...)` directives and rewritten before parsing.
- `dif/2` constraints are stored on substitution sets and checked whenever substitutions are combined.
- Dynamic database clauses are stored in the same clause database used by parsed rules.
- All-solutions predicates collect solutions through the active search strategy and construct proper list terms.

## Non-goals

This project is not intended to become a full first-order theorem prover with arbitrary formulas, general resolution, Skolemization, or model checking. The roadmap is aimed at practical Prolog-style Horn-clause programming.

## License

See [LICENSE](LICENSE).
