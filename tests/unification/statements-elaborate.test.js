var {
  Atom,
  NumberAtom,
  Predicate,
  Variable,
  List,
  Unification,
  Statements,
  defaultHornClauses
} = require("../../lib/unification");

var {
  AndStatements,
  OrStatements,
  UnionStatement,
  NotStatement,
  OnceStatement,
  CallStatement,
  ApplyStatement,
  FunctorStatement,
  FindAllStatement,
  ForallStatement,
  AddStatement,
  MultiplyStatement,
  GreaterThanStatement,
  GreaterThanEqualStatement,
  LessThanStatement,
  LessThanEqualStatement,
  SystemCallStatement,
  HornClause,
  PredicateStatement
} = Statements;

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
var varX = new Variable({name:"X"});
var varY = new Variable({name:"Y"});

function fact(name, argsList){
  return new HornClause({
    head:new Predicate({name:name, argsList:argsList}),
    body:new AndStatements({subStatements:[]})
  });
}

test10("NotStatement succeeds when its sub-statement has no solution", () => {
  var values = collect(new NotStatement({
    subStatement:new UnionStatement({subject:atomA, object:atomB})
  }).unify(new SubstitutionSet({})));
  expect(values.length).toBe(1);
});

test10("NotStatement fails when its sub-statement has a solution", () => {
  var values = collect(new NotStatement({
    subStatement:new UnionStatement({subject:varX, object:atomA})
  }).unify(new SubstitutionSet({})));
  expect(values.length).toBe(0);
});

test10("NotStatement yields only one failure result for multiple solutions", () => {
  var statements = new OrStatements({subStatements:[
    new UnionStatement({subject:varX, object:atomA}),
    new UnionStatement({subject:varX, object:atomB})
  ]});
  var values = collect(new NotStatement({subStatement:statements}).unify(new SubstitutionSet({})));
  expect(values.length).toBe(0);
});

test10("OnceStatement yields only the first solution", () => {
  var statements = new OrStatements({subStatements:[
    new UnionStatement({subject:varX, object:atomA}),
    new UnionStatement({subject:varX, object:atomB})
  ]});
  var values = collect(new OnceStatement({statement:statements}).unify(new SubstitutionSet({})));
  expect(values.length).toBe(1);
  expect(values[0].get(varX)).toBe(atomA);
});

test10("AddStatement computes a forward sum", () => {
  var statement = new AddStatement({
    value1:new NumberAtom({name:2}),
    value2:new NumberAtom({name:3}),
    result:varX
  });
  var values = collect(statement.unify(new SubstitutionSet({})));
  expect(values.length).toBe(1);
  expect(values[0].get(varX).toNumber()).toBe(5);
});

test10("AddStatement solves for either addend", () => {
  var first = new AddStatement({
    value1:new NumberAtom({name:2}),
    value2:varX,
    result:new NumberAtom({name:7})
  });
  var second = new AddStatement({
    value1:varX,
    value2:new NumberAtom({name:3}),
    result:new NumberAtom({name:7})
  });

  expect(collect(first.unify(new SubstitutionSet({})))[0].get(varX).toNumber()).toBe(5);
  expect(collect(second.unify(new SubstitutionSet({})))[0].get(varX).toNumber()).toBe(4);
});

test10("AddStatement fails when more than one input is unknown", () => {
  var statement = new AddStatement({
    value1:varX,
    value2:varY,
    result:new NumberAtom({name:7})
  });
  expect(collect(statement.unify(new SubstitutionSet({}))).length).toBe(0);
});

test10("MultiplyStatement computes a forward product", () => {
  var statement = new MultiplyStatement({
    value1:new NumberAtom({name:4}),
    value2:new NumberAtom({name:3}),
    result:varX
  });
  var values = collect(statement.unify(new SubstitutionSet({})));
  expect(values.length).toBe(1);
  expect(values[0].get(varX).toNumber()).toBe(12);
});

test10("MultiplyStatement solves for either factor", () => {
  var first = new MultiplyStatement({
    value1:new NumberAtom({name:2}),
    value2:varX,
    result:new NumberAtom({name:8})
  });
  var second = new MultiplyStatement({
    value1:varX,
    value2:new NumberAtom({name:2}),
    result:new NumberAtom({name:8})
  });

  expect(collect(first.unify(new SubstitutionSet({})))[0].get(varX).toNumber()).toBe(4);
  expect(collect(second.unify(new SubstitutionSet({})))[0].get(varX).toNumber()).toBe(4);
});

