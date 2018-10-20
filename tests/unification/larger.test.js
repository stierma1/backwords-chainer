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
    //console.log(arguments)

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
  //console.log(vals)

  expect(vals.length).toBe(1);
})

test("auto - builtInSystemCalls - isAtom", () => {
  var rt = new RuntimeEngine(function(s,substitutionSet){
    //console.log(arguments)
    return substitutionSet;
  });
  rt.loadDefaults();

  var gen = rt.run("systemCall(isAtom(atom))");

  var vals= [];
  var {value, done} = gen.next();
  //while(!done){
    vals.push(value);
    //var {value, done} = gen.next();
  //}
  //console.log(vals)

  expect(vals.length).toBe(1);
})

test("auto - builtInSystemCalls - isAtom with Var", () => {
  var rt = new RuntimeEngine(function(s,substitutionSet){
    //console.log(arguments)
    return substitutionSet;
  });
  rt.loadDefaults();

  var gen = rt.run("is(X, atom), systemCall(isAtom(X))");

  var vals= [];
  var {value, done} = gen.next();
  //while(!done){
    vals.push(value);
    //var {value, done} = gen.next();
  //}
  //console.log(vals)

  expect(vals.length).toBe(1);
})

test("auto - builtInSystemCalls - isString", () => {
  var rt = new RuntimeEngine(function(s,substitutionSet){
    //console.log(arguments)
    return substitutionSet;
  });
  rt.loadDefaults();

  var gen = rt.run('systemCall(isString("atom"))');

  var vals= [];
  var {value, done} = gen.next();
  //while(!done){
    vals.push(value);
    //var {value, done} = gen.next();
  //}
  //console.log(vals)

  expect(vals.length).toBe(1);
})

test("auto - builtInSystemCalls - isList", () => {
  var rt = new RuntimeEngine(function(s,substitutionSet){
    //console.log(arguments)
    return substitutionSet;
  });
  rt.loadDefaults();

  var gen = rt.run('systemCall(isList([X]))');

  var vals= [];
  var {value, done} = gen.next();
  //while(!done){
    vals.push(value);
    //var {value, done} = gen.next();
  //}
  //console.log(vals)

  expect(vals.length).toBe(1);
})

test("auto - builtInSystemCalls - isNumber", () => {
  var rt = new RuntimeEngine(function(s,substitutionSet){
    //console.log(arguments)
    return substitutionSet;
  });
  rt.loadDefaults();

  var gen = rt.run('systemCall(isString(5))');

  var vals= [];
  var {value, done} = gen.next();
  //while(!done){
    vals.push(value);
    //var {value, done} = gen.next();
  //}
  //console.log(vals)

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
  expect(vals[0].X.getValue().hello).toBe("world")
})

test("dots in strings - atoms", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.setCurrentObjectBindings({"0": {hello:"world"}})
  rt.parseRules(`
    other("$.yes").
  `);

  var gen = rt.run("other(X)");

  var vals= [];
  var {value, done} = gen.next();
  while(!done){
    vals.push(value);
    var {value, done} = gen.next();
  }
  expect(vals.length).toBe(1)
  expect(vals[0].X.getValue()).toBe("\"$.yes\"")
})

