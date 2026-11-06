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

test10("length/2 measures and constructs lists", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("length([a,b,c], N)")), "N")).toEqual(["3"]);
  expect(collect(rt.run("length([a,b], 2)")).length).toBe(1);
  expect(collect(rt.run("length([a,b], 1)")).length).toBe(0);
  expect(collect(rt.run("length(L, 3)"))[0].L.toString()).toMatch(/^\[.*\|.*\|.*\]$/);
});

test10("reverse/2 works in both directions", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("reverse([a,b,c], R)")), "R")).toEqual(["[c | [b | [a | []]]]"]);
  expect(valuesOf(collect(rt.run("reverse(L, [c,b,a])")), "L")).toEqual(["[a | [b | [c | []]]]"]);
});

test10("nth0/3 and nth1/3 index and enumerate lists", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("nth0(0, [a,b], X)")), "X")).toEqual(["a"]);
  expect(valuesOf(collect(rt.run("nth1(1, [a,b], X)")), "X")).toEqual(["a"]);
  expect(collect(rt.run("nth0(3, [a,b], X)")).length).toBe(0);

  var enumerated = collect(rt.run("nth0(I, [a,b], X)"));
  expect(enumerated.map(function(value){ return value.I.toString() + "/" + value.X.toString(); })).toEqual(["0/a", "1/b"]);
});

test10("last/2 returns the final list element", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("last([a,b,c], X)")), "X")).toEqual(["c"]);
  expect(collect(rt.run("last([], X)")).length).toBe(0);
});

test10("between/3 and succ/2 generate and check integers", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("between(2, 4, X)")), "X")).toEqual(["2", "3", "4"]);
  expect(collect(rt.run("between(2, 4, 3)")).length).toBe(1);
  expect(collect(rt.run("between(2, 4, 5)")).length).toBe(0);

  expect(valuesOf(collect(rt.run("succ(2, X)")), "X")).toEqual(["3"]);
  expect(valuesOf(collect(rt.run("succ(X, 3)")), "X")).toEqual(["2"]);
  expect(collect(rt.run("succ(X, Y)")).length).toBe(0);
});

test10("sort/2, msort/2 and keysort/2 order list terms", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("msort([b,a,c,a], S)")), "S")).toEqual(["[a | [a | [b | [c | []]]]]"]);
  expect(valuesOf(collect(rt.run("sort([b,a,c,a], S)")), "S")).toEqual(["[a | [b | [c | []]]]"]);
  expect(collect(rt.run("keysort([[b,2],[a,1]], S)"))[0].S.toString()).toBe("[[a | [1 | []]] | [[b | [2 | []]] | []]]");
});

test10("list numeric predicates aggregate values", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("sum_list([1,2,3], S)")), "S")).toEqual(["6"]);
  expect(valuesOf(collect(rt.run("max_list([3,1,2], M)")), "M")).toEqual(["3"]);
  expect(valuesOf(collect(rt.run("min_list([3,1,2], M)")), "M")).toEqual(["1"]);
});

test10("memberchk/2 and selectchk/3 keep only the first match", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("memberchk(X, [a,b,a])")), "X")).toEqual(["a"]);
  expect(collect(rt.run("memberchk(X, [a,b,a])")).length).toBe(1);

  var selected = collect(rt.run("selectchk(X, [a,b,a], R)"));
  expect(selected.length).toBe(1);
  expect(selected[0].X.toString()).toBe("a");
  expect(selected[0].R.toString()).toBe("[b | [a | []]]");
});

test10("maplist/2 and maplist/3 apply closures over lists", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    double(X, Y) :- +(X, X, Y).
    add(X, Y, Z) :- +(X, Y, Z).
  `);

  expect(valuesOf(collect(rt.run("maplist(double, [1,2,3], Ys)")), "Ys")).toEqual(["[2 | [4 | [6 | []]]]"]);
  expect(valuesOf(collect(rt.run("maplist(add, [1,2], [10,20], Ys)")), "Ys")).toEqual(["[11 | [22 | []]]"]);
});

test10("include/3 and exclude/3 filter with a closure", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    positive(X) :- >(X, 0).
  `);

  expect(valuesOf(collect(rt.run("include(positive, [-1,0,1,2], L)")), "L")).toEqual(["[1 | [2 | []]]"]);
  expect(valuesOf(collect(rt.run("exclude(positive, [-1,0,1,2], L)")), "L")).toEqual(["[-1 | [0 | []]]"]);
});

test10("foldl/4 and foldl/5 fold over one or more lists", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    add(X, Y, Z) :- +(X, Y, Z).
    add3(X, Y, Acc, Out) :- +(X, Y, T), +(T, Acc, Out).
  `);

  expect(valuesOf(collect(rt.run("foldl(add, [1,2,3], 0, S)")), "S")).toEqual(["6"]);
  expect(valuesOf(collect(rt.run("foldl(add3, [1,2], [10,20], 0, S)")), "S")).toEqual(["33"]);
});
