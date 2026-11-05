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

test10("line and block comments are ignored", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    % line comment
    p(a).
    /* block
       comment */
    p(b). % trailing comment
    q(X) :- p(X). % body comment
  `);

  expect(valuesOf(collect(rt.run("q(X)")), "X")).toEqual(["a", "b"]);
});

test10("comments work in goals and around tokens", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p(a).
  `);

  expect(collect(rt.run("p(a) % trailing")).length).toBe(1);
  expect(collect(rt.run("p(/* inline */ a)")).length).toBe(1);
});

test10("comment markers inside strings are preserved", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p("100% ok").
    q("/* not a comment */").
  `);

  expect(collect(rt.run("p(X)"))[0].X.removeQuotes()).toBe("100% ok");
  expect(collect(rt.run("q(X)"))[0].X.removeQuotes()).toBe("/* not a comment */");
});

test10("quoted atoms support spaces and escaped quotes", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    'my pred'(a).
    value('hello world').
  `);

  expect(collect(rt.run("'my pred'(X)")).length).toBe(1);
  expect(collect(rt.run("value(X)"))[0].X.toString()).toBe("hello world");
  expect(collect(rt.run("=(X, 'it''s')"))[0].X.toString()).toBe("it's");
});

test10("double-quoted strings unescape common escape sequences", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run(String.raw`=(X, "a\nb")`))[0].X.removeQuotes()).toBe("a\nb");
  expect(collect(rt.run(String.raw`=(X, "a\tb")`))[0].X.removeQuotes()).toBe("a\tb");
  expect(collect(rt.run(String.raw`=(X, "a\\b")`))[0].X.removeQuotes()).toBe("a\\b");
});

test10("bagof and setof support existential caret qualification", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    pair(a, 1).
    pair(b, 1).
    pair(c, 2).
  `);

  expect(collect(rt.run("bagof(Y, X^pair(X,Y), Bag)"))[0].Bag.toString()).toBe("[1 | [1 | [2 | []]]]");
  expect(collect(rt.run("setof(Y, X^pair(X,Y), Bag)"))[0].Bag.toString()).toBe("[1 | [2 | []]]");
  expect(collect(rt.run("bagof(Y, X^Y^pair(X,Y), Bag)"))[0].Bag.toString()).toBe("[1 | [1 | [2 | []]]]");
});

test10("existential grouping still works for ordinary bagof free variables", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    pair(a, 1).
    pair(b, 1).
    pair(c, 2).
  `);

  var values = collect(rt.run("bagof(Y, pair(X,Y), Bag)"));
  expect(values.length).toBe(3);
  expect(values.map(function(value){
    return value.X.toString() + "/" + value.Bag.toString();
  })).toEqual(["a/[1 | []]", "b/[1 | []]", "c/[2 | []]"]);
});

test10("user-defined infix operators work in facts, rules and goals", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    :- op(500, xfx, likes).
    john likes mary.
    mary likes wine.
    friends(X, Y) :- X likes Y.
  `);

  expect(collect(rt.run("john likes mary")).length).toBe(1);
  expect(collect(rt.run("(john likes mary)")).length).toBe(1);

  var values = collect(rt.run("friends(X, Y)"));
  expect(values.map(function(value){
    return value.X.toString() + "/" + value.Y.toString();
  })).toEqual(["john/mary", "mary/wine"]);
});

test10("parse errors include line and column information", () => {
  var rt = new RuntimeEngine();

  expect(function(){
    rt.run("p(");
  }).toThrow(/line 1, column/);

  expect(function(){
    rt.parseRules("p(a).\nq(");
  }).toThrow(/line 2, column/);
});

test10("zero-arity predicates remain supported alongside Phase 3 syntax", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    ready.
    quoted('ok').
  `);

  expect(collect(rt.run("ready")).length).toBe(1);
  expect(collect(rt.run("quoted(X)"))[0].X.toString()).toBe("ok");
});
