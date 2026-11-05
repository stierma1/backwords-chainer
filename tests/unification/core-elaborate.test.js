var {
  Atom,
  StringAtom,
  NumberAtom,
  Predicate,
  Variable,
  List,
  Unification,
  Statements
} = require("../../lib/unification");

var {UnionStatement, AndStatements, OrStatements, PredicateStatement, HornClause} = Statements;
var rewrite = require("../../lib/unification/trs");

var unify = Unification.unify;
var andUnify = Unification.andUnify;
var orUnify = Unification.orUnify;
var SubstitutionSet = Unification.SubstitutionSet;

var TEST_TIMEOUT = 10000;

function test10(name, fn){
  test(name, fn, TEST_TIMEOUT);
}

function collect(gen, limit){
  var values = [];
  for(var value of gen){
    values.push(value);
    if(limit && values.length >= limit){
      break;
    }
  }
  return values;
}

var atomA = new Atom({name:"a"});
var atomB = new Atom({name:"b"});
var atomC = new Atom({name:"c"});
var varX = new Variable({name:"X"});
var varY = new Variable({name:"Y"});
var varZ = new Variable({name:"Z"});

test10("atom equality is based on the atom name", () => {
  expect(atomA.equals(new Atom({name:"a"}))).toBe(true);
  expect(atomA.equals(atomB)).toBe(false);
  expect(atomA.equals("a")).toBe(false);
  expect(atomA.getValue()).toBe("a");
  expect(atomA.toString()).toBe("a");
});

test10("atom from value retains the value as its name", () => {
  var value = {hello:"world"};
  var atom = Atom.fromValue(value);
  expect(atom.getValue()).toBe(value);
  expect(atom.equals(Atom.fromValue(value))).toBe(true);
});

test10("variable equality and underscore rendering", () => {
  var otherX = new Variable({name:"X"});
  var hidden = new Variable({name:"_hidden"});
  expect(varX.equals(otherX)).toBe(true);
  expect(varX.equals(varY)).toBe(false);
  expect(hidden.toString(true)).toBe("_");
  expect(varX.toString(true)).toBe("X");
});

test10("string atoms remove exactly the surrounding quotes", () => {
  var string = new StringAtom({name:"\"hello world\""});
  expect(string.removeQuotes()).toBe("hello world");
  expect(string.toString()).toBe("\"hello world\"");
});

test10("number atoms normalize their representation", () => {
  var number = new NumberAtom({name:"-01.990"});
  expect(number.toNumber()).toBe(-1.99);
  expect(number.toString()).toBe("-1.99");
});

test10("lists are built recursively and expose their head and tail", () => {
  var list = List.fromArray([atomA, atomB, atomC]);
  expect(list instanceof List).toBe(true);
  expect(list.toString()).toBe("[a | [b | [c | []]]]");
  expect(list.argsList[0]).toBe(atomA);
  expect(list.argsList[1] instanceof List).toBe(true);
  expect(list.argsList[1].argsList[0]).toBe(atomB);
});

test10("empty lists are the atom []", () => {
  var empty = List.fromArray([]);
  expect(empty instanceof Atom).toBe(true);
  expect(empty.name).toBe("[]");
  expect(List.getEmptyList()).toBe(empty);
});

test10("predicates compare by name, arity and arguments", () => {
  var predicate = new Predicate({name:"p", argsList:[atomA, varX]});
  var same = new Predicate({name:"p", argsList:[atomA, new Variable({name:"X"})]});
  var differentName = new Predicate({name:"q", argsList:[atomA, varX]});
  var differentArity = new Predicate({name:"p", argsList:[atomA]});
  var differentArg = new Predicate({name:"p", argsList:[atomB, varX]});

  expect(predicate.arity).toBe(2);
  expect(predicate.equals(same)).toBe(true);
  expect(predicate.equals(differentName)).toBe(false);
  expect(predicate.equals(differentArity)).toBe(false);
  expect(predicate.equals(differentArg)).toBe(false);
});

