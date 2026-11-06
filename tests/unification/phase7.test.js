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

test10("first-argument indexing preserves clause order and fallback clauses", () => {
  var rt = new RuntimeEngine();
  var rules = "";
  for(var i = 0; i < 100; i++){
    rules += "p(" + i + ", v" + i + ").\n";
  }
  rules += "p(X, fallback).\n";
  rt.parseRules(rules);

  expect(valuesOf(collect(rt.run("p(50, X)")), "X")).toEqual(["v50", "fallback"]);
  expect(valuesOf(collect(rt.run("p(2, X)")), "X")).toEqual(["v2", "fallback"]);
  expect(collect(rt.run("p(999, X)")).length).toBe(1);
});

test10("the clause index is invalidated by dynamic database changes", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p(1, a).
    p(2, b).
  `);

  expect(valuesOf(collect(rt.run("p(1, X)")), "X")).toEqual(["a"]);
  expect(collect(rt.run("assertz(p(1, newer))")).length).toBe(1);
  expect(valuesOf(collect(rt.run("p(1, X)")), "X")).toEqual(["a", "newer"]);

  expect(collect(rt.run("retract(p(1, a))")).length).toBe(1);
  expect(valuesOf(collect(rt.run("p(1, X)")), "X")).toEqual(["newer"]);
});

test10("BFS visited-state deduplication removes equivalent states", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p(a).
    p(a).
    q(X) :- p(X).
  `);

  expect(collect(rt.run("q(X)", {search:"bfs"})).length).toBe(2);
  expect(collect(rt.run("q(X)", {search:"bfs", dedupe:true})).length).toBe(1);
});

test10("maxResults limits depth-first and breadth-first answers", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  expect(collect(rt.run("member(X, [a,b,c])", {maxResults:2})).length).toBe(2);
  expect(collect(rt.run("member(X, [a,b,c])", {search:"bfs", maxResults:2})).length).toBe(2);
});

test10("shouldStop cancels a running search", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  var checks = 0;

  var values = collect(rt.run("member(X, [a,b,c])", {
    shouldStop:function(){
      checks++;
      return checks > 1;
    }
  }));

  expect(values.length).toBe(1);
});

test10("cut-aware BFS resolves cut-containing predicates depth-first", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    p(a).
    p(b).
    first(X) :- p(X), !.
  `);

  expect(valuesOf(collect(rt.run("first(X)", {search:"bfs"})), "X")).toEqual(["a"]);
});

test10("BFS maxNodes and maxQueue bound search work", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  expect(collect(rt.run("member(X, [a,b,c])", {search:"bfs", maxNodes:1})).length).toBe(0);
  expect(collect(rt.run("member(X, [a,b,c])", {search:"bfs", maxQueue:1})).length).toBe(0);
});
