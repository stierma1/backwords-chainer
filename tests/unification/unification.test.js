
var {Atom, Predicate, Unification, Variable, Statements, defaultHornClauses, List} = require("../../lib/unification");

var {AndStatements, NotStatement, OrStatements, UnionStatement, HornClause, PredicateStatement} = Statements;
var RuntimeEngine = require("../../lib/grammar/runtime-engine");

var unify = Unification.unify;
var andUnify = Unification.andUnify;
var orUnify = Unification.orUnify;
var SubstitutionSet = Unification.SubstitutionSet;

var atomA = new Atom({name:"a"});
var atomB = new Atom({name:"b"});
var atomC = new Atom({name:"c"});
var varX = new Variable({name:"X"});
var varY = new Variable({name:"Y"});
var varZ = new Variable({name:"Z"});
var predicateP = new Predicate({name:"test", argsList:[atomA, atomB]});
var predicateQ = new Predicate({name:"test", argsList:[varX, varY]});

var predicateP2 = new Predicate({name:"test", argsList:[varX, atomB]});
var predicateQ2 = new Predicate({name:"test", argsList:[atomA, varY]});

var predicateQ3 = new Predicate({name:"test", argsList:[atomB, predicateP2]});
var predicateP3 = new Predicate({name:"test", argsList:[varX, varY]});



test('unify var-atom', () => {
  var unifySet = Unification.unify(varX, atomA);
  expect(unifySet.get(varX)).toBe(atomA);
});

test('unify atom-atom a-a', () => {
  var unifySet = Unification.unify(atomA, atomA);
  expect(unifySet).not.toBe(null);
  expect(unifySet.size()).toBe(0);
});

test('unify atom-atom a-b', () => {
  var unifySet = Unification.unify(atomA, atomB);
  expect(unifySet).toBe(null);
});

test('unify var-var x-y', () => {
  var unifySet = Unification.unify(varX, varY);
  expect(unifySet.get(varX)).toBe(varY);
  expect(unifySet.get(varY)).toBe(varX);
});

test('unify var-var x-x', () => {
  var unifySet = Unification.unify(varX, varX);
  expect(unifySet).not.toBe(null);
  expect(unifySet.size()).toBe(0);
});

test('unify atom-predicate a-p', () => {
  var unifySet = Unification.unify(atomA, predicateP);
  expect(unifySet).toBe(null);
});

test('unify var-predicate x-p', () => {
  var unifySet = Unification.unify(varX, predicateP);
  expect(unifySet.get(varX)).toBe(predicateP);
});

test('unify var-predicate y-q -- fails due to recursive definition', () => {
  var unifySet = Unification.unify(varY, predicateQ);
  expect(unifySet).toBe(null);
});

test('unify predicate-predicate r-q', () => {
  var unifySet = Unification.unify(predicateP, predicateQ);
  expect(unifySet.get(varX)).toBe(atomA);
  expect(unifySet.get(varY)).toBe(atomB);
})

test('unify predicate-predicate q3-r3', () => {
  var unifySet = Unification.unify(predicateQ3, predicateP3);
  expect(unifySet.get(varX)).toBe(atomB);
  expect(unifySet.get(varY)).toBe(predicateP2);
})

test('unify predicate-predicate different arities', () => {
  var predicateC = new Predicate({name:"test", argsList:[atomA]})
  var unifySet = Unification.unify(predicateP, predicateC);
  expect(unifySet).toBe(null);
})

test('unify predicate-predicate different names', () => {
  var predicateC = new Predicate({name:"bob", argsList:[atomA, atomB]})
  var unifySet = Unification.unify(predicateP, predicateC);
  expect(unifySet).toBe(null);
})

test('unify predicate-predicate predP-predP', () => {
  var unifySet = Unification.unify(predicateP, predicateP);
  expect(unifySet).not.toBe(null);
  expect(unifySet.size()).toBe(0);
})

