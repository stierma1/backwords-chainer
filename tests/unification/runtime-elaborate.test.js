var {
  Atom,
  Predicate,
  Variable,
  Unification
} = require("../../lib/unification");

var RuntimeEngine = require("../../lib/grammar/runtime-engine");

var TEST_TIMEOUT = 10000;

function test10(name, fn){
  test(name, fn, TEST_TIMEOUT);
}

function collect(gen, limit){
  var values = [];
  for(var value of gen){
    if(value !== null && value !== undefined){
      values.push(value);
    }
    if(limit && values.length >= limit){
      break;
    }
  }
  return values;
}

function valuesOf(result, name){
  return result.map((substitution) => substitution[name].toString());
}

test10("runtime answers an exact fact", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    parent(james, jack).
    parent(jim, james).
  `);

  expect(collect(rt.run("parent(jim, james)")).length).toBe(1);
  expect(collect(rt.run("parent(jim, jack)")).length).toBe(0);
});

test10("depth-first search remains the default search order", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    result(a) :- deep(a).
    result(b).
    deep(a) :- d1(a).
    d1(a) :- d2(a).
    d2(a).
  `);

  expect(valuesOf(collect(rt.run("result(X)")), "X")).toEqual(["a", "b"]);
});

test10("breadth-first search finds shallow solutions before deep ones", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    result(a) :- deep(a).
    result(b).
    deep(a) :- d1(a).
    d1(a) :- d2(a).
    d2(a).
  `);

  expect(valuesOf(collect(rt.run("result(X)", {search:"bfs"})), "X")).toEqual(["b", "a"]);
});

test10("breadth-first search can be selected by method or alias", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    result(a) :- deep(a).
    result(b).
    deep(a) :- d1(a).
    d1(a) :- d2(a).
    d2(a).
  `);

  expect(valuesOf(collect(rt.runBreadthFirst("result(X)")), "X")).toEqual(["b", "a"]);
  expect(valuesOf(collect(rt.solve("result(X)", {strategy:"breadth-first"})), "X")).toEqual(["b", "a"]);
  expect(valuesOf(collect(rt.run("result(X)", "bfs")), "X")).toEqual(["b", "a"]);
});

test10("breadth-first search escapes left recursion", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    path(X, Y) :- path(X, Z), edge(Z, Y).
    path(X, Y) :- edge(X, Y).
    edge(a, b).
    edge(b, c).
  `);

  var values = collect(rt.run("path(a,b)", {search:"bfs"}), 1);
  expect(values.length).toBe(1);
});

test10("breadth-first search honors maxDepth and maxNodes", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    result(a) :- deep(a).
    result(b).
    deep(a) :- d1(a).
    d1(a) :- d2(a).
    d2(a).
  `);

  expect(collect(rt.run("result(X)", {search:"bfs", maxDepth:1})).length).toBe(0);
  expect(valuesOf(collect(rt.run("result(X)", {search:"bfs", maxDepth:2})), "X")).toEqual(["b"]);
  expect(collect(rt.run("result(X)", {search:"bfs", maxNodes:1})).length).toBe(0);
});

test10("breadth-first search works with conjunctions, negation and defaults", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    color(red).
    color(blue).
    primary(red).
    secondary(X) :- color(X), not(primary(X)).
    calc(X) :- +(1, 2, X), >(X, 2).
  `);

  expect(valuesOf(collect(rt.run("secondary(X)", {search:"bfs"})), "X")).toEqual(["blue"]);
  expect(valuesOf(collect(rt.run("member(X, [a,b,c])", {search:"bfs"})), "X")).toEqual(["a", "b", "c"]);
  expect(valuesOf(collect(rt.run("call(member(X, [a,b]))", {search:"bfs"})), "X")).toEqual(["a", "b"]);
  expect(valuesOf(collect(rt.run("apply(member, [X, [a,b]])", {search:"bfs"})), "X")).toEqual(["a", "b"]);
  expect(collect(rt.run("calc(X)", {search:"bfs"}))[0].X.toNumber()).toBe(3);
});

test10("findall collects every solution in order", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("findall(X, member(X, [a,b,c]), Bag)"));
  expect(values.length).toBe(1);
  expect(values[0].Bag.toString()).toBe("[a | [b | [c | []]]]");
});

test10("findall preserves duplicates and supports compound templates", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var duplicateValues = collect(rt.run("findall(X, member(X, [a,a,b]), Bag)"));
  expect(duplicateValues[0].Bag.toString()).toBe("[a | [a | [b | []]]]");

  var compoundValues = collect(rt.run("findall(f(X), member(X, [a,b]), Bag)"));
  expect(compoundValues[0].Bag.toString()).toBe("[f(a) | [f(b) | []]]");
});

test10("findall returns an empty list when the goal has no solutions", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("findall(X, member(X, []), Bag)"));
  expect(values.length).toBe(1);
  expect(values[0].Bag.toString()).toBe("[]");
});

test10("findall can be used inside a rule body", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    collectItems(Bag) :- findall(X, member(X, [a,b]), Bag).
  `);

  var values = collect(rt.run("collectItems(Bag)"));
  expect(values.length).toBe(1);
  expect(values[0].Bag.toString()).toBe("[a | [b | []]]");
});