test10("MultiplyStatement refuses division by zero", () => {
  var zero = new NumberAtom({name:0});
  var statement = new MultiplyStatement({
    value1:zero,
    value2:varX,
    result:new NumberAtom({name:0})
  });
  expect(collect(statement.unify(new SubstitutionSet({}))).length).toBe(0);
});

test10("comparison statements accept true comparisons", () => {
  var two = new NumberAtom({name:2});
  var one = new NumberAtom({name:1});
  expect(collect(new GreaterThanStatement({value1:two, value2:one}).unify(new SubstitutionSet({}))).length).toBe(1);
  expect(collect(new GreaterThanEqualStatement({value1:two, value2:two}).unify(new SubstitutionSet({}))).length).toBe(1);
  expect(collect(new LessThanStatement({value1:one, value2:two}).unify(new SubstitutionSet({}))).length).toBe(1);
  expect(collect(new LessThanEqualStatement({value1:two, value2:two}).unify(new SubstitutionSet({}))).length).toBe(1);
});

test10("comparison statements reject false comparisons", () => {
  var two = new NumberAtom({name:2});
  var one = new NumberAtom({name:1});
  expect(collect(new GreaterThanStatement({value1:one, value2:two}).unify(new SubstitutionSet({}))).length).toBe(0);
  expect(collect(new GreaterThanEqualStatement({value1:one, value2:two}).unify(new SubstitutionSet({}))).length).toBe(0);
  expect(collect(new LessThanStatement({value1:two, value2:one}).unify(new SubstitutionSet({}))).length).toBe(0);
  expect(collect(new LessThanEqualStatement({value1:two, value2:one}).unify(new SubstitutionSet({}))).length).toBe(0);
});

test10("comparisons do not succeed while a variable is unbound", () => {
  var statement = new GreaterThanStatement({
    value1:varX,
    value2:new NumberAtom({name:1})
  });
  expect(collect(statement.unify(new SubstitutionSet({}))).length).toBe(0);
});

test10("SystemCallStatement yields the callback result", () => {
  var statement = new SystemCallStatement(
    new Predicate({name:"ok", argsList:[]}),
    (argument, substitutionSet) => substitutionSet,
    "systemCall(ok)"
  );
  var values = collect(statement.unify(new SubstitutionSet({}).add(varX, atomA)));
  expect(values.length).toBe(1);
  expect(values[0].get(varX)).toBe(atomA);
});

test10("SystemCallStatement fails when the callback fails", () => {
  var statement = new SystemCallStatement(
    new Predicate({name:"nope", argsList:[]}),
    () => null,
    "systemCall(nope)"
  );
  expect(collect(statement.unify(new SubstitutionSet({}))).length).toBe(0);
});

test10("SystemCallStatement can delegate to a generator", () => {
  var statement = new SystemCallStatement(
    new Predicate({name:"many", argsList:[]}),
    function*(argument, substitutionSet){
      yield substitutionSet;
      yield substitutionSet;
    },
    "systemCall(many)"
  );
  expect(collect(statement.unify(new SubstitutionSet({}))).length).toBe(2);
});

test10("CallStatement invokes a predicate by name", () => {
  var hornClauses = {p:{1:[fact("p", [atomA])]}};
  var statement = new CallStatement({
    statement:new Predicate({name:"p", argsList:[varX]}),
    hornClauses:hornClauses
  });
  var values = collect(statement.unify(new SubstitutionSet({})));
  expect(values.length).toBe(1);
  expect(values[0].get(varX)).toBe(atomA);
});

test10("CallStatement invokes a predicate bound to a variable", () => {
  var hornClauses = {p:{1:[fact("p", [atomA])]}};
  var substitutionSet = new SubstitutionSet({}).add(varX, new Predicate({name:"p", argsList:[varY]}));
  var statement = new CallStatement({statement:varX, hornClauses:hornClauses});
  var values = collect(statement.unify(substitutionSet));
  expect(values.length).toBe(1);
  expect(values[0].get(varY)).toBe(atomA);
});

test10("ApplyStatement applies a predicate name to an argument list", () => {
  var hornClauses = {p:{1:[fact("p", [atomA])]}};
  var statement = new ApplyStatement({
    predicate:new Atom({name:"p"}),
    args:List.fromArray([varX]),
    hornClauses:hornClauses
  });
  var values = collect(statement.unify(new SubstitutionSet({})));
  expect(values.length).toBe(1);
  expect(values[0].get(varX)).toBe(atomA);
});