test('unify list-list predP-predP', () => {
  var list1 = List.fromArray([atomA, atomB]);
  var list2 = new List({argsList:[varX, varY]});
  var unifySet = Unification.unify(list1, list2);

  expect(unifySet).not.toBe(null);
  expect(unifySet.size()).toBe(2);
  expect(unifySet.get(varX)).toBe(atomA)

})

test('andUnify z-p z-q', () => {
  var unifySet = andUnify([unify(predicateP, varZ), unify(varZ, predicateQ)]);
  expect(unifySet.get(varX)).toBe(atomA);
  expect(unifySet.get(varY)).toBe(atomB);
})

test('andUnify z-q z-p', () => {
  var unifySet = andUnify([unify(predicateQ, varZ), unify(varZ, predicateP)]);
  expect(unifySet.get(varX)).toBe(atomA);
  expect(unifySet.get(varY)).toBe(atomB);
})

test('andUnify z-p2 z-q2', () => {
  var unifySet = andUnify([unify(predicateP, varZ), unify(varZ, predicateQ)]);
  expect(unifySet.get(varX)).toBe(atomA);
  expect(unifySet.get(varY)).toBe(atomB);
})

test('andUnify chainVariables x-y y-a', () => {
  var unifySet = andUnify([unify(varX, varY), unify(varY, atomA)]);
  expect(unifySet.get(varX)).toBe(atomA);
  expect(unifySet.get(varY)).toBe(atomA);
})

test('andUnify chainVariables y-a x-y', () => {
  var unifySet = andUnify([unify(varY, atomA), unify(varX, varY)]);
  expect(unifySet.get(varX)).toBe(atomA);
  expect(unifySet.get(varY)).toBe(atomA);
})

test('andUnify circular chainVariables z-x x-y y-z z-a', () => {
  var unifySet = andUnify([unify(varZ, varX), unify(varX, varY), unify(varY, varZ), unify(varZ, atomA)]);
  expect(unifySet.get(varX)).toBe(atomA);
  expect(unifySet.get(varY)).toBe(atomA);
  expect(unifySet.get(varZ)).toBe(atomA);
})

test('andUnify chainVariables bad x-b x-y y-z z-a', () => {
  var unifySet = andUnify([unify(varX, atomB), unify(varX, varY), unify(varY, varZ), unify(varZ, atomA)]);
  expect(unifySet).toBe(null);
})

test('orUnify oneStatement', () => {
  var unifySetGenerator = orUnify([[unify(varX, atomB)]]);
  var {value, done} = unifySetGenerator.next();
  expect(value.get(varX)).toBe(atomB);
  var {value, done} = unifySetGenerator.next();
  expect(done).toBe(true);
})

test('orUnify twoStatements', () => {
  var unifySetGenerator = orUnify([[unify(varX, atomB)], [unify(varX, atomA)]]);
  var {value, done} = unifySetGenerator.next();
  expect(value.get(varX)).toBe(atomB);
  var {value, done} = unifySetGenerator.next();
  expect(value.get(varX)).toBe(atomA);
  var {value, done} = unifySetGenerator.next();
  expect(done).toBe(true);
})

test('orStatement', () => {
  var unionStatement1 = new UnionStatement({subject: varX, object:atomB});
  var unionStatement2 = new UnionStatement({subject: varX, object:atomA});
  var unionStatement3 = new UnionStatement({subject: varX, object:atomC})
  var orStatement = new OrStatements({subStatements: [unionStatement1, unionStatement2]})
  var andStatements = new AndStatements({subStatements: [orStatement, unionStatement2]});
  var orStatement = new OrStatements({subStatements:[unionStatement3, andStatements]});

  var unifySetGenerator = orStatement.unify(new SubstitutionSet({}))

  var {value, done} = unifySetGenerator.next();

  expect(value.get(varX)).toBe(atomC);
  var {value, done} = unifySetGenerator.next();
  expect(value.get(varX)).toBe(atomA);
  var {value, done} = unifySetGenerator.next();
  expect(done).toBe(true);
})