test10("all-solutions predicates accept compound meta-goals", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("findall(X, (member(X, [a,b]), member(X, [b,c])), Bag)"));
  expect(values.length).toBe(1);
  expect(values[0].Bag.toString()).toBe("[b | []]");

  var bagValues = collect(rt.run("bagof(X, (member(X, [b,a,b]), member(X, [b,a])), Bag)"));
  expect(bagValues.length).toBe(1);
  expect(bagValues[0].Bag.toString()).toBe("[b | [a | [b | []]]]");

  expect(collect(rt.run("forall(member(X, [a,b]), (=(X,a); =(X,b)))")).length).toBe(1);
});

test10("forall succeeds when every condition instance satisfies the action", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    allowed(a).
    allowed(b).
  `);

  expect(collect(rt.run("forall(member(X, [a,b]), allowed(X))")).length).toBe(1);
});

test10("forall fails when any condition instance violates the action", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    allowed(a).
    allowed(b).
  `);

  expect(collect(rt.run("forall(member(X, [a,b,c]), allowed(X))")).length).toBe(0);
});

test10("forall succeeds vacuously when the condition has no solutions", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    allowed(a).
  `);

  expect(collect(rt.run("forall(member(X, []), allowed(X))")).length).toBe(1);
});

test10("forall can be used inside a rule body", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    allowed(a).
    allowed(b).
    allAllowed(ok) :- forall(member(X, [a,b]), allowed(X)).
  `);

  expect(collect(rt.run("allAllowed(ok)")).length).toBe(1);
  expect(collect(rt.run("allAllowed(no)")).length).toBe(0);
});

test10("bagof collects all solutions but fails when none exist", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("bagof(X, member(X, [b,a,b]), Bag)"));
  expect(values.length).toBe(1);
  expect(values[0].Bag.toString()).toBe("[b | [a | [b | []]]]");
  expect(collect(rt.run("bagof(X, member(X, []), Bag)")).length).toBe(0);
});

test10("setof sorts and deduplicates collected solutions", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("setof(X, member(X, [b,a,b]), Bag)"));
  expect(values.length).toBe(1);
  expect(values[0].Bag.toString()).toBe("[a | [b | []]]");

  var numericValues = collect(rt.run("setof(X, member(X, [3,1,2,1]), Bag)"));
  expect(numericValues[0].Bag.toString()).toBe("[1 | [2 | [3 | []]]]");
});

test10("bagof groups solutions by free goal variables", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    pair(a, 1).
    pair(b, 1).
    pair(c, 2).
  `);

  var values = collect(rt.run("bagof(Y, pair(X,Y), Bag)"));
  expect(values.length).toBe(3);
  expect(values.map((value) => value.X.toString() + "/" + value.Bag.toString())).toEqual([
    "a/[1 | []]",
    "b/[1 | []]",
    "c/[2 | []]"
  ]);
});

test10("bagof does not group a free variable already bound outside the goal", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    pair(a, 1).
    pair(b, 1).
  `);

  var values = collect(rt.run("=(X, a), bagof(Y, pair(X,Y), Bag)"));
  expect(values.length).toBe(1);
  expect(values[0].X.toString()).toBe("a");
  expect(values[0].Bag.toString()).toBe("[1 | []]");
});

test10("setof groups free variables and sorts within each group", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    pair(a, 2).
    pair(a, 1).
    pair(b, 3).
  `);

  var values = collect(rt.run("setof(Y, pair(X,Y), Bag)"));
  expect(values.length).toBe(2);
  expect(values.map((value) => value.X.toString() + "/" + value.Bag.toString())).toEqual([
    "a/[1 | [2 | []]]",
    "b/[3 | []]"
  ]);
});

test10("all-solutions predicates work with breadth-first search", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("findall(X, member(X, [a,b]), Bag)", {search:"bfs"}));
  expect(values.length).toBe(1);
  expect(values[0].Bag.toString()).toBe("[a | [b | []]]");
});

test10("findall inherits the breadth-first solution order", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    result(a) :- deep(a).
    result(b).
    deep(a) :- d1(a).
    d1(a) :- d2(a).
    d2(a).
  `);

  expect(collect(rt.run("findall(X, result(X), Bag)"))[0].Bag.toString()).toBe("[a | [b | []]]");
  expect(collect(rt.run("findall(X, result(X), Bag)", {search:"bfs"}))[0].Bag.toString()).toBe("[b | [a | []]]");
});