test("should be serializable", () => {
  var rules = `produce("024d9a2c9f72f8a35822ff81804cbb4816f41b6a", "DSC_0780.png", "standard", ["japan", "2017"]).
imageMeta("f06372f19d9086bb9906050408be1a43440f4418.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x720", ["720p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("733a9e5d6a0150f299a4b442f420fed81f9c5738.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x720", ["720p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("4fc9819f4df968bcf542751ddf80a8ab6d42d5e2.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x720", ["720p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("1a4f19102944161953ca177f10c8e0b4c66d7643.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x720", ["720p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("0feb3f2b5a5e9c6423cbea4b35e62a341fadd7e5.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x720", ["720p"], "png", compression(0), ["png","high-quality"])).
imageMeta("9a787cf8f3a9f0810e91f18e9737dd8eaf3c827d.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x1080", ["1080p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("ca2290fa11c23a4f9472c39ba3283fa192549b1a.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x1080", ["1080p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("91848f49846f2f03357aeb3e2db7a1ad3c5c1ef6.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x1080", ["1080p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("2c7a6525499c94549cb34950bf0b05122ec3034c.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x1080", ["1080p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("45e28babd33b4b43a55cce63c949f1b70392c571.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x1080", ["1080p"], "png", compression(0), ["png","high-quality"])).
imageMeta("b79d7426aa58cba87efdc508ca11889b8045e9e1.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x1440", ["1440p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("1d14ad89138e9dbf784f2e804b39a9ce75c1c64f.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x1440", ["1440p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("0279ac683ee3423292442592e163f72e4dfe6dc3.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x1440", ["1440p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("457dd8d0504c84425b64916d156cb6d59d2c0300.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x1440", ["1440p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("c012231d9eb2e0e0c788d5ff51f948580a73f068.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x1440", ["1440p"], "png", compression(0), ["png","high-quality"])).
imageMeta("d9d09e692ee88639b2e135bf209a0d273502a6b4.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x480", ["480p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("b0cd43ed196ecddcedebcf30ea2352065a8ad4e2.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x480", ["480p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("9d606ef782a68b74ff9ee13b68ca001ae61b9e4d.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x480", ["480p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("8233cd62872c6dc596975679bd3efe0fe4a32456.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x480", ["480p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("f79666abc69449715ef9227e5ffecef26a89c50e.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x480", ["480p"], "png", compression(0), ["png","high-quality"])).
imageMeta("e99a3cc8b0fb6af88cfe8ff69bb77cdfc9726ccf.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x250", ["250p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("bcdcd3f8a6f1784c37ff3846621fd6bcba1074a9.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x250", ["250p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("177e8bc2183901647c7dabbaf11e354656822acc.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x250", ["250p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("70d570692051e9a487e2418c7c55eb8c667c6bbd.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x250", ["250p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("455cf33029b99c8426a8904f8a5aba11e65b37ee.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x250", ["250p"], "png", compression(0), ["png","high-quality"])).
imageMeta("0ae2573a4c3237771801ea25aac963a7fb17fde1.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x125", ["125p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("380a2090f47bc4c25daad44b6c68d266d503d3f0.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x125", ["125p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("fa45f410a5e80c8726e8b95341df5c6df3cd00ff.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x125", ["125p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("6d8e8c8b80c795c2b99e77dc781622750d155883.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x125", ["125p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("985c23a79ef1f04c94ad9120a2b8c5f7c3b3c9cf.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x125", ["125p"], "png", compression(0), ["png","high-quality"])).
imageMeta("31930a6d52c2441372e0666000d3dbd456a71198.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x50", ["50p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("61b83e33d783369147f1a2df3f8b87a23f6677b9.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x50", ["50p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("53db86381337ebba4426c6ee9ae1f89beb0db78a.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x50", ["50p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("91f87a850046d820e1a5f36a4f585cdd574064db.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x50", ["50p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("81331559379636f95d0da804eda500c2778cef39.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "0x50", ["50p"], "png", compression(0), ["png","high-quality"])).
imageMeta("81b1e46e97a29ed2eea6bac87aead9287dedd2ab.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "720x0", ["720w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("b689dc3933cd231e62401f6a85cee7c5c4034e51.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "720x0", ["720w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("c4f51ccf324822ea934a2f80cb199319433f23fa.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "720x0", ["720w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("dd178e535c15668967078bc6b023206e712fdddb.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "720x0", ["720w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("ba3dd0d99205bcf2eccaced0163a52a4d58b27ee.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "720x0", ["720w"], "png", compression(0), ["png","high-quality"])).
imageMeta("a614fc6e2ea1590ff71954f5e2aa70820b8fe820.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "1080x0", ["1080w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("82ec9f4744cbd78e0ef1ca168b2bed4711e0c2d3.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "1080x0", ["1080w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("28a4fff59edcd9790de28b7ef18f4b3141b362d4.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "1080x0", ["1080w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("80466065decee4c4e00945b1c92b998b9715fc17.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "1080x0", ["1080w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("e45de22f3802f6bf61d61461130c42788b67011b.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "1080x0", ["1080w"], "png", compression(0), ["png","high-quality"])).
imageMeta("55f4fa55c3b4757aef866cf2cee5cb719ee8b053.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "1440x0", ["1440w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("53a6761036e0bfd1721411d12f1acdfac99e9cd8.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "1440x0", ["1440w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("93b3957db60fda63b23eb9e3767d4a7037c4aaaf.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "1440x0", ["1440w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("a7162c49d8e0dccd1f1794b80427882447d1439b.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "1440x0", ["1440w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("4ea9b05bb1e0b06a7abd5669733d76ed575d9217.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "1440x0", ["1440w"], "png", compression(0), ["png","high-quality"])).
imageMeta("c045b313a6843d81f4a73049c2184a2dc0f2c9f1.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "480x0", ["480w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("7ae94249932ff0931521ee4985caeb086bf38afc.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "480x0", ["480w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("097b5c63dbf47bbd6a948b849f2523ad24c2ca09.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "480x0", ["480w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("8947fbfd8532c73456a1eec19cc8dc7a6d5fd7c9.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "480x0", ["480w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("93c70227ccaf74e8c05e72f77dc95e3bac9bddc5.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "480x0", ["480w"], "png", compression(0), ["png","high-quality"])).
imageMeta("f76ea80b1b3f6e68da58474d02ba943bffb543cd.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "250x0", ["250w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("dcccb6548add0529e04c9d5a2cbcf75e744d51f1.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "250x0", ["250w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("9fbfc1f156140e4940aeed8d0c8bf6261d822bcf.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "250x0", ["250w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("71eff56f7220d41a6d576febe421042e0438148c.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "250x0", ["250w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("8dd4504990c29cceb0af59fcb413a268ea50ff57.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "250x0", ["250w"], "png", compression(0), ["png","high-quality"])).
imageMeta("462b36fb28269aa5ca0a8acaac4782a4d3ec2bf2.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "125x0", ["125w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("8dcf9fa9a6a154f6523f38744d5c2664376e6e90.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "125x0", ["125w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("d7b3a47c088848a9077d0af7108d02c5e9653ac4.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "125x0", ["125w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("ecab69f3f2e0e1af17e2e274f775da95bb81c2f6.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "125x0", ["125w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("68613300ff593766bc5b40531c297cb2b37e82c6.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "125x0", ["125w"], "png", compression(0), ["png","high-quality"])).
imageMeta("5105f38e02fbe472d0050f8c9b7156b49ba63254.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "50x0", ["50w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("be089afa2cc8ac9b49ad47eff5b8b36805b45d6f.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "50x0", ["50w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("9e0b61c83c7b1c366ee526b755246c286f17756c.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "50x0", ["50w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("6a5b9ad84c1a69681b9c9088494c65ee07c14c09.jpg", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "50x0", ["50w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("62e3793081362ce65df224ed06c884261214fc96.png", "DSC_0780.png", ["japan","2017"], init, production("standard", [], "50x0", ["50w"], "png", compression(0), ["png","high-quality"])).
imageMeta("f06372f19d9086bb9906050408be1a43440f4418.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x720", ["720p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("733a9e5d6a0150f299a4b442f420fed81f9c5738.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x720", ["720p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("4fc9819f4df968bcf542751ddf80a8ab6d42d5e2.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x720", ["720p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("1a4f19102944161953ca177f10c8e0b4c66d7643.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x720", ["720p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("0feb3f2b5a5e9c6423cbea4b35e62a341fadd7e5.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x720", ["720p"], "png", compression(0), ["png","high-quality"])).
imageMeta("9a787cf8f3a9f0810e91f18e9737dd8eaf3c827d.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x1080", ["1080p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("ca2290fa11c23a4f9472c39ba3283fa192549b1a.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x1080", ["1080p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("91848f49846f2f03357aeb3e2db7a1ad3c5c1ef6.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x1080", ["1080p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("2c7a6525499c94549cb34950bf0b05122ec3034c.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x1080", ["1080p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("45e28babd33b4b43a55cce63c949f1b70392c571.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x1080", ["1080p"], "png", compression(0), ["png","high-quality"])).
imageMeta("b79d7426aa58cba87efdc508ca11889b8045e9e1.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x1440", ["1440p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("1d14ad89138e9dbf784f2e804b39a9ce75c1c64f.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x1440", ["1440p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("0279ac683ee3423292442592e163f72e4dfe6dc3.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x1440", ["1440p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("457dd8d0504c84425b64916d156cb6d59d2c0300.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x1440", ["1440p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("c012231d9eb2e0e0c788d5ff51f948580a73f068.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x1440", ["1440p"], "png", compression(0), ["png","high-quality"])).
imageMeta("d9d09e692ee88639b2e135bf209a0d273502a6b4.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x480", ["480p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("b0cd43ed196ecddcedebcf30ea2352065a8ad4e2.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x480", ["480p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("9d606ef782a68b74ff9ee13b68ca001ae61b9e4d.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x480", ["480p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("8233cd62872c6dc596975679bd3efe0fe4a32456.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x480", ["480p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("f79666abc69449715ef9227e5ffecef26a89c50e.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x480", ["480p"], "png", compression(0), ["png","high-quality"])).
imageMeta("e99a3cc8b0fb6af88cfe8ff69bb77cdfc9726ccf.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x250", ["250p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("bcdcd3f8a6f1784c37ff3846621fd6bcba1074a9.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x250", ["250p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("177e8bc2183901647c7dabbaf11e354656822acc.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x250", ["250p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("70d570692051e9a487e2418c7c55eb8c667c6bbd.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x250", ["250p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("455cf33029b99c8426a8904f8a5aba11e65b37ee.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x250", ["250p"], "png", compression(0), ["png","high-quality"])).
imageMeta("0ae2573a4c3237771801ea25aac963a7fb17fde1.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x125", ["125p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("380a2090f47bc4c25daad44b6c68d266d503d3f0.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x125", ["125p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("fa45f410a5e80c8726e8b95341df5c6df3cd00ff.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x125", ["125p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("6d8e8c8b80c795c2b99e77dc781622750d155883.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x125", ["125p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("985c23a79ef1f04c94ad9120a2b8c5f7c3b3c9cf.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x125", ["125p"], "png", compression(0), ["png","high-quality"])).
imageMeta("31930a6d52c2441372e0666000d3dbd456a71198.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x50", ["50p"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("61b83e33d783369147f1a2df3f8b87a23f6677b9.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x50", ["50p"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("53db86381337ebba4426c6ee9ae1f89beb0db78a.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x50", ["50p"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("91f87a850046d820e1a5f36a4f585cdd574064db.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x50", ["50p"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("81331559379636f95d0da804eda500c2778cef39.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "0x50", ["50p"], "png", compression(0), ["png","high-quality"])).
imageMeta("81b1e46e97a29ed2eea6bac87aead9287dedd2ab.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "720x0", ["720w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("b689dc3933cd231e62401f6a85cee7c5c4034e51.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "720x0", ["720w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("c4f51ccf324822ea934a2f80cb199319433f23fa.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "720x0", ["720w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("dd178e535c15668967078bc6b023206e712fdddb.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "720x0", ["720w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("ba3dd0d99205bcf2eccaced0163a52a4d58b27ee.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "720x0", ["720w"], "png", compression(0), ["png","high-quality"])).
imageMeta("a614fc6e2ea1590ff71954f5e2aa70820b8fe820.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "1080x0", ["1080w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("82ec9f4744cbd78e0ef1ca168b2bed4711e0c2d3.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "1080x0", ["1080w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("28a4fff59edcd9790de28b7ef18f4b3141b362d4.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "1080x0", ["1080w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("80466065decee4c4e00945b1c92b998b9715fc17.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "1080x0", ["1080w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("e45de22f3802f6bf61d61461130c42788b67011b.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "1080x0", ["1080w"], "png", compression(0), ["png","high-quality"])).
imageMeta("55f4fa55c3b4757aef866cf2cee5cb719ee8b053.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "1440x0", ["1440w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("53a6761036e0bfd1721411d12f1acdfac99e9cd8.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "1440x0", ["1440w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("93b3957db60fda63b23eb9e3767d4a7037c4aaaf.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "1440x0", ["1440w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("a7162c49d8e0dccd1f1794b80427882447d1439b.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "1440x0", ["1440w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("4ea9b05bb1e0b06a7abd5669733d76ed575d9217.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "1440x0", ["1440w"], "png", compression(0), ["png","high-quality"])).
imageMeta("c045b313a6843d81f4a73049c2184a2dc0f2c9f1.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "480x0", ["480w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("7ae94249932ff0931521ee4985caeb086bf38afc.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "480x0", ["480w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("097b5c63dbf47bbd6a948b849f2523ad24c2ca09.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "480x0", ["480w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("8947fbfd8532c73456a1eec19cc8dc7a6d5fd7c9.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "480x0", ["480w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("93c70227ccaf74e8c05e72f77dc95e3bac9bddc5.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "480x0", ["480w"], "png", compression(0), ["png","high-quality"])).
imageMeta("f76ea80b1b3f6e68da58474d02ba943bffb543cd.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "250x0", ["250w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("dcccb6548add0529e04c9d5a2cbcf75e744d51f1.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "250x0", ["250w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("9fbfc1f156140e4940aeed8d0c8bf6261d822bcf.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "250x0", ["250w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("71eff56f7220d41a6d576febe421042e0438148c.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "250x0", ["250w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("8dd4504990c29cceb0af59fcb413a268ea50ff57.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "250x0", ["250w"], "png", compression(0), ["png","high-quality"])).
imageMeta("462b36fb28269aa5ca0a8acaac4782a4d3ec2bf2.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "125x0", ["125w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("8dcf9fa9a6a154f6523f38744d5c2664376e6e90.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "125x0", ["125w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("d7b3a47c088848a9077d0af7108d02c5e9653ac4.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "125x0", ["125w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("ecab69f3f2e0e1af17e2e274f775da95bb81c2f6.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "125x0", ["125w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("68613300ff593766bc5b40531c297cb2b37e82c6.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "125x0", ["125w"], "png", compression(0), ["png","high-quality"])).
imageMeta("5105f38e02fbe472d0050f8c9b7156b49ba63254.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "50x0", ["50w"], "jpg", compression(0), ["jpeg","jpg","high-quality"])).
imageMeta("be089afa2cc8ac9b49ad47eff5b8b36805b45d6f.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "50x0", ["50w"], "jpg", compression(30), ["jpeg","jpg","mid-quality"])).
imageMeta("9e0b61c83c7b1c366ee526b755246c286f17756c.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "50x0", ["50w"], "jpg", compression(70), ["jpeg","jpg","low-quality"])).
imageMeta("6a5b9ad84c1a69681b9c9088494c65ee07c14c09.jpg", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "50x0", ["50w"], "jpg", compression(100), ["jpeg","jpg","ultra-low-quality"])).
imageMeta("62e3793081362ce65df224ed06c884261214fc96.png", "DSC_0780.png", ["japan","2017"], done, production("standard", [], "50x0", ["50w"], "png", compression(0), ["png","high-quality"])).`
var rt = new RuntimeEngine();
rt.parseRules(rules);
var first = rt.toString();
var rt2 = new RuntimeEngine();
rt2.parseRules(first);
  expect(first).toBe(rt2.toString())
})