test10("predicate deepSearch finds variables at any depth", () => {
  var inner = new Predicate({name:"inner", argsList:[varX]});
  var outer = new Predicate({name:"outer", argsList:[atomA, inner]});
  expect(outer.deepSearch(varX)).toBe(true);
  expect(outer.deepSearch(varY)).toBe(false);
});

test10("predicate deepCopy does not share nested predicates", () => {
  var inner = new Predicate({name:"inner", argsList:[varX]});
  var outer = new Predicate({name:"outer", argsList:[inner]});
  var copy = outer.deepCopy();
  expect(copy.equals(outer)).toBe(true);
  expect(copy.argsList[0]).not.toBe(inner);
  copy.argsList[0].argsList[0] = atomA;
  expect(outer.argsList[0].argsList[0]).toBe(varX);
});

test10("predicate deepCopyWithReplace substitutes variables at any depth", () => {
  var substitutionSet = new SubstitutionSet({}).add(varX, atomA);
  var inner = new Predicate({name:"inner", argsList:[varX]});
  var outer = new Predicate({name:"outer", argsList:[inner, varX]});
  var replaced = outer.deepCopyWithReplace(substitutionSet);

  expect(replaced.argsList[0].argsList[0]).toBe(atomA);
  expect(replaced.argsList[1]).toBe(atomA);
  expect(outer.argsList[1]).toBe(varX);
});

test10("unify variable with atom produces a binding", () => {
  var substitutionSet = unify(varX, atomA);
  expect(substitutionSet).not.toBe(null);
  expect(substitutionSet.get(varX)).toBe(atomA);
  expect(substitutionSet.size()).toBe(1);
});

test10("unify identical atoms produces an empty successful substitution", () => {
  var substitutionSet = unify(atomA, new Atom({name:"a"}));
  expect(substitutionSet).not.toBe(null);
  expect(substitutionSet.size()).toBe(0);
});

test10("unify different atoms fails", () => {
  expect(unify(atomA, atomB)).toBe(null);
});

test10("unify atom with predicate fails", () => {
  var predicate = new Predicate({name:"p", argsList:[atomA]});
  expect(unify(atomA, predicate)).toBe(null);
  expect(unify(predicate, atomA)).toBe(null);
});

test10("unify variables creates both directions of the aliasing", () => {
  var substitutionSet = unify(varX, varY);
  expect(substitutionSet.get(varX)).toBe(varY);
  expect(substitutionSet.get(varY)).toBe(varX);
});

test10("unify a variable with itself is a successful no-op", () => {
  var substitutionSet = unify(varX, new Variable({name:"X"}));
  expect(substitutionSet).not.toBe(null);
  expect(substitutionSet.size()).toBe(0);
});

test10("unify rejects a variable that occurs inside the predicate", () => {
  var predicate = new Predicate({name:"p", argsList:[varX, atomA]});
  expect(unify(varX, predicate)).toBe(null);
});

test10("unify permits a variable that does not occur in the predicate", () => {
  var predicate = new Predicate({name:"p", argsList:[atomA]});
  var substitutionSet = unify(varX, predicate);
  expect(substitutionSet.get(varX)).toBe(predicate);
});

test10("unify predicates recursively binds their arguments", () => {
  var first = new Predicate({name:"p", argsList:[varX, atomA]});
  var second = new Predicate({name:"p", argsList:[atomB, varY]});
  var substitutionSet = unify(first, second);

  expect(substitutionSet.get(varX)).toBe(atomB);
  expect(substitutionSet.get(varY)).toBe(atomA);
});

test10("unify predicates with different names or arities fails", () => {
  var first = new Predicate({name:"p", argsList:[varX]});
  var second = new Predicate({name:"q", argsList:[varX]});
  var third = new Predicate({name:"p", argsList:[varX, varY]});
  expect(unify(first, second)).toBe(null);
  expect(unify(first, third)).toBe(null);
});