test10("runtime binds variables from facts", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    parent(james, jack).
    parent(jim, james).
    parent(susan, james).
  `);

  var values = collect(rt.run("parent(X, james)"));
  expect(values.length).toBe(2);
  expect(values[0].X.toString()).toBe("jim");
  expect(values[1].X.toString()).toBe("susan");
});

test10("runtime computes a recursive transitive closure", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    parent(james, jack).
    parent(jim, james).
    parent(susan, james).

    ancestor(X, Y) :- parent(X, Y).
    ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).
  `);

  var values = collect(rt.run("ancestor(X, jack)"));
  expect(values.length).toBe(3);
  expect(values.map((value) => value.X.toString())).toEqual(["james", "jim", "susan"]);
});

test10("runtime enumerates every recursive solution", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    edge(a, b).
    edge(b, c).
    path(X, Y) :- edge(X, Y).
    path(X, Y) :- edge(X, Z), path(Z, Y).
  `);

  var values = collect(rt.run("path(X, Y)"));
  expect(values.length).toBe(3);
  expect(values.map((value) => value.X.toString() + "-" + value.Y.toString())).toEqual(["a-b", "b-c", "a-c"]);
});

test10("runtime supports disjunction in rule bodies", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    choice(X) :- =(X, red); =(X, blue).
  `);

  var values = collect(rt.run("choice(X)"));
  expect(values.length).toBe(2);
  expect(values[0].X.toString()).toBe("red");
  expect(values[1].X.toString()).toBe("blue");
});

test10("runtime negation as failure filters solutions", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    color(red).
    color(blue).
    primary(red).
    secondary(X) :- color(X), not(primary(X)).
  `);

  var values = collect(rt.run("secondary(X)"));
  expect(values.length).toBe(1);
  expect(values[0].X.toString()).toBe("blue");
});

test10("runtime once keeps only the first solution", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("once(member(1, [1,1,1]))"));
  expect(values.length).toBe(1);
});

test10("runtime separates predicates by arity", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    value(a).
    value(a, b).
  `);

  expect(collect(rt.run("value(a)")).length).toBe(1);
  expect(collect(rt.run("value(X)")).length).toBe(1);
  expect(collect(rt.run("value(a, b)")).length).toBe(1);
  expect(collect(rt.run("value(X, Y)")).length).toBe(1);
  expect(collect(rt.run("value(a, b, c)")).length).toBe(0);
});

test10("runtime treats strings and bare atoms as distinct terms", () => {
  var rt = new RuntimeEngine();

  var stringValues = collect(rt.run('=("stuff", X)'));
  expect(stringValues.length).toBe(1);
  expect(stringValues[0].X.removeQuotes()).toBe("stuff");

  expect(collect(rt.run('=("stuff", stuff)')).length).toBe(0);
  expect(collect(rt.run('=("stuff", "stuff")')).length).toBe(1);
});

test10("runtime normalizes and computes with numbers", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run("=(-01.99, -1.99)")).length).toBe(1);
  expect(collect(rt.run("+(1, 2, X)"))[0].X.toNumber()).toBe(3);
  expect(collect(rt.run("+(1, X, 5)"))[0].X.toNumber()).toBe(4);
  expect(collect(rt.run("*(3, 4, X)"))[0].X.toNumber()).toBe(12);
  expect(collect(rt.run("*(3, X, 12)"))[0].X.toNumber()).toBe(4);
});

test10("runtime evaluates numeric comparisons", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run(">(2, 1)")).length).toBe(1);
  expect(collect(rt.run(">(1, 2)")).length).toBe(0);
  expect(collect(rt.run(">=(2, 2)")).length).toBe(1);
  expect(collect(rt.run("<(1, 2)")).length).toBe(1);
  expect(collect(rt.run("<=(2, 2)")).length).toBe(1);
  expect(collect(rt.run("<=(-1.99, -01.99)")).length).toBe(1);
});

test10("runtime matches and constructs lists", () => {
  var rt = new RuntimeEngine();

  var values = collect(rt.run("=([a,b,c], [a | T])"));
  expect(values.length).toBe(1);
  expect(values[0].T.toString()).toBe("[b | [c | []]]");
});