test('grandparents check', () => {
  //parent(GrandParent, Z), parent(Z, GrandChild), ((parent(GrandParent, Z) = parent(jim, james)) ; ())
  var jim = new Atom({name:"jim"});
  var james = new Atom({name:"james"});
  var joe = new Atom({name:"joe"});
  var jack = new Atom({name:"jack"});
  var susan = new Atom({name:"susan"});
  var varZ = new Variable({name:"Z"});
  var varGrandParent = new Variable({name:"grandparent"});
  var varGrandChild = new Variable({name:"grandchild"});
  var varP1 = new Variable({name:"P1"});
  var varP2 = new Variable({name:"P2"});
  var gparentPred = new Predicate({name:"parent", argsList:[varGrandParent, varZ]});
  var gchildPred = new Predicate({name:"parent", argsList:[varZ, varGrandChild]});
  var parentPred1 = new Predicate({name:"parent", argsList:[jim, james]});
  var parentPred2 = new Predicate({name:"parent", argsList:[james, joe]});
  var parentPred3 = new Predicate({name:"parent", argsList:[james, jack]});
  var parentPred4 = new Predicate({name:"parent", argsList:[susan, james]})
  var parentRules = [parentPred1, parentPred2, parentPred3, parentPred4];
  var gparentPredOrs = new OrStatements({subStatements: parentRules.map((rule) => {
    return new UnionStatement({subject:gparentPred, object:rule});
  })});
  var gchildPredOrs = new OrStatements({subStatements: parentRules.map((rule) => {
    return new UnionStatement({subject:gchildPred, object:rule});
  })})

  var andStatements = new AndStatements({subStatements:[gparentPredOrs, gchildPredOrs]})

  var unifySetGenerator = andStatements.unify(new SubstitutionSet({}))
  var values = [];
  var {value, done} = unifySetGenerator.next();
  while(!done){
    values.push(value);
    var {value, done} = unifySetGenerator.next();
  }
  expect(values[0].get(varGrandParent)).toBe(jim);
  expect(values[0].get(varGrandChild)).toBe(joe);
  expect(values[1].get(varGrandParent)).toBe(jim);
  expect(values[1].get(varGrandChild)).toBe(jack);
  expect(values[2].get(varGrandParent)).toBe(susan);
  expect(values[2].get(varGrandChild)).toBe(joe);
  expect(values[3].get(varGrandParent)).toBe(susan);
  expect(values[3].get(varGrandChild)).toBe(jack);

})

