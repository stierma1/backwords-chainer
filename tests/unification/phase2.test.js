var RuntimeEngine = require("../../lib/grammar/runtime-engine");
var Unification = require("../../lib/unification").Unification;

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

test10("is/2 evaluates arithmetic expressions with precedence", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("X is 1 + 2")), "X")).toEqual(["3"]);
  expect(valuesOf(collect(rt.run("X is 1 + 2 * 3")), "X")).toEqual(["7"]);
  expect(valuesOf(collect(rt.run("X is (1 + 2) * 3")), "X")).toEqual(["9"]);
});

test10("is/2 supports division, integer division, mod and powers", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("X is 7 / 2")), "X")).toEqual(["3.5"]);
  expect(valuesOf(collect(rt.run("X is 8 / 2")), "X")).toEqual(["4"]);
  expect(valuesOf(collect(rt.run("X is 7 // 2")), "X")).toEqual(["3"]);
  expect(valuesOf(collect(rt.run("X is 7 mod 2")), "X")).toEqual(["1"]);
  expect(valuesOf(collect(rt.run("X is 2 ** 10")), "X")).toEqual(["1024"]);
});

test10("is/2 supports unary minus and variables bound by earlier goals", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("X is -2 + 3")), "X")).toEqual(["1"]);

  var values = collect(rt.run("X = 4, Y is X * X"));
  expect(values[0].X.toString()).toBe("4");
  expect(values[0].Y.toString()).toBe("16");
});

test10("is/2 fails for unbound variables and division by zero", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run("X is Y + 1")).length).toBe(0);
  expect(collect(rt.run("X is 1 / 0")).length).toBe(0);
  expect(collect(rt.run("X is 1 // 0")).length).toBe(0);
  expect(collect(rt.run("X is 1 mod 0")).length).toBe(0);
});

test10("standard arithmetic comparisons work", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run("1 + 2 =:= 3")).length).toBe(1);
  expect(collect(rt.run("1 + 2 =\\= 4")).length).toBe(1);
  expect(collect(rt.run("2 =< 3")).length).toBe(1);
  expect(collect(rt.run("3 >= 2")).length).toBe(1);
  expect(collect(rt.run("1 < 2")).length).toBe(1);
  expect(collect(rt.run("2 > 1")).length).toBe(1);

  expect(collect(rt.run("1 + 2 =:= 4")).length).toBe(0);
  expect(collect(rt.run("1 + 2 =\\= 3")).length).toBe(0);
});

test10("comparisons can use variables bound by earlier goals", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run("X = 2, X + 1 =:= 3")).length).toBe(1);
  expect(collect(rt.run("X = 2, X + 1 =\\= 4")).length).toBe(1);
  expect(collect(rt.run("X = 2, X + 1 > 2")).length).toBe(1);
});

test10("infix equality unifies terms", () => {
  var rt = new RuntimeEngine();

  var values = collect(rt.run("X = a"));
  expect(values.length).toBe(1);
  expect(values[0].X.toString()).toBe("a");

  var chained = collect(rt.run("X = Y, Y = 3"));
  expect(chained[0].X.toString()).toBe("3");
  expect(chained[0].Y.toString()).toBe("3");
});

test10("backslash-equals tests non-unifiability", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run("a \\= b")).length).toBe(1);
  expect(collect(rt.run("a \\= a")).length).toBe(0);
  expect(collect(rt.run("f(a) \\= f(b)")).length).toBe(1);
  expect(collect(rt.run("f(a) \\= f(a)")).length).toBe(0);
});

test10("dif/2 succeeds for non-unifiable terms and fails for identical terms", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run("dif(a, b)")).length).toBe(1);
  expect(collect(rt.run("dif(a, a)")).length).toBe(0);
  expect(collect(rt.run("dif(f(a), f(b))")).length).toBe(1);
  expect(collect(rt.run("dif(f(a), f(a))")).length).toBe(0);
});

test10("dif/2 delays constraints until variables are bound", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run("dif(X, a)")).length).toBe(1);
  expect(collect(rt.run("dif(X, a), X = b")).length).toBe(1);
  expect(collect(rt.run("dif(X, a), X = a")).length).toBe(0);
  expect(collect(rt.run("dif(X, Y), X = Y")).length).toBe(0);
  expect(collect(rt.run("dif(f(X), f(a)), X = b")).length).toBe(1);
  expect(collect(rt.run("dif(f(X), f(a)), X = a")).length).toBe(0);
});

test10("dif/2 constraints work with breadth-first search", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run("dif(X, a), X = b", {search:"bfs"})).length).toBe(1);
  expect(collect(rt.run("dif(X, a), X = a", {search:"bfs"})).length).toBe(0);
});

test10("unify_with_occurs_check rejects cyclic terms regardless of the global setting", () => {
  var rt = new RuntimeEngine();
  rt.setOccursCheck(false);

  expect(collect(rt.run("unify_with_occurs_check(X, f(X))")).length).toBe(0);
  expect(collect(rt.run("unify_with_occurs_check(X, a)")).length).toBe(1);
});

test10("occurs check is configurable at the runtime level", () => {
  var rt = new RuntimeEngine();
  expect(rt.getOccursCheck()).toBe(true);

  rt.setOccursCheck(false);
  expect(rt.getOccursCheck()).toBe(false);
  expect(collect(rt.run("=(X, f(X))")).length).toBe(1);

  rt.setOccursCheck(true);
  expect(rt.getOccursCheck()).toBe(true);
  expect(collect(rt.run("=(X, f(X))")).length).toBe(0);
});

test10("integer and bignum arithmetic is exact", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("X is 12345678901234567890 + 1")), "X")).toEqual(["12345678901234567891"]);
  expect(valuesOf(collect(rt.run("X is 10 ** 20")), "X")).toEqual(["100000000000000000000"]);
  expect(collect(rt.run("12345678901234567890 + 1 =:= 12345678901234567891")).length).toBe(1);
});

test10("infix arithmetic works inside rules", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    calc(X) :- X is 1 + 2 * 3.
    large(X) :- X = 5, X + 1 > 5.
  `);

  expect(valuesOf(collect(rt.run("calc(X)")), "X")).toEqual(["7"]);
  expect(valuesOf(collect(rt.run("large(X)")), "X")).toEqual(["5"]);
});

test10("prefix arithmetic and comparisons continue to work", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("+(1, 2, X)")), "X")).toEqual(["3"]);
  expect(valuesOf(collect(rt.run("*(2, 3, X)")), "X")).toEqual(["6"]);
  expect(collect(rt.run(">(2, 1)")).length).toBe(1);
  expect(collect(rt.run("<=(2, 2)")).length).toBe(1);
});

test10("decimal numbers survive source segmentation", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("X is 1.5 + 2.5")), "X")).toEqual(["4"]);
});