test10("default append concatenates and splits lists", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var concatenated = collect(rt.run("append([a,b], [c,d], X)"));
  expect(concatenated.length).toBe(1);
  expect(concatenated[0].X.toString()).toBe("[a | [b | [c | [d | []]]]]");

  var splits = collect(rt.run("append(X, Y, [a,b,c])"));
  expect(splits.length).toBe(4);
  expect(splits.map((value) => value.X.toString() + "/" + value.Y.toString())).toEqual([
    "[]/[a | [b | [c | []]]]",
    "[a | []]/[b | [c | []]]",
    "[a | [b | []]]/[c | []]",
    "[a | [b | [c | []]]]/[]"
  ]);
});

test10("default member enumerates list elements", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("member(X, [a,b,c])"));
  expect(values.length).toBe(3);
  expect(valuesOf(values, "X")).toEqual(["a", "b", "c"]);
});

test10("default select removes a selected element", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("select(a, [a,b,a], X)"));
  expect(values.length).toBe(1);
  expect(values[0].X.toString()).toBe("[b | [a | []]]");
});

test10("default delete removes an element exactly once", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("delete([a,b,a], X, [b])"));
  expect(values.length).toBe(1);
  expect(values[0].X.toString()).toBe("a");
});

test10("default permutation enumerates all permutations", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("permutation([a,b,c], X)"));
  var permutations = values.map((value) => value.X.toString()).sort();
  expect(permutations).toEqual([
    "[a | [b | [c | []]]]",
    "[a | [c | [b | []]]]",
    "[b | [a | [c | []]]]",
    "[b | [c | [a | []]]]",
    "[c | [a | [b | []]]]",
    "[c | [b | [a | []]]]"
  ]);
});

test10("default count aggregates list length", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  expect(collect(rt.run("count([], N)"))[0].N.toNumber()).toBe(0);
  expect(collect(rt.run("count([a,b,c], N)"))[0].N.toNumber()).toBe(3);
  expect(collect(rt.run("count([X,Y,Z], N)"))[0].N.toNumber()).toBe(3);
});

test10("default max and min work over numbers", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  expect(collect(rt.run("max([3,1,2], X)"))[0].X.toNumber()).toBe(3);
  expect(collect(rt.run("min([3,1,2], X)"))[0].X.toNumber()).toBe(1);
  expect(collect(rt.run("max(2, 3, X)"))[0].X.toNumber()).toBe(3);
  expect(collect(rt.run("min(2, 3, X)"))[0].X.toNumber()).toBe(2);
});

test10("default subset and equivalent work on lists", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  expect(collect(rt.run("subset2([a,c], [a,b,c])")).length).toBe(1);
  expect(collect(rt.run("subset2([a,d], [a,b,c])")).length).toBe(0);
  expect(collect(rt.run("equivalent([a,b,c], [c,b,a])")).length).toBe(1);
});

test10("default nextto finds adjacent elements", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  expect(collect(rt.run("nextto(a, b, [c,a,b,d])")).length).toBe(1);
  expect(collect(rt.run("nextto(a, b, [c,a,c,b,d])")).length).toBe(0);
});

test10("runtime built-in system calls inspect term types", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  expect(collect(rt.run("systemCall(isAtom(a))")).length).toBe(1);
  expect(collect(rt.run("systemCall(isNumber(3))")).length).toBe(1);
  expect(collect(rt.run('systemCall(isString("x"))')).length).toBe(1);
  expect(collect(rt.run("systemCall(isList([a]))")).length).toBe(1);
  expect(collect(rt.run("systemCall(isPredicate(p(a)))")).length).toBe(1);
  expect(collect(rt.run("systemCall(isVariable(X))")).length).toBe(1);
  expect(collect(rt.run("systemCall(isAtom(X))")).length).toBe(0);
});

test10("runtime custom system calls can bind variables", () => {
  var rt = new RuntimeEngine((argument, substitutionSet) => {
    if(argument instanceof Predicate && argument.name === "env"){
      return Unification.unify(argument.argsList[0], new Atom({name:"production"}));
    }
    return null;
  });
  rt.loadDefaults();

  var values = collect(rt.run("systemCall(env(X))"));
  expect(values.length).toBe(1);
  expect(values[0].X.name).toBe("production");
});

test10("runtime custom system calls can yield multiple results", () => {
  var rt = new RuntimeEngine(function*(argument, substitutionSet){
    if(argument instanceof Predicate && argument.name === "many"){
      yield substitutionSet;
      yield substitutionSet;
    }
  });
  rt.loadDefaults();

  expect(collect(rt.run("systemCall(many(X))")).length).toBe(2);
});