test('grandparents check - horn clause', () => {
  //parent(GrandParent, Z), parent(Z, GrandChild), ((parent(GrandParent, Z) = parent(jim, james)) ; ())
  var jim = new Atom({name:"jim"});
  var james = new Atom({name:"james"});
  var joe = new Atom({name:"joe"});
  var jack = new Atom({name:"jack"});
  var susan = new Atom({name:"susan"});
  var varZ = new Variable({name:"Z"});
  var varX = new Variable({name:"X"});
  var varY = new Variable({name:"Y"});
  var varGrandParent = new Variable({name:"grandparent"});
  var varGrandChild = new Variable({name:"grandchild"});
  var varP1 = new Variable({name:"P1"});
  var varP2 = new Variable({name:"P2"});
  var hornClauses = [];
  var gpredicate = new Predicate({name:"grandparent", argsList:[varX, varY]});
  var parent1 = new PredicateStatement({hornClauses:hornClauses,predicate:new Predicate({name:"parent", argsList:[varX, varZ]})});
  var parent2 = new PredicateStatement({hornClauses:hornClauses,predicate:new Predicate({name:"parent", argsList:[varZ, varY]})});
  var grandparentHornClause = new HornClause({ head:gpredicate, body:new AndStatements({subStatements:[parent1, parent2]})});
  hornClauses.push(grandparentHornClause);
  var parentRule1 = new Predicate({name:"parent", argsList:[jim, james]});
  var parentRule2 = new Predicate({name:"parent", argsList:[james, joe]});
  var parentRule3 = new Predicate({name:"parent", argsList:[james, jack]});
  var parentRule4 = new Predicate({name:"parent", argsList:[susan, james]})
  var parentHornClauses = [parentRule1, parentRule2, parentRule3, parentRule4].map((pR) => {
    var hc = new HornClause({head:pR, body:new AndStatements({subStatements:[]})});
    hornClauses.push(hc);
  });
  //grandparent(X, Y) :- parent(X, Z), parent(Z, Y)
  var gparentPred = new Predicate({name:"parent", argsList:[varGrandParent, varZ]});
  var gchildPred = new Predicate({name:"parent", argsList:[varZ, varGrandChild]});
  var parentPred1 = new Predicate({name:"parent", argsList:[jim, james]});
  var parentPred2 = new Predicate({name:"parent", argsList:[james, joe]});
  var parentPred3 = new Predicate({name:"parent", argsList:[james, jack]});
  var parentPred4 = new Predicate({name:"parent", argsList:[susan, james]})
  var parentRules = [parentPred1, parentPred2, parentPred3, parentPred4];
  var gparentPredOrs = new OrStatements({subStatements: parentRules.map((rule) => {
    return new UnionStatement({subject:gparentPred, object:rule});
  })});
  var gchildPredOrs = new OrStatements({subStatements: parentRules.map((rule) => {
    return new UnionStatement({subject:gchildPred, object:rule});
  })})

  var andStatements = new AndStatements({subStatements:[gparentPredOrs, gchildPredOrs]})

  var goal = new PredicateStatement({hornClauses:hornClauses,predicate:new Predicate({name:"grandparent", argsList:[varX, varY]})});


  var unifySetGenerator = goal.unify(new SubstitutionSet({}))
  var values = [];
  var {value, done} = unifySetGenerator.next();

  while(!done){
    values.push(value);
    var {value, done} = unifySetGenerator.next();
  }
  values.map((val) => {
    //console.log(val.collection)
  })
  expect(values[0].get(varX)).toBe(jim);
  expect(values[0].get(varY)).toBe(joe);
  expect(values[1].get(varX)).toBe(jim);
  expect(values[1].get(varY)).toBe(jack);
  expect(values[2].get(varX)).toBe(susan);
  expect(values[2].get(varY)).toBe(joe);
  expect(values[3].get(varX)).toBe(susan);
  expect(values[3].get(varY)).toBe(jack);

})

test('memberOf test', () => {
  var myList = List.fromArray([atomA, atomB, atomC]);
  var memberOfHornClause = defaultHornClauses.createMemberClause();
  var memberOf = new Predicate({name:"member", argsList:[varX, myList]});
  var goal = new PredicateStatement({hornClauses:memberOfHornClause, predicate:memberOf});

  var unifySetGenerator = goal.unify(new SubstitutionSet({}))
  var values = [];
  var {value, done} = unifySetGenerator.next();

  while(!done){
    values.push(value);
    var {value, done} = unifySetGenerator.next();
  }

  values.map((val) => {
    //console.log(val.collection)
  })
  expect(values.length).toBe(3);
  expect(values[0].get(varX)).toBe(atomA);
  expect(values[1].get(varX)).toBe(atomB);
  expect(values[2].get(varX)).toBe(atomC);
});

test('not memberOf - test', () => {
  var myList = List.fromArray([atomA, atomB]);
  var memberOfHornClause = defaultHornClauses.createMemberClause();
  var memberOf = new Predicate({name:"member", argsList:[varX, myList]});
  var p = new PredicateStatement({hornClauses:memberOfHornClause, predicate:memberOf});
  var goal = new AndStatements({subStatements:[new UnionStatement({subject:varX, object:atomC}), new NotStatement({subStatement: p })]});
  //var goal = new NotStatement({subStatement: p });
  var unifySetGenerator = goal.unify(new SubstitutionSet({}))
  var values = [];
  var {value, done} = unifySetGenerator.next();

  while(!done){
    values.push(value);
    var {value, done} = unifySetGenerator.next();
  }

  values.map((val) => {
    //console.log(val.collection)
  })
  expect(values.length).toBe(1);
  expect(values[0].get(varX)).toBe(atomC);
})

