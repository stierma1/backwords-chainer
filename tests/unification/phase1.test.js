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

function valuesOf(results, name){
  return results.map(function(result){
    return result[name].toString();
  });
}

test10("cut commits to the first clause of a predicate", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p(a).
    p(b).
    first(X) :- p(X), !.
  `);

  expect(valuesOf(collect(rt.run("first(X)")), "X")).toEqual(["a"]);
});

test10("cut prunes alternatives created earlier in the clause", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p(a).
    p(b).
  `);

  expect(valuesOf(collect(rt.run("p(X), !")), "X")).toEqual(["a"]);
});

test10("cut is local to the predicate invocation", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p(a).
    p(b).
    first(X) :- p(X), !.
    choose(X) :- first(X).
    choose(b).
  `);

  expect(valuesOf(collect(rt.run("choose(X)")), "X")).toEqual(["a", "b"]);
});

test10("cut followed by failure prevents falling back to later clauses", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p(a).
    no(X) :- p(X), !, fail.
    no(fallback).
  `);

  expect(collect(rt.run("no(X)")).length).toBe(0);
});

test10("backslash-plus is an alias for negation as failure", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p(a).
    p(b).
    q(X) :- p(X), \\+ =(X, b).
  `);

  expect(valuesOf(collect(rt.run("q(X)")), "X")).toEqual(["a"]);
});

test10("true and fail are callable zero-arity predicates", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run("true")).length).toBe(1);
  expect(collect(rt.run("fail")).length).toBe(0);
  expect(collect(rt.run("false")).length).toBe(0);
});

test10("zero-arity facts and rules are supported", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    ready.
    check(ok) :- ready, !.
  `);

  expect(collect(rt.run("ready")).length).toBe(1);
  expect(collect(rt.run("check(ok)")).length).toBe(1);
});

test10("if-then-else chooses the then branch when the condition succeeds", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p(a).
    p(b).
  `);

  var values = collect(rt.run("(p(X) -> =(Y, yes) ; =(Y, no))"));
  expect(values.length).toBe(1);
  expect(values[0].Y.toString()).toBe("yes");
});

test10("if-then-else chooses the else branch when the condition fails", () => {
  var rt = new RuntimeEngine();

  var values = collect(rt.run("(fail -> =(Y, yes) ; =(Y, no))"));
  expect(values.length).toBe(1);
  expect(values[0].Y.toString()).toBe("no");
});

test10("if-then-else does not use the else branch when the then branch fails", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p(a).
  `);

  expect(collect(rt.run("(p(X) -> fail ; =(Y, no))")).length).toBe(0);
});

test10("if-then-else commits to the first condition solution", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p(a).
    p(b).
  `);

  var values = collect(rt.run("(p(X) -> =(Y, yes) ; =(Y, no))"));
  expect(values.length).toBe(1);
  expect(values[0].Y.toString()).toBe("yes");
});

test10("if-then-else works inside rules", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p(a).
    q(Y) :- (p(X) -> =(Y, first) ; =(Y, second)).
  `);

  expect(valuesOf(collect(rt.run("q(Y)")), "Y")).toEqual(["first"]);
});

test10("assertz appends and asserta prepends a fact", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run("assert(foo(a))")).length).toBe(1);
  expect(collect(rt.run("assertz(foo(b))")).length).toBe(1);
  expect(collect(rt.run("asserta(foo(z))")).length).toBe(1);

  expect(valuesOf(collect(rt.run("foo(X)")), "X")).toEqual(["z", "a", "b"]);
});

test10("assert can add a rule", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    bar(a).
  `);

  expect(collect(rt.run("assert(foo(X) :- bar(X))")).length).toBe(1);
  expect(valuesOf(collect(rt.run("foo(X)")), "X")).toEqual(["a"]);
});

test10("retract removes a matching fact", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    foo(a).
    foo(b).
  `);

  expect(collect(rt.run("retract(foo(a))")).length).toBe(1);
  expect(valuesOf(collect(rt.run("foo(X)")), "X")).toEqual(["b"]);
});

test10("retract removes a matching rule", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    bar(a).
    foo(X) :- bar(X).
  `);

  expect(collect(rt.run("retract(foo(X) :- bar(X))")).length).toBe(1);
  expect(collect(rt.run("foo(X)")).length).toBe(0);
});

test10("abolish removes every clause for a predicate indicator", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    foo(a).
    foo(b).
    foo(c, d).
  `);

  expect(collect(rt.run("abolish(foo/1)")).length).toBe(1);
  expect(collect(rt.run("foo(X)")).length).toBe(0);
  expect(collect(rt.run("foo(X, Y)")).length).toBe(1);
});

test10("clause/2 exposes facts and rules", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    bar(a).
    foo(b).
    foo(X) :- bar(X).
  `);

  var values = collect(rt.run("clause(foo(X), B)"));
  expect(values.length).toBe(2);
  expect(values[0].X.toString()).toBe("b");
  expect(values[0].B.toString()).toBe("true");
  expect(values[1].X).toBeDefined();
  expect(values[1].B.name).toBe("bar");
  expect(values[1].B.toString()).toBe("bar(" + values[1].X.toString() + ")");
});

test10("dynamic database predicates work with breadth-first search", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run("assert(foo(a))", {search:"bfs"})).length).toBe(1);
  expect(collect(rt.run("foo(X)", {search:"bfs"})).length).toBe(1);
  expect(collect(rt.run("abolish(foo/1)", {search:"bfs"})).length).toBe(1);
  expect(collect(rt.run("foo(X)", {search:"bfs"})).length).toBe(0);
});