test10("unify lists with a variable tail binds the tail", () => {
  var list = List.fromArray([atomA, atomB, atomC]);
  var pattern = new List({argsList:[atomA, varX]});
  var substitutionSet = unify(pattern, list);
  expect(substitutionSet.get(varX).toString()).toBe("[b | [c | []]]");
});

test10("unify nested predicates binds variables in the nested term", () => {
  var first = new Predicate({name:"outer", argsList:[new Predicate({name:"inner", argsList:[varX]})]});
  var second = new Predicate({name:"outer", argsList:[new Predicate({name:"inner", argsList:[atomB]})]});
  var substitutionSet = unify(first, second);
  expect(substitutionSet.get(varX)).toBe(atomB);
});

test10("andUnify composes compatible substitutions", () => {
  var substitutionSet = andUnify([unify(varX, varY), unify(varY, atomA)]);
  expect(substitutionSet.get(varX)).toBe(atomA);
  expect(substitutionSet.get(varY)).toBe(atomA);
});

test10("andUnify detects contradictory substitutions", () => {
  expect(andUnify([unify(varX, atomA), unify(varX, atomB)])).toBe(null);
});

test10("andUnify resolves longer variable chains", () => {
  var substitutionSet = andUnify([
    unify(varX, varY),
    unify(varY, varZ),
    unify(varZ, atomC)
  ]);
  expect(substitutionSet.get(varX)).toBe(atomC);
  expect(substitutionSet.get(varY)).toBe(atomC);
  expect(substitutionSet.get(varZ)).toBe(atomC);
});

test10("orUnify yields each successful branch in order", () => {
  var values = collect(orUnify([
    [unify(varX, atomA)],
    [unify(varX, atomB)],
    [unify(varX, atomC)]
  ]));
  expect(values.length).toBe(3);
  expect(values[0].get(varX)).toBe(atomA);
  expect(values[1].get(varX)).toBe(atomB);
  expect(values[2].get(varX)).toBe(atomC);
});

test10("orUnify skips failed branches", () => {
  var values = collect(orUnify([
    [unify(varX, atomA)],
    [null],
    [unify(varY, atomB)]
  ]));
  expect(values.length).toBe(2);
  expect(values[0].get(varX)).toBe(atomA);
  expect(values[1].get(varY)).toBe(atomB);
});

test10("substitution sets expose their collection, count and string form", () => {
  var substitutionSet = new SubstitutionSet({});
  expect(substitutionSet.size()).toBe(0);
  substitutionSet.add(varX, atomA).add(varY, atomB);
  expect(substitutionSet.size()).toBe(2);
  expect(substitutionSet.count()).toBe(2);
  expect(substitutionSet.get(varX)).toBe(atomA);
  expect(substitutionSet.get("Y")).toBe(atomB);
  expect(substitutionSet.toList().length).toBe(2);
  expect(substitutionSet.toString()).toBe("{ X |-> a, Y |-> b }");
});

test10("substitution sets compare equal only when all bindings match", () => {
  var first = new SubstitutionSet({}).add(varX, atomA).add(varY, atomB);
  var second = new SubstitutionSet({}).add(varX, new Atom({name:"a"})).add(varY, new Atom({name:"b"}));
  var third = new SubstitutionSet({}).add(varX, atomA);
  expect(first.equals(second)).toBe(true);
  expect(first.equals(third)).toBe(false);
  expect(first.equals(null)).toBe(false);
});

test10("substitution set intersect returns only shared keys", () => {
  var first = new SubstitutionSet({}).add(varX, atomA).add(varY, atomB);
  var second = new SubstitutionSet({}).add(varX, atomA).add(varZ, atomC);
  var intersection = first.intersect(second);
  expect(intersection.size()).toBe(1);
  expect(intersection.get(varX)).toBe(atomA);
  expect(intersection.get(varY)).toBe(undefined);
});

test10("substitution set reunion contains bindings from both sets", () => {
  var first = new SubstitutionSet({}).add(varX, atomA);
  var second = new SubstitutionSet({}).add(varY, atomB);
  var reunion = first.reunion(second);
  expect(reunion.get(varX)).toBe(atomA);
  expect(reunion.get(varY)).toBe(atomB);
});