test('memberOf test element', () => {
  var myList = List.fromArray([atomA, atomB, atomC]);
  var memberOfHornClause = defaultHornClauses.createMemberClause();
  var memberOf = new Predicate({name:"member", argsList:[atomA, myList]});
  var goal = new PredicateStatement({hornClauses:memberOfHornClause, predicate:memberOf});

  var unifySetGenerator = goal.unify(new SubstitutionSet({}))
  var values = [];
  var {value, done} = unifySetGenerator.next();

  while(!done){
    values.push(value);
    var {value, done} = unifySetGenerator.next();
  }

  values.map((val) => {
    //console.log(val.collection)
  })
  expect(values.length).toBe(1);
})

test("test - grandparent", () => {
  var rt = new RuntimeEngine();

  rt.parseRules(`
  parent(james, jack).
  parent(jim, james).
  parent(susan, james).

  family([jim, james, susan, jack]).
  grandParent(X, Y) :- family(K), member(X, K), member(Z, K), member(Y, K), parent(X, Z), parent(Z, Y).
  `)

  var gen = rt.run("grandParent(X, Y)");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next()
  }``
  expect(vals.length).toBe(2);
  expect(vals[0].X.toString()).toBe("jim");
  expect(vals[0].Y.toString()).toBe("jack");
  expect(vals[1].X.toString()).toBe("susan");
  expect(vals[1].Y.toString()).toBe("jack");
});

var _rt = new RuntimeEngine();

_rt.parseRules(`
parent(james, jack).
parent(jim, james).
parent(susan, james).

family([jim, james, susan, jack]).
grandParent(X, Y) :- family(K), member(X, K), member(Z, K), member(Y, K), parent(X, Z), parent(Z, Y).
`)

test("test - grandparent (time)", () => {

  var rt = _rt;

  var gen = rt.run("grandParent(X, Y)");

  var vals= [];
  var {value, done} = gen.next();
  //while(!done){
    vals.push(value);
    //var {value, done} = gen.next()
  //}
  expect(vals.length).toBe(1);
  expect(vals[0].X.toString()).toBe("jim");
  expect(vals[0].Y.toString()).toBe("jack");
});

test("test - numbers", () => {

  var rt = _rt;

  var gen = rt.run("=(-1.99, -01.99)");

  var vals= [];
  var {value, done} = gen.next();
  //while(!done){
    vals.push(value);
    //var {value, done} = gen.next()
  //}
  expect(vals.length).toBe(1);
});

test("test - add numbers", () => {

  var rt = _rt;
  var gen = rt.run("+(1, 1, X)");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next()
  }
  expect(vals.length).toBe(1);
  expect(vals[0].X.toString()).toBe("2")

  var gen = rt.run("+(1, 1, 2)");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next()
  }
  expect(vals.length).toBe(1);

  var gen = rt.run("+(-1, X, 1)");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next()
  }
  expect(vals.length).toBe(1);
  expect(vals[0].X.toString()).toBe("2")
});

test("test - add numbers", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  var gen = rt.run("count([], 0)");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next()
  }
  expect(vals.length).toBe(1);

  var gen = rt.run("count([a], 1)");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next()
  }
  expect(vals.length).toBe(1);

  var gen = rt.run("count([X,Y,Z], 3)");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next()
  }
  expect(vals.length).toBe(1);

  var gen = rt.run("count([X,Y,Z], P)");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next()
  }
  expect(vals.length).toBe(1);
  expect(vals[0].P.toNumber()).toBe(3)
});