test10("FunctorStatement extracts the name and arity of a predicate", () => {
  var predicate = new Predicate({name:"p", argsList:[atomA, atomB]});
  var statement = new FunctorStatement({
    term:predicate,
    name:varX,
    arity:varY
  });
  var values = collect(statement.unify(new SubstitutionSet({})));
  expect(values.length).toBe(1);
  expect(values[0].get(varX).name).toBe("p");
  expect(values[0].get(varY).toNumber()).toBe(2);
});

test10("FunctorStatement extracts arity zero from an atom", () => {
  var statement = new FunctorStatement({
    term:atomA,
    name:varX,
    arity:varY
  });
  var values = collect(statement.unify(new SubstitutionSet({})));
  expect(values.length).toBe(1);
  expect(values[0].get(varX).name).toBe("a");
  expect(values[0].get(varY).toNumber()).toBe(0);
});

test10("FunctorStatement constructs a term from a name and arity", () => {
  var statement = new FunctorStatement({
    term:varX,
    name:new Atom({name:"p"}),
    arity:new NumberAtom({name:2})
  });
  var values = collect(statement.unify(new SubstitutionSet({})));
  expect(values.length).toBe(1);
  var term = values[0].get(varX);
  expect(term instanceof Predicate).toBe(true);
  expect(term.name).toBe("p");
  expect(term.argsList.length).toBe(2);
  expect(term.argsList[0] instanceof Variable).toBe(true);
  expect(term.argsList[1] instanceof Variable).toBe(true);
});

test10("FunctorStatement constructs an atom for arity zero", () => {
  var statement = new FunctorStatement({
    term:varX,
    name:new Atom({name:"a"}),
    arity:new NumberAtom({name:0})
  });
  var values = collect(statement.unify(new SubstitutionSet({})));
  expect(values.length).toBe(1);
  expect(values[0].get(varX) instanceof Atom).toBe(true);
  expect(values[0].get(varX).name).toBe("a");
});

test10("PredicateStatement with no matching predicate fails cleanly", () => {
  var statement = new PredicateStatement({
    predicate:new Predicate({name:"missing", argsList:[varX]}),
    hornClauses:{}
  });
  expect(collect(statement.unify(new SubstitutionSet({}))).length).toBe(0);
});

test10("PredicateStatement with no matching arity fails cleanly", () => {
  var statement = new PredicateStatement({
    predicate:new Predicate({name:"p", argsList:[varX, varY]}),
    hornClauses:{p:{1:[fact("p", [atomA])]}}
  });
  expect(collect(statement.unify(new SubstitutionSet({}))).length).toBe(0);
});

test10("default member clause enumerates the elements of a list", () => {
  var clauses = defaultHornClauses.createMemberClause();
  var hornClauses = {member:{"2":clauses}};
  var statement = new PredicateStatement({
    predicate:new Predicate({name:"member", argsList:[varX, List.fromArray([atomA, atomB])]}),
    hornClauses:hornClauses
  });
  var values = collect(statement.unify(new SubstitutionSet({})));
  expect(values.length).toBe(2);
  expect(values[0].get(varX)).toBe(atomA);
  expect(values[1].get(varX)).toBe(atomB);
});

test10("FindAllStatement collects every goal solution", () => {
  var clauses = defaultHornClauses.createMemberClause();
  var hornClauses = {member:{"2":clauses}};
  var statement = new FindAllStatement({
    template:varX,
    goal:new Predicate({name:"member", argsList:[varX, List.fromArray([atomA, atomB])]}),
    bag:varY,
    hornClauses:hornClauses
  });

  var values = collect(statement.unify(new SubstitutionSet({})));
  expect(values.length).toBe(1);
  expect(values[0].get(varY).toString()).toBe("[a | [b | []]]");
});

test10("ForallStatement checks every condition solution", () => {
  var memberClauses = defaultHornClauses.createMemberClause();
  var hornClauses = {
    member:{"2":memberClauses},
    allowed:{"1":[fact("allowed", [atomA]), fact("allowed", [atomB])]}
  };
  var statement = new ForallStatement({
    condition:new Predicate({name:"member", argsList:[varX, List.fromArray([atomA, atomB])]}),
    action:new Predicate({name:"allowed", argsList:[varX]}),
    hornClauses:hornClauses
  });

  expect(collect(statement.unify(new SubstitutionSet({}))).length).toBe(1);
});
