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

test("once - statement", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    memberOnce(X, L) :- once(member(X, L)).
  `);

  var gen = rt.run("once(member(1, [1,1,1]))");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next();
  }
  expect(vals.length).toBe(1)
})

test("auto - agent", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(`
    plan(CurrentState, DesiredState, [], CurrentState, _) :- subset2(DesiredState, CurrentState).
    plan(CurrentState, DesiredState, [Action | ActionList], Z, Depth) :- not(=(Depth, 0)), +(1, NewDepth, Depth),
      poss(Action, CurrentState, UpdatedState), plan(UpdatedState, DesiredState, ActionList, Z, NewDepth).

    holds(run(Task, Box), CurrentState, [runningOn(Task, Box), running(Task) | NewState])
      :- member(waiting(Task), CurrentState), member(idle(Box), CurrentState),
         select(idle(Box), CurrentState, NewState1), select(waiting(Task), NewState1, NewState).

    poss(Action, CurrentState, UpdatedState) :- holds(Action, CurrentState, UpdatedState).
    shortage(Task, CpuShortage, RamShortage, IOShortage, HardDiskShortage) :-
      cpuNeeded(Task, Cpu).

  `);

  var gen = rt.run("plan([idle(box2), waiting(task2), idle(box1), waiting(task1)], [running(task2)], Z, Y, 3)");

  var vals= [];
  var {value, done} = gen.next();
  var count = 0;
  while(!done && count < 10){
    vals.push(value);
    //console.log(value.Z.toString());
    var {value, done} = gen.next();
    count++
  }

  expect(vals.length).toBe(6)
  //expect(vals).toBe("[goto(door) | [open(door) | []]]")
})

test("object - atoms", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.setCurrentObjectBindings({"0": {hello:"world"}})
  rt.parseRules(`
    other({0}).
  `);

  var gen = rt.run("other(X)");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next();
  }
  expect(vals.length).toBe(1)
  console.log(vals[0].X)
  expect(vals[0].X.getValue().hello).toBe("world")
})
