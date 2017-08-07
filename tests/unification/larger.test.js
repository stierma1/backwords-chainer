var {Atom, Predicate, Unification, Variable, Statements, defaultHornClauses, List} = require("../../lib/unification");

var {AndStatements, NotStatement, OrStatements, UnionStatement, HornClause, PredicateStatement} = Statements;
var RuntimeEngine = require("../../lib/grammar/runtime-engine");

var unify = Unification.unify;
var andUnify = Unification.andUnify;
var orUnify = Unification.orUnify;
var SubstitutionSet = Unification.SubstitutionSet;



test("subset", () => {
  var rt = new RuntimeEngine();

  //rt.parseRules(`

  //`)
  //console.log(rt.context)

  var gen = rt.run("subset([], [])");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next()
  }

  expect(vals.length).toBe(1)

  var gen = rt.run("subset([a],[a])");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next()
  }

  expect(vals.length).toBe(1)

  var gen = rt.run("subset([a],[])");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next()
  }

  expect(vals.length).toBe(0)

  var gen = rt.run("subset([], [a])");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next()
  }

  expect(vals.length).toBe(1)

  var gen = rt.run("subset([a,c], [a,b,c])");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next()
  }

  expect(vals.length).toBe(1)
})

test("auto - plan", () => {
  var rt = new RuntimeEngine();
  rt.parseRules(`
    plan(CurrentState, DesiredState, [], X) :- subset(DesiredState, CurrentState).
    plan(CurrentState, DesiredState, [Action | ActionList], Z) :-
      not(subset(DesiredState, CurrentState)), poss(Action, CurrentState, UpdatedState), plan(UpdatedState, DesiredState, ActionList, Z).

    holds(goto(X), CurrentState, [isAt(X) | CurrentState]) :- not(member(isAt(X), CurrentState)).
    holds(open(X), CurrentState, [isOpen(X) | CurrentState]) :-  member(isAt(X), CurrentState).

    poss(Action, CurrentState, UpdatedState) :- holds(Action, CurrentState, UpdatedState).

  `);

  var gen = rt.run("plan([], [isOpen(door)], X, Y)");

  var vals= [];
  var {value, done} = gen.next();

  vals.push(value);

  expect(vals.length).toBe(1)
  expect(value.X.toString()).toBe("[goto(door) | [open(door) | []]]")
})

test("auto - nextto", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var gen = rt.run("nextto(a, b, [a,b])");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next();
  }


  expect(vals.length).toBe(1)
})

test("auto - nextto 2", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var gen = rt.run("nextto(a, b, [c,a,b,d])");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next();
  }


  expect(vals.length).toBe(1)
})

test("auto - nextto 3", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var gen = rt.run("nextto(a, b, [c,a,c,b,d])");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next();
  }


  expect(vals.length).toBe(0)
})

test("auto - select", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var gen = rt.run("select(a, [a,b,a], [b,a])");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next();
  }


  expect(vals.length).toBe(1);
})

test("auto - select 2", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var gen = rt.run("select(a, [a,b,a], X)");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next();
  }


  expect(vals.length).toBe(1);
  expect(vals[0].X.toString()).toBe("[b | [a | []]]");
})

test("auto - select 3", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var gen = rt.run("select(b, [a,b,a], X)");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next();
  }


  expect(vals.length).toBe(1);
  expect(vals[0].X.toString()).toBe("[a | [a | []]]");
})

test("auto - delete", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();

  var gen = rt.run("delete([a,b,a], X, [b])");

  var vals= [];
  var {value, done} = gen.next();
  //while(!done){
    vals.push(value);
    //var {value, done} = gen.next();
  //}


  expect(vals.length).toBe(1);
  expect(vals[0].X.toString()).toBe("a");
})

test("auto - systemcall", () => {
  var rt = new RuntimeEngine(function(s,substitutionSet){
    return substitutionSet;
  });
  rt.loadDefaults();

  var gen = rt.run("systemCall(go)");

  var vals= [];
  var {value, done} = gen.next();
  //while(!done){
    vals.push(value);
    //var {value, done} = gen.next();
  //}


  expect(vals.length).toBe(1);
})