test10("term rewriting resolves variable chains transitively", () => {
  var substitutionSet = new SubstitutionSet({})
    .add(varX, varY)
    .add(varY, varZ)
    .add(varZ, atomA);

  rewrite(substitutionSet);

  expect(substitutionSet.get(varX)).toBe(atomA);
  expect(substitutionSet.get(varY)).toBe(atomA);
  expect(substitutionSet.get(varZ)).toBe(atomA);
});

test10("term rewriting resolves variables inside predicates", () => {
  var substitutionSet = new SubstitutionSet({})
    .add(varX, varY)
    .add(varY, new Predicate({name:"p", argsList:[atomA]}));

  rewrite(substitutionSet);

  var value = substitutionSet.get(varX);
  expect(value instanceof Predicate).toBe(true);
  expect(value.name).toBe("p");
  expect(value.argsList[0]).toBe(atomA);
});

test10("term rewriting terminates on circular aliases", () => {
  var substitutionSet = new SubstitutionSet({})
    .add(varX, varY)
    .add(varY, varX);

  rewrite(substitutionSet);

  expect(substitutionSet.get(varX) instanceof Variable).toBe(true);
  expect(substitutionSet.get(varY) instanceof Variable).toBe(true);
});

test10("UnionStatement evaluates both sides before unifying", () => {
  var substitutionSet = new SubstitutionSet({}).add(varX, atomA);
  var statement = new UnionStatement({subject:varX, object:atomA});
  var values = collect(statement.unify(substitutionSet));
  expect(values.length).toBe(1);
  expect(values[0].size()).toBe(0);
});

test10("empty AndStatements is a successful no-op", () => {
  var substitutionSet = new SubstitutionSet({}).add(varX, atomA);
  var values = collect(new AndStatements({subStatements:[]}).unify(substitutionSet));
  expect(values.length).toBe(1);
  expect(values[0]).toBe(substitutionSet);
});

test10("AndStatements is a conjunction over all sub-statements", () => {
  var statements = new AndStatements({subStatements:[
    new UnionStatement({subject:varX, object:atomA}),
    new UnionStatement({subject:varY, object:varX})
  ]});
  var values = collect(statements.unify(new SubstitutionSet({})));
  expect(values.length).toBe(1);
  expect(values[0].get(varX)).toBe(atomA);
  expect(values[0].get(varY)).toBe(atomA);
});

test10("AndStatements rejects contradictory sub-statements", () => {
  var statements = new AndStatements({subStatements:[
    new UnionStatement({subject:varX, object:atomA}),
    new UnionStatement({subject:varX, object:atomB})
  ]});
  expect(collect(statements.unify(new SubstitutionSet({}))).length).toBe(0);
});

test10("OrStatements enumerates all alternatives", () => {
  var statements = new OrStatements({subStatements:[
    new UnionStatement({subject:varX, object:atomA}),
    new UnionStatement({subject:varX, object:atomB})
  ]});
  var values = collect(statements.unify(new SubstitutionSet({})));
  expect(values.length).toBe(2);
  expect(values[0].get(varX)).toBe(atomA);
  expect(values[1].get(varX)).toBe(atomB);
});

test10("HornClause runtime instances freshen variables per invocation", () => {
  var head = new Predicate({name:"p", argsList:[varX]});
  var body = new AndStatements({subStatements:[new PredicateStatement({
    predicate:new Predicate({name:"q", argsList:[varX]}),
    hornClauses:{q:{1:[]}}
  })]});
  var clause = new HornClause({head:head, body:body});
  var first = clause.getRuntimeInstance();
  var second = clause.getRuntimeInstance();

  expect(first.head.argsList[0]).not.toBe(second.head.argsList[0]);
  expect(first.body.subStatements[0].predicate.argsList[0]).toBe(first.head.argsList[0]);
  expect(second.body.subStatements[0].predicate.argsList[0]).toBe(second.head.argsList[0]);
});
