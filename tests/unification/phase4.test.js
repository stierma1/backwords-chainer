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

test10("type predicates inspect instantiated terms", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run("var(X)")).length).toBe(1);
  expect(collect(rt.run("nonvar(X)")).length).toBe(0);
  expect(collect(rt.run("=(X, a), nonvar(X)")).length).toBe(1);
  expect(collect(rt.run("atom(a)")).length).toBe(1);
  expect(collect(rt.run("atom(3)")).length).toBe(0);
  expect(collect(rt.run("number(3)")).length).toBe(1);
  expect(collect(rt.run("number(a)")).length).toBe(0);
  expect(collect(rt.run("compound(f(a))")).length).toBe(1);
  expect(collect(rt.run("compound(a)")).length).toBe(0);
  expect(collect(rt.run("compound([a,b])")).length).toBe(1);
});

test10("ground/1 checks for variables at any depth", () => {
  var rt = new RuntimeEngine();

  expect(collect(rt.run("ground(f(a,b))")).length).toBe(1);
  expect(collect(rt.run("ground(f(a,X))")).length).toBe(0);
  expect(collect(rt.run("X = a, ground(f(X))")).length).toBe(1);
});

test10("arg/3 extracts predicate and list arguments", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("arg(1, f(a,b), X)")), "X")).toEqual(["a"]);
  expect(valuesOf(collect(rt.run("arg(2, f(a,b), X)")), "X")).toEqual(["b"]);
  expect(collect(rt.run("arg(3, f(a,b), X)")).length).toBe(0);
  expect(valuesOf(collect(rt.run("arg(1, [a,b], X)")), "X")).toEqual(["a"]);
  expect(collect(rt.run("arg(2, [a,b], X)"))[0].X.toString()).toBe("[b | []]");
});

test10("functor/3 still decomposes and constructs terms", () => {
  var rt = new RuntimeEngine();

  var values = collect(rt.run("functor(f(a,b), N, A)"));
  expect(values[0].N.toString()).toBe("f");
  expect(values[0].A.toString()).toBe("2");

  var constructed = collect(rt.run("functor(T, g, 2)"));
  expect(constructed[0].T.toString()).toMatch(/^g\(/);
});

test10("copy_term/2 standardizes variables apart", () => {
  var rt = new RuntimeEngine();

  var values = collect(rt.run("copy_term(f(X,X), Y)"));
  expect(values.length).toBe(1);
  expect(values[0].Y.name).toBe("f");
  expect(values[0].Y.argsList[0].name).toBe(values[0].Y.argsList[1].name);
  expect(values[0].Y.argsList[0]).toBe(values[0].Y.argsList[1]);
});

test10("term_variables/2 returns unique variables in order", () => {
  var rt = new RuntimeEngine();

  expect(valuesOf(collect(rt.run("term_variables(f(X,Y,X), Vs)")), "Vs")).toEqual(["[X | [Y | []]]"]);
  expect(valuesOf(collect(rt.run("X = a, term_variables(f(X,Y,Y), Vs)")), "Vs")).toEqual(["[Y | []]"]);
  expect(valuesOf(collect(rt.run("term_variables(a, Vs)")), "Vs")).toEqual(["[]"]);
});

test10("call/2 and call/3 append arguments to a closure", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    add(X, Y, Z) :- +(X, Y, Z).
  `);

  expect(valuesOf(collect(rt.run("call(add(1,2), X)")), "X")).toEqual(["3"]);
  expect(valuesOf(collect(rt.run("call(add, 1, 2, X)")), "X")).toEqual(["3"]);
  expect(valuesOf(collect(rt.run("=(P, add(1,2)), call(P, X)")), "X")).toEqual(["3"]);
});

test10("findall/4 builds a difference list", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  expect(collect(rt.run("findall(X, member(X, [a,b]), L, [])"))[0].L.toString()).toBe("[a | [b | []]]");
  expect(collect(rt.run("findall(X, member(X, []), L, [])"))[0].L.toString()).toBe("[]");
  expect(collect(rt.run("findall(X, member(X, [a,b]), L, T)"))[0].L.toString()).toBe("[a | [b | T]]");
});

test10("aggregate_all/3 counts, sums, averages and selects extrema", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  expect(valuesOf(collect(rt.run("aggregate_all(count, member(X, [a,b,c]), N)")), "N")).toEqual(["3"]);
  expect(valuesOf(collect(rt.run("aggregate_all(sum(X), member(X, [1,2,3]), S)")), "S")).toEqual(["6"]);
  expect(valuesOf(collect(rt.run("aggregate_all(avg(X), member(X, [1,2,3]), A)")), "A")).toEqual(["2"]);
  expect(valuesOf(collect(rt.run("aggregate_all(min(X), member(X, [3,1,2]), M)")), "M")).toEqual(["1"]);
  expect(valuesOf(collect(rt.run("aggregate_all(max(X), member(X, [3,1,2]), M)")), "M")).toEqual(["3"]);
});

test10("aggregate_all/3 supports bag and set templates", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  expect(collect(rt.run("aggregate_all(bag(X), member(X, [b,a,b]), B)"))[0].B.toString()).toBe("[b | [a | [b | []]]]");
  expect(collect(rt.run("aggregate_all(set(X), member(X, [b,a,b]), S)"))[0].S.toString()).toBe("[a | [b | []]]");
});

test10("aggregate/3 aggregates a goal", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  expect(valuesOf(collect(rt.run("aggregate(count, member(X, [a,b]), N)")), "N")).toEqual(["2"]);
  expect(valuesOf(collect(rt.run("aggregate(sum(X), member(X, [1,2,3]), S)")), "S")).toEqual(["6"]);
});