test10("runtime unhandled system calls fail without throwing", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  expect(collect(rt.run("systemCall(unknown(X))")).length).toBe(0);
});

test10("runtime call invokes a predicate", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("call(member(X, [a,b]))"));
  expect(values.length).toBe(2);
  expect(valuesOf(values, "X")).toEqual(["a", "b"]);
});

test10("runtime call invokes a bound predicate term", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("=(P, member(a, [a,b])), call(P)"));
  expect(values.length).toBe(1);
  expect(values[0].P.toString()).toBe("member(a, [a | [b | []]])");
});

test10("runtime call works inside a rule body", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    invoke(X) :- call(member(X, [a,b])).
  `);

  var values = collect(rt.run("invoke(X)"));
  expect(values.length).toBe(2);
  expect(valuesOf(values, "X")).toEqual(["a", "b"]);
});

test10("runtime apply invokes a predicate with an argument list", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("apply(member, [X, [a,b]])"));
  expect(values.length).toBe(2);
  expect(valuesOf(values, "X")).toEqual(["a", "b"]);
});

test10("runtime apply works inside a rule body", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    applied(X) :- apply(member, [X, [a,b]]).
  `);

  var values = collect(rt.run("applied(X)"));
  expect(values.length).toBe(2);
  expect(valuesOf(values, "X")).toEqual(["a", "b"]);
});

test10("runtime functor decomposes a compound term", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("functor(p(a,b), N, A)"));
  expect(values.length).toBe(1);
  expect(values[0].N.name).toBe("p");
  expect(values[0].A.toNumber()).toBe(2);
});

test10("runtime functor works inside a rule body", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    shape(N, A) :- functor(p(a,b), N, A).
  `);

  var values = collect(rt.run("shape(N, A)"));
  expect(values.length).toBe(1);
  expect(values[0].N.name).toBe("p");
  expect(values[0].A.toNumber()).toBe(2);
});

test10("runtime functor constructs a compound term", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var values = collect(rt.run("functor(T, p, 2)"));
  expect(values.length).toBe(1);
  var term = values[0].T;
  expect(term instanceof Predicate).toBe(true);
  expect(term.name).toBe("p");
  expect(term.argsList.length).toBe(2);
  expect(term.argsList[0] instanceof Variable).toBe(true);
  expect(term.argsList[1] instanceof Variable).toBe(true);
});

test10("runtime binds object atoms from the current object map", () => {
  var rt = new RuntimeEngine();
  rt.setCurrentObjectBindings({"0":{hello:"world"}});
  rt.parseRules(`
    other({0}).
  `);

  var values = collect(rt.run("other(X)"));
  expect(values.length).toBe(1);
  expect(values[0].X.getValue().hello).toBe("world");
});

test10("runtime serializes and re-parses its rules", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    produce("item", b, 2).
    produce(a, b, 2).
  `);

  var serialized = rt.toString();
  var roundTripped = new RuntimeEngine();
  roundTripped.parseRules(serialized);

  expect(roundTripped.toString()).toBe(serialized);
});

test10("runtime getPredicatesByName materializes facts", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    produce("item", b, 2).
    produce(a, b, 2).
  `);

  expect(rt.getPredicatesByName("produce")).toEqual([
    'produce("item", b, 2).',
    "produce(a, b, 2)."
  ]);
  expect(rt.getPredicatesByName("missing")).toEqual([]);
});

test10("runtime retractRule removes only the selected clause", () => {
  var rt = new RuntimeEngine();
  var rules = rt.parseRules(`
    parent(a, b).
    parent(b, c).
  `);

  expect(collect(rt.run("parent(a,b)")).length).toBe(1);
  rt.retractRule(rules[0]);
  expect(collect(rt.run("parent(a,b)")).length).toBe(0);
  expect(collect(rt.run("parent(b,c)")).length).toBe(1);
});

test10("runtime retractRule removes one duplicate clause", () => {
  var rt = new RuntimeEngine();
  var rules = rt.parseRules(`
    parent(a, b).
    parent(a, b).
  `);

  expect(collect(rt.run("parent(a,b)")).length).toBe(2);
  rt.retractRule(rules[0]);
  expect(collect(rt.run("parent(a,b)")).length).toBe(1);
});

test10("runtime unknown predicates fail cleanly", () => {
  var rt = new RuntimeEngine();
  expect(collect(rt.run("missing(X)")).length).toBe(0);
});

test10("runtime rejects an invalid goal", () => {
  var rt = new RuntimeEngine();
  expect(() => rt.run("parent(")).toThrow();
});
